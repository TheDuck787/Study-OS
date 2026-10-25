import { beforeEach, describe, expect, it } from 'vitest'
import { db, useTestDatabase } from '@/db/index'
import * as repo from '@/db/repo'
import * as cal from '@/db/calendar'
import * as tt from '@/db/timetable'
import { buildItems } from '@/lib/calendar/items'
import { buildSupply, DEFAULT_PLANNER_SETTINGS } from '@/lib/calendar/planner'
import { alignedStart, dayStatus, formatPeriods, generatePeriods, isoWeek, lessonsOn, matchPeriods, nextLessonOf, periodTimes, schoolWindows, subjectShort, validatePeriods, weekTypeOf } from '@/lib/timetable/core'
import { exportTimetableCsv, parseTimetableCsv } from '@/lib/timetable/csv'
import { exportTimetableIcs, icsToDrafts, parseIcs } from '@/lib/timetable/ics'
import { clearUndo, undoLast } from '@/lib/undo'
import { toMin } from '@/lib/calendar/time'

// 2026-11-02 is a Monday (KW 45)
const MON = '2026-11-02'
let n = 0
beforeEach(async () => {
  useTestDatabase(`tt-${++n}`)
  clearUndo()
})

const periods = generatePeriods({ firstStart: '07:45', minutes: 45, count: 8, gap: 5, breaks: { 2: 20, 4: 20, 6: 30 } })

async function setup() {
  await tt.saveTimetableSettings({ periods, days: [1, 2, 3, 4, 5], teachers: [], rooms: [], weekAMonday: MON })
  const math = await repo.createSubject('Mathematik')
  const eng = await repo.createSubject('Englisch')
  return { math, eng }
}
const lessons = async (from: string, to: string) => buildItems({ events: await db.events.toArray(), exams: [], tasks: [], from, to }).filter((i) => i.kind === 'lesson')

describe('bell schedule & weeks', () => {
  it('generates periods from the student’s numbers, with longer breaks', () => {
    expect(periods.slice(0, 4)).toEqual([
      { n: 1, start: '07:45', end: '08:30' }, { n: 2, start: '08:35', end: '09:20' }, { n: 3, start: '09:40', end: '10:25' }, { n: 4, start: '10:30', end: '11:15' },
    ])
    expect(validatePeriods(periods)).toBeNull()
    expect(validatePeriods([{ n: 1, start: '08:00', end: '08:45' }, { n: 2, start: '08:30', end: '09:15' }])).toMatch(/überschneidet/)
    expect(validatePeriods([{ n: 1, start: '08:00', end: '07:45' }])).toMatch(/Ende nach dem Beginn/)
    expect(periodTimes(periods, 3, 4)).toEqual({ start: '09:40', end: '11:15' })
    expect(matchPeriods(periods, '09:40', '11:15')).toEqual({ period: 3, periodEnd: 4 })
    expect(matchPeriods(periods, '09:41', '11:15')).toBeNull()
    expect(formatPeriods(3, 4)).toBe('3.–4. Std.')
  })
  it('A/B weeks, ISO weeks and aligned series starts', () => {
    expect(isoWeek(MON)).toBe(45)
    expect(isoWeek('2027-01-01')).toBe(53)
    expect(weekTypeOf('2026-11-06', MON)).toBe('A')
    expect(weekTypeOf('2026-11-10', MON)).toBe('B')
    expect(weekTypeOf('2026-10-27', MON)).toBe('B')
    expect(alignedStart('2026-11-04', 3, null, null)).toBe('2026-11-04') // Wednesday itself
    expect(alignedStart('2026-11-05', 3, null, null)).toBe('2026-11-11') // next Wednesday
    expect(alignedStart(MON, 2, 'B', MON)).toBe('2026-11-10')
  })
  it('short subject codes', () => {
    expect(subjectShort({ name: 'Mathematik', short: 'MA' })).toBe('MA')
    expect(subjectShort({ name: 'Mathematik' })).toBe('Mat')
    expect(subjectShort({ name: 'Arbeit-Wirtschaft-Technik' })).toBe('AWT')
    expect(subjectShort({ name: 'Bio' })).toBe('Bio')
  })
})

describe('lessons in the database', () => {
  it('creates weekly lessons that the calendar shows every week, A/B lessons every other week', async () => {
    const { math, eng } = await setup()
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, ...periodTimes(periods, 1, 2)!, period: 1, periodEnd: 2, teacher: 'MÜL', location: 'R 104', validFrom: MON }))
    await tt.createLesson(tt.emptyLesson({ subjectId: eng, weekday: 2, ...periodTimes(periods, 3)!, period: 3, weekType: 'B', validFrom: MON }))
    const items = await lessons(MON, '2026-11-29')
    expect(items.filter((i) => i.subjectId === math).map((i) => i.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
    expect(items.filter((i) => i.subjectId === eng).map((i) => i.date)).toEqual(['2026-11-10', '2026-11-24'])
    const m = items.find((i) => i.subjectId === math)!
    expect(m).toMatchObject({ title: 'Mathematik', start: '07:45', end: '09:20', period: 1, periodEnd: 2, teacher: 'MÜL', location: 'R 104' })
    // teacher and room are remembered for next time
    const s = await tt.getTimetableSettings()
    expect(s.teachers.map((t) => t.short)).toEqual(['MÜL'])
    expect(s.rooms.map((r) => r.name)).toEqual(['R 104'])
    // A/B lesson without configured weeks is refused with a clear message
    await tt.saveTimetableSettings({ ...s, weekAMonday: null })
    await expect(tt.createLesson(tt.emptyLesson({ subjectId: eng, weekType: 'A', validFrom: MON }))).rejects.toThrow(/A- oder B-Woche/)
  })

  it('cancel / substitute one day, then restore it; the regular lesson stays untouched', async () => {
    const { math, eng } = await setup()
    const id = await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 3, start: '09:40', end: '10:25', period: 3, teacher: 'MÜL', location: 'R 104', validFrom: MON }))
    let day = (await lessons('2026-11-11', '2026-11-11'))[0]
    await tt.setLessonChange(day, { type: 'cancelled', note: 'Lehrerin krank' })
    day = (await lessons('2026-11-11', '2026-11-11'))[0]
    expect(day).toMatchObject({ cancelled: true, lessonChange: { type: 'cancelled', note: 'Lehrerin krank' } })
    expect((await lessons('2026-11-04', '2026-11-18')).filter((i) => i.cancelled).length).toBe(1)
    // switch the same day to a substitute with another subject and room
    await tt.setLessonChange(day, { type: 'substitute', note: '', subjectId: eng, teacher: 'KUR', location: 'R 201' })
    day = (await lessons('2026-11-11', '2026-11-11'))[0]
    expect(day).toMatchObject({ cancelled: false, subjectId: eng, title: 'Englisch', teacher: 'KUR', location: 'R 201', lessonChange: { type: 'substitute', before: { subjectId: math, teacher: 'MÜL', location: 'R 104' } } })
    expect(await db.events.count()).toBe(2) // series + one override, not a second override
    await tt.clearLessonChange(day)
    day = (await lessons('2026-11-11', '2026-11-11'))[0]
    expect(day).toMatchObject({ refId: id, subjectId: math, teacher: 'MÜL', cancelled: false })
    expect((await db.events.get(id))!.recurrence!.exceptions).toEqual([])
  })

  it('edits the whole series or only from a week on; changes for later days follow the lesson', async () => {
    const { math } = await setup()
    const id = await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '07:45', end: '08:30', period: 1, location: 'R 1', validFrom: MON }))
    const later = (await lessons('2026-11-23', '2026-11-23'))[0]
    await tt.setLessonChange(later, { type: 'room', note: '', location: 'Aula' })
    const input = tt.lessonToInput((await db.events.get(id))!)
    // from 16.11. on in room R 2
    const newId = await tt.updateLesson(id, { ...input, location: 'R 2' }, 'following', '2026-11-18')
    const items = await lessons(MON, '2026-11-30')
    expect(items.map((i) => [i.date, i.location])).toEqual([['2026-11-02', 'R 1'], ['2026-11-09', 'R 1'], ['2026-11-16', 'R 2'], ['2026-11-23', 'Aula'], ['2026-11-30', 'R 2']])
    expect((await db.events.where('seriesId').equals(newId).toArray()).length).toBe(1)
    // moving the lesson to Tuesday for all weeks drops day changes that no longer fit
    await tt.updateLesson(newId, { ...tt.lessonToInput((await db.events.get(newId))!), weekday: 2 }, 'all', '2026-11-16')
    const after = await lessons('2026-11-16', '2026-11-30')
    expect(after.map((i) => i.date)).toEqual(['2026-11-17', '2026-11-24'])
    // undo restores the previous state
    await undoLast()
    expect((await lessons('2026-11-23', '2026-11-23'))[0].location).toBe('Aula')
  })

  it('duplicates a lesson and deletes only from a week on', async () => {
    const { math } = await setup()
    const id = await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '07:45', end: '08:30', validFrom: MON }))
    await tt.duplicateLesson(id, { weekday: 4, start: '10:30', end: '11:15', period: 4, periodEnd: 4 })
    expect((await lessons(MON, '2026-11-08')).map((i) => [i.date, i.start])).toEqual([['2026-11-02', '07:45'], ['2026-11-05', '10:30']])
    await cal.deleteEvent(id, { scope: 'following', occurrence: '2026-11-16' })
    expect((await lessons(MON, '2026-11-30')).filter((i) => i.refId === id).map((i) => i.date)).toEqual(['2026-11-02', '2026-11-09'])
  })

  it('homework goes to the next lesson of the subject (skipping cancelled ones); exams join the planner', async () => {
    const { math } = await setup()
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '07:45', end: '08:30', validFrom: MON }))
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 4, start: '09:40', end: '10:25', validFrom: MON }))
    expect(await tt.findNextLessonDate(math, MON)).toBe('2026-11-05')
    const thu = (await lessons('2026-11-05', '2026-11-05'))[0]
    await tt.setLessonChange(thu, { type: 'cancelled', note: '' })
    expect(await tt.findNextLessonDate(math, MON)).toBe('2026-11-09')
    const hw = await tt.addHomework({ subjectId: math, title: 'S. 42 Nr. 3', dueDate: '2026-11-09', estimateMinutes: 30, description: '' })
    expect(await db.tasks.get(hw)).toMatchObject({ kind: 'homework', dueDate: '2026-11-09', subjectId: math, status: 'open' })
    const ex = await tt.addExamForLesson({ subjectId: math, title: 'Klassenarbeit Funktionen', type: 'Klassenarbeit', date: '2026-11-19', startTime: '09:40', endTime: '10:25', location: 'R 104', notes: '' })
    expect(await db.exams.get(ex)).toMatchObject({ date: '2026-11-19', startTime: '09:40', subjectId: math, minutesPerDay: 30 })
  })

  it('the planner keeps lessons free – and uses the time of a cancelled lesson', async () => {
    const { math } = await setup()
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '15:00', end: '16:30', validFrom: MON }))
    const settings = { ...DEFAULT_PLANNER_SETTINGS, bufferMinutes: 0 }
    const supply = async () => buildSupply({ days: [MON], settings, restDays: [], fixed: await lessons(MON, MON), today: '2026-11-01', nowMin: 0 })[0].free
    expect(await supply()).toEqual([[toMin('16:30'), toMin('19:30')]])
    await tt.setLessonChange((await lessons(MON, MON))[0], { type: 'cancelled', note: '' })
    expect(await supply()).toEqual([[toMin('15:30'), toMin('19:30')]])
  })

  it('copies school hours into the planner and computes today’s status', async () => {
    const { math, eng } = await setup()
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '07:45', end: '09:20', validFrom: MON }))
    await tt.createLesson(tt.emptyLesson({ subjectId: eng, weekday: 1, start: '11:35', end: '13:10', validFrom: MON }))
    await tt.createLesson(tt.emptyLesson({ subjectId: eng, weekday: 2, start: '08:35', end: '12:00', weekType: 'B', validFrom: MON }))
    const w = await tt.applySchoolTimesToPlanner(MON)
    expect(w[1]).toEqual({ from: '07:45', to: '13:10' })
    expect(w[2]).toEqual({ from: '08:35', to: '12:00' }) // found in the B week
    expect((await cal.getPlannerSettings()).school[1]).toEqual({ from: '07:45', to: '13:10' })
    const day = lessonsOn(await lessons(MON, MON), MON)
    expect(dayStatus(day, toMin('08:00'))).toMatchObject({ current: { subjectId: math }, next: { subjectId: eng }, minutesLeft: 80, remaining: 2 })
    expect(dayStatus(day, toMin('10:00'))).toMatchObject({ current: null, next: { subjectId: eng }, minutesLeft: 95 })
    expect(dayStatus(day, toMin('14:00'))).toMatchObject({ schoolOver: true, remaining: 0 })
    expect(schoolWindows(day)[1]).toEqual({ from: '07:45', to: '13:10' })
    expect(nextLessonOf(await lessons(MON, '2026-11-20'), eng, MON)?.date).toBe('2026-11-09') // English is on Mondays too
    expect(nextLessonOf(await lessons(MON, '2026-11-20'), math, MON)?.date).toBe('2026-11-09')
  })
})

describe('CSV and ICS', () => {
  it('CSV round trip; formulas are neutralised; errors are reported per line', async () => {
    const { math } = await setup()
    await repo.updateSubject(math, { short: 'MA' })
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 2, start: '09:40', end: '11:15', period: 3, periodEnd: 4, teacher: '=HYPERLINK("x")', location: 'R 104', weekType: 'A', validFrom: MON, validUntil: '2027-01-29', note: 'Taschenrechner; Heft' }))
    const csv = exportTimetableCsv(await db.events.toArray(), await db.subjects.toArray())
    expect(csv.startsWith('\uFEFFTag;Stunde;Bis Stunde;Beginn;Ende;Fach')).toBe(true)
    expect(csv).toContain(`'=HYPERLINK`) // never a live formula in Excel
    expect(csv).toContain('"Taschenrechner; Heft"')
    const back = parseTimetableCsv(csv, periods)
    expect(back.errors).toEqual([])
    expect(back.drafts[0]).toMatchObject({ weekday: 2, start: '09:40', end: '11:15', period: 3, periodEnd: 4, subject: 'Mathematik', subjectShort: 'MA', teacher: '=HYPERLINK("x")', room: 'R 104', weekType: 'A', validUntil: '2027-01-29', note: 'Taschenrechner; Heft' })

    const bad = parseTimetableCsv('Tag;Stunde;Fach;Raum\nMontag;1;Deutsch;R 1\nFunday;2;Kunst;\nDienstag;9;Musik;\nMi;;Sport;', periods)
    expect(bad.drafts).toHaveLength(1)
    expect(bad.drafts[0]).toMatchObject({ weekday: 1, start: '07:45', end: '08:30', subject: 'Deutsch' }) // times from the bell schedule
    expect(bad.errors.map((e) => e.line)).toEqual([3, 4, 5])
    expect(parseTimetableCsv('Name;Wert\na;b', periods).errors[0].message).toMatch(/Spalten/)
  })

  it('imports CSV safely: creates missing subjects, skips duplicates on a second import, undo removes it again', async () => {
    await setup()
    const csv = 'Wochentag,Beginn,Ende,Fach,Lehrer,Raum\nMo,7:45,8:30,Mathematik,MÜL,R 1\nDi,08:35,09:20,Physik,SCH,Labor\n'
    const { drafts } = parseTimetableCsv(csv, periods)
    const r1 = await tt.importLessons(drafts, { createSubjects: true })
    expect(r1).toEqual({ created: 2, skipped: 0, subjectsCreated: 1 })
    expect((await db.subjects.toArray()).map((s) => s.name).sort()).toEqual(['Englisch', 'Mathematik', 'Physik'])
    const r2 = await tt.importLessons(drafts, { createSubjects: true })
    expect(r2).toEqual({ created: 0, skipped: 2, subjectsCreated: 0 })
    await undoLast() // second import (nothing)
    await undoLast() // first import
    expect(await db.events.count()).toBe(0)
    expect((await db.subjects.toArray()).map((s) => s.name).sort()).toEqual(['Englisch', 'Mathematik'])
  })

  it('ICS export → import keeps the weekly series, exceptions and changes', async () => {
    const { math } = await setup()
    await tt.createLesson(tt.emptyLesson({ subjectId: math, weekday: 1, start: '07:45', end: '08:30', teacher: 'MÜL', location: 'R 1, 2. OG', validFrom: MON, validUntil: '2026-12-21' }))
    const second = (await lessons('2026-11-09', '2026-11-09'))[0]
    await tt.setLessonChange(second, { type: 'cancelled', note: 'Wandertag' })
    const ics = exportTimetableIcs(await db.events.toArray(), await db.subjects.toArray(), new Date('2026-11-01T10:00:00Z'))
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261221T235959')
    expect(ics).toContain('RECURRENCE-ID:20261109T074500')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('LOCATION:R 1\\, 2. OG')
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
    const parsed = parseIcs(ics)
    expect(parsed.error).toBeNull()
    const res = icsToDrafts(parsed.events, MON)
    expect(res.drafts).toHaveLength(1)
    expect(res.drafts[0]).toMatchObject({ weekday: 1, start: '07:45', end: '08:30', subject: 'Mathematik', room: 'R 1, 2. OG', teacher: 'MÜL', validFrom: MON, validUntil: '2026-12-21' })
    expect(res.skipped.cancelled).toBe(1) // the cancelled day (RECURRENCE-ID) is not a new lesson
  })

  it('groups single events (like a WebUntis export) into weekly and A/B lessons, holidays become exceptions', () => {
    const ev = (date: string, start: string, end: string, summary: string, loc = '') => `BEGIN:VEVENT\r\nUID:${date}${start}\r\nDTSTART:${date.replace(/-/g, '')}T${start.replace(':', '')}00\r\nDTEND:${date.replace(/-/g, '')}T${end.replace(':', '')}00\r\nSUMMARY:${summary}\r\nLOCATION:${loc}\r\nEND:VEVENT`
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
      ev('2026-11-02', '07:45', '08:30', 'M', 'R1'), ev('2026-11-09', '07:45', '08:30', 'M', 'R1'), ev('2026-11-23', '07:45', '08:30', 'M', 'R1'), // weekly, 16.11. missing
      ev('2026-11-03', '10:30', '11:15', 'Ph', 'Lab'), ev('2026-11-17', '10:30', '11:15', 'Ph', 'Lab'), ev('2026-12-01', '10:30', '11:15', 'Ph', 'Lab'), // every other week
      ev('2026-11-04', '13:00', '14:30', 'AG Theater'), // single
      'BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261224\r\nSUMMARY:Ferien\r\nEND:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const { events, error } = parseIcs(ics)
    expect(error).toBeNull()
    const res = icsToDrafts(events, null)
    expect(res.skipped.allDay).toBe(1)
    expect(res.singles.map((s) => s.summary)).toEqual(['AG Theater'])
    const m = res.drafts.find((d) => d.subject === 'M')!
    expect(m).toMatchObject({ weekday: 1, weekType: null, validFrom: '2026-11-02', validUntil: '2026-11-23', exceptions: ['2026-11-16'] })
    const ph = res.drafts.find((d) => d.subject === 'Ph')!
    expect(ph).toMatchObject({ weekday: 2, weekType: 'A', exceptions: [] })
    expect(res.suggestedWeekAMonday).toBe(MON)
  })

  it('rejects files that are not calendars and handles UTC times and folded lines', () => {
    expect(parseIcs('hello').error).toMatch(/keine gültige ICS/)
    const { events } = parseIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261102T064500Z\r\nDTEND:20261102T073000Z\r\nSUMMARY:Mathe\r\n matik\r\nEND:VEVENT\r\nEND:VCALENDAR')
    expect(events[0].summary).toBe('Mathematik')
    const local = new Date(Date.UTC(2026, 10, 2, 6, 45))
    expect(events[0].start).toBe(`${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`) // converted to device time
  })
})
