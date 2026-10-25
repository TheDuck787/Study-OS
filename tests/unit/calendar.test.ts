import { beforeEach, describe, expect, it } from 'vitest'
import { db, useTestDatabase } from '@/db/index'
import * as repo from '@/db/repo'
import * as cal from '@/db/calendar'
import type { CalendarEvent, Exam, PlannerSettings, Recurrence, Task } from '@/db/types'
import { iterateOccurrences, occurrencesInRange, describeRecurrence } from '@/lib/calendar/recurrence'
import { buildItems, isOverdue } from '@/lib/calendar/items'
import { EMPTY_FILTERS, filterItems } from '@/lib/calendar/filters'
import { layoutTimed } from '@/lib/calendar/layout'
import { DEFAULT_PLANNER_SETTINGS, freeIntervals, placeDemands, proposeFullPlan, proposeTodayPlan, buildSupply, type PlannerData } from '@/lib/calendar/planner'
import { examPreparation } from '@/lib/calendar/prep'
import { summarizeWeek } from '@/lib/calendar/review'
import { isDayKey, toMin } from '@/lib/calendar/time'
import { checkBackup, exportBackup, restoreBackup } from '@/lib/backup'
import { clearUndo, undoLast } from '@/lib/undo'
import { addDays, dayKey, rangeDays, weekday } from '@/lib/dates'

const rule = (r: Partial<Recurrence>): Recurrence => ({ freq: 'weekly', interval: 1, byWeekday: [], until: null, count: null, exceptions: [], ...r })

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  ...(cal.emptyEvent('2026-11-02') as CalendarEvent), id: 'e', title: 'T', completedDates: [], seriesId: null, originalDate: null, source: 'manual', pinned: false,
  createdAt: '', updatedAt: '', ...p,
})

describe('time & recurrence', () => {
  it('validates real dates', () => {
    expect(isDayKey('2026-02-28')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('2026-1-1')).toBe(false)
  })
  it('weekly on several weekdays, every other week, with until and exceptions', () => {
    // 2026-11-02 is a Monday
    const days = [...iterateOccurrences('2026-11-02', rule({ byWeekday: [1, 3], interval: 2, until: '2026-11-30', exceptions: ['2026-11-18'] }))]
    expect(days).toEqual(['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-30'])
    expect(describeRecurrence(rule({ byWeekday: [1, 3], interval: 2 }), '2026-11-02')).toBe('Alle 2 Wochen (Mo, Mi)')
  })
  it('count limits occurrences; monthly skips missing days; daily interval', () => {
    expect([...iterateOccurrences('2026-11-02', rule({ count: 3 }))]).toEqual(['2026-11-02', '2026-11-09', '2026-11-16'])
    expect([...iterateOccurrences('2026-01-31', rule({ freq: 'monthly', count: 3 }))]).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
    expect(occurrencesInRange('2026-11-01', rule({ freq: 'daily', interval: 3 }), '2026-11-05', '2026-11-12')).toEqual(['2026-11-07', '2026-11-10'])
  })
  it('multi-day entries appear when they overlap the range', () => {
    expect(occurrencesInRange('2026-11-02', null, '2026-11-04', '2026-11-10', 3)).toEqual(['2026-11-02'])
    expect(occurrencesInRange('2026-11-02', null, '2026-11-06', '2026-11-10', 3)).toEqual([])
  })
})

describe('calendar items, filters, layout', () => {
  const exam: Exam = {
    id: 'x1', subjectId: 's1', title: 'Mathearbeit', type: 'Klassenarbeit', date: '2026-11-10', topicIds: [], materialIds: [], difficulty: 3, minutesPerDay: 30,
    availableWeekdays: [1, 2, 3, 4, 5], notes: '', plan: [{ id: 'p1', date: '2026-11-05', type: 'practice', title: 'Üben', description: '', topicIds: [], minutes: 20, done: false, doneAt: null, attemptId: null, start: '16:00' }],
    planWarnings: [], planGeneratedAt: null, gradingScaleId: null, createdAt: '',
  }
  const task: Task = { ...(cal.emptyTask({ title: 'Aufsatz', dueDate: '2026-11-04', subjectId: 's2' }) as Task), id: 't1', doneAt: null, createdAt: '', updatedAt: '' }
  const lessons = ev({ id: 'l', title: 'Mathe', category: 'lesson', subjectId: 's1', start: '08:00', end: '08:45', recurrence: rule({ byWeekday: [1, 3] }), completedDates: ['2026-11-04'] })
  const items = buildItems({ events: [lessons], exams: [exam], tasks: [task], from: '2026-11-02', to: '2026-11-11' })

  it('merges events (with occurrences), exams, plan sessions and tasks into one list', () => {
    expect(items.filter((i) => i.source === 'event').map((i) => i.date)).toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11'])
    expect(items.find((i) => i.source === 'event' && i.date === '2026-11-04')!.done).toBe(true)
    expect(items.find((i) => i.source === 'plan')).toMatchObject({ start: '16:00', end: '16:20', examId: 'x1', planner: true })
    expect(items.find((i) => i.source === 'exam')).toMatchObject({ allDay: true, priority: 'high' })
    expect(items.find((i) => i.source === 'task')).toMatchObject({ deadline: true, kind: 'homework' })
  })
  it('filters by subject, kind, status, quick filter and search', () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, subjects: ['s2'] }).map((i) => i.title)).toEqual(['Aufsatz'])
    expect(filterItems(items, { ...EMPTY_FILTERS, kinds: ['exam'] })).toHaveLength(1)
    expect(filterItems(items, { ...EMPTY_FILTERS, status: 'done' })).toHaveLength(1)
    expect(filterItems(items, { ...EMPTY_FILTERS, quick: 'study' }).map((i) => i.source)).toEqual(['plan'])
    expect(filterItems(items, { ...EMPTY_FILTERS, search: 'aufsatz' })).toHaveLength(1)
    expect(filterItems(items, { ...EMPTY_FILTERS, priorities: ['high'] }).map((i) => i.title)).toEqual(['Mathearbeit'])
  })
  it('detects overdue tasks and missed study sessions', () => {
    expect(isOverdue(items.find((i) => i.source === 'task')!, '2026-11-05')).toBe(true)
    expect(isOverdue(items.find((i) => i.source === 'plan')!, '2026-11-06')).toBe(true)
    expect(isOverdue(items.find((i) => i.source === 'exam')!, '2026-11-20')).toBe(false)
  })
  it('lays overlapping entries side by side without overlap', () => {
    const placed = layoutTimed([{ start: '08:00', end: '09:00' }, { start: '08:30', end: '09:30' }, { start: '09:00', end: '10:00' }, { start: '11:00', end: '11:30' }])
    const at = (s: string) => placed.find((p) => p.item.start === s)!
    expect([at('08:00').col, at('08:30').col, at('09:00').col]).toEqual([0, 1, 0])
    expect(at('08:00').cols).toBe(2)
    expect(at('11:00')).toMatchObject({ col: 0, cols: 1 })
  })
})

describe('planner placement', () => {
  it('subtracts busy blocks from windows', () => {
    expect(freeIntervals([900, 1200], [[960, 1020], [1100, 1300]])).toEqual([[900, 960], [1020, 1100]])
  })
  it('earliest deadline first, respects capacity and breaks, falls back to earlier days', () => {
    const supply = [
      { date: '2026-11-02', free: [[900, 1020]] as [number, number][], capacity: 60 },
      { date: '2026-11-03', free: [[900, 1020]] as [number, number][], capacity: 60 },
    ]
    const r = placeDemands(
      [
        { id: 'late', title: 'L', minutes: 45, earliest: '2026-11-02', preferred: '2026-11-03', latest: '2026-11-03', urgency: 5 },
        { id: 'soon', title: 'S', minutes: 45, earliest: '2026-11-02', preferred: '2026-11-03', latest: '2026-11-03', urgency: 1 },
        { id: 'tiny', title: 'T', minutes: 15, earliest: '2026-11-02', preferred: '2026-11-02', latest: '2026-11-02', urgency: 9 },
      ],
      supply,
      10,
    )
    const p = (id: string) => r.placements.find((x) => x.demandId === id)
    expect(p('tiny')).toMatchObject({ date: '2026-11-02', start: '15:00', end: '15:15' })
    expect(p('soon')).toMatchObject({ date: '2026-11-03', start: '15:00' })
    expect(p('late')).toMatchObject({ date: '2026-11-02', start: '15:25' }) // day 2 full → earlier day, after a 10 min break
    expect(r.unplaced).toEqual([])
  })
  it('keeps lessons, appointments and blocked days free', () => {
    const settings: PlannerSettings = { ...DEFAULT_PLANNER_SETTINGS, windows: Array(7).fill({ from: '14:00', to: '18:00' }), bufferMinutes: 15 }
    const fixed = buildItems({
      events: [ev({ id: 'a', category: 'appointment', start: '15:00', end: '16:00', date: '2026-11-02' }), ev({ id: 'b', category: 'internship', allDay: true, start: null, end: null, date: '2026-11-03', blocksStudy: true })],
      exams: [], tasks: [], from: '2026-11-02', to: '2026-11-03',
    })
    const s = buildSupply({ days: ['2026-11-02', '2026-11-03'], settings, restDays: [], fixed, today: '2026-11-01', nowMin: 0 })
    expect(s[0].free).toEqual([[840, 885], [975, 1080]])
    expect(s[1].capacity).toBe(0)
  })
})

describe('planner proposals', () => {
  const today = '2026-11-02' // Monday
  const settings: PlannerSettings = { ...DEFAULT_PLANNER_SETTINGS, windows: Array(7).fill({ from: '15:00', to: '19:00' }), maxDailyMinutes: 90, horizonDays: 14 }
  const topics = [
    { id: 'tw', subjectId: 'ch', parentId: null, name: 'Atombau', description: '', order: 0, prerequisiteIds: [], curriculum: 'own' as const, createdAt: '' },
    { id: 'ts', subjectId: 'ch', parentId: null, name: 'Periodensystem', description: '', order: 1, prerequisiteIds: [], curriculum: 'own' as const, createdAt: '' },
  ]
  const chemExam: Exam = {
    id: 'chem', subjectId: 'ch', title: 'Chemie-Test', type: 'Test', date: addDays(today, 5), topicIds: ['tw', 'ts'], materialIds: [], difficulty: 2, minutesPerDay: 40,
    availableWeekdays: [0, 1, 2, 3, 4, 5, 6], notes: '', plan: [], planWarnings: [], planGeneratedAt: null, gradingScaleId: null, createdAt: '',
  }
  const lesson = ev({ id: 'les', title: 'Nachhilfe', category: 'appointment', start: '15:00', end: '16:00', date: today, recurrence: rule({ freq: 'daily' }) })
  const homework: Task = { ...(cal.emptyTask({ title: 'Referat', kind: 'project', dueDate: addDays(today, 3), estimateMinutes: 90 }) as Task), id: 'hw', doneAt: null, createdAt: '', updatedAt: '' }
  const base = (p: Partial<PlannerData> = {}): PlannerData => ({
    today, nowMin: 8 * 60, settings, restDays: [], events: [lesson], exams: [chemExam], tasks: [homework], topics,
    topicState: (id) => (id === 'tw' ? { mastery: 0.1, level: 'struggling' } : { mastery: 0.85, level: 'solid' }),
    cardsDueByDay: new Map([[today, 12]]), ...p,
  })

  it('spreads exam preparation over the days before the test, with more time for weak topics', () => {
    const p = proposeFullPlan(base())
    const examChanges = p.changes.filter((c) => c.target.type === 'plan' && c.action !== 'remove')
    const days = new Set(examChanges.map((c) => c.date))
    expect(days.size).toBeGreaterThanOrEqual(3) // not everything the night before
    expect(examChanges.every((c) => c.date < chemExam.date)).toBe(true)
    const minutesFor = (name: string) => examChanges.filter((c) => c.title.startsWith(name)).reduce((s, c) => s + c.minutes, 0)
    expect(minutesFor('Atombau')).toBeGreaterThan(minutesFor('Periodensystem'))
    expect(examChanges.some((c) => c.target.type === 'plan' && c.target.session.type === 'final' && c.date === addDays(chemExam.date, -1))).toBe(true)
  })
  it('never overlaps lessons/appointments or other generated sessions and respects the daily maximum', () => {
    const p = proposeFullPlan(base())
    const placed = p.changes.filter((c) => c.action !== 'remove' && c.start)
    for (const day of new Set(placed.map((c) => c.date))) {
      const onDay = placed.filter((c) => c.date === day).map((c) => [toMin(c.start!), toMin(c.end!)] as const).sort((a, b) => a[0] - b[0])
      for (let i = 1; i < onDay.length; i++) expect(onDay[i][0]).toBeGreaterThanOrEqual(onDay[i - 1][1])
      for (const [s] of onDay) expect(s >= 16 * 60 + settings.bufferMinutes || s < 15 * 60 - 30).toBe(true) // the appointment 15–16 (+15 min buffer) stays free
      expect(onDay.reduce((s, [a, b]) => s + b - a, 0)).toBeLessThanOrEqual(settings.maxDailyMinutes)
    }
  })
  it('splits a large task into sessions before its deadline and plans flashcards', () => {
    const p = proposeFullPlan(base())
    const hw = p.changes.filter((c) => c.target.type === 'event' && c.target.event.taskId === 'hw')
    expect(hw.reduce((s, c) => s + c.minutes, 0)).toBe(90)
    expect(hw.every((c) => c.minutes <= settings.sessionMaxMinutes && c.date < homework.dueDate!)).toBe(true)
    expect(p.changes.some((c) => c.kind === 'flashcards' && c.date === today)).toBe(true)
  })
  it('does not reschedule completed tasks, keeps manual entries untouched, creates no duplicates on re-planning', async () => {
    useTestDatabase(`planner-${Math.random()}`)
    const first = proposeFullPlan(base())
    const exams = [structuredClone(chemExam)]
    const { applyProposal } = await import('@/lib/calendar/planner')
    const applied = applyProposal(first, new Set(first.changes.map((c) => c.id)), exams)
    exams[0].plan = applied.examPlans.get('chem')!
    const manual = ev({ id: 'mine', title: 'Mein Lernblock', category: 'study', date: addDays(today, 1), start: '17:00', end: '18:00' })
    const events = [lesson, manual, ...applied.putEvents]
    const second = proposeFullPlan(base({ exams, events }))
    expect(second.changes.filter((c) => c.action === 'add')).toEqual([]) // same plan again → only keeps/moves
    expect(second.changes.some((c) => c.target.type === 'event' && c.target.event.id === 'mine')).toBe(false)
    const doneTask = { ...homework, status: 'done' as const }
    const third = proposeFullPlan(base({ exams, events, tasks: [doneTask] }))
    expect(third.changes.filter((c) => c.target.type === 'event' && c.target.event.taskId === 'hw' && c.action !== 'remove')).toEqual([])
    expect(third.changes.filter((c) => c.target.type === 'event' && c.target.event.taskId === 'hw' && c.action === 'remove').length).toBeGreaterThan(0)
  })
  it('prioritises the more imminent exam when time is short', () => {
    const tight: PlannerSettings = { ...settings, maxDailyMinutes: 30 }
    const later: Exam = { ...chemExam, id: 'bio', title: 'Bio', subjectId: 'bi', date: addDays(today, 12) }
    const p = proposeFullPlan(base({ settings: tight, exams: [later, chemExam], tasks: [], cardsDueByDay: new Map() }))
    const firstDays = p.changes.filter((c) => c.date <= addDays(today, 3) && c.target.type === 'plan')
    expect(firstDays.every((c) => c.target.type === 'plan' && c.target.examId === 'chem')).toBe(true)
  })
  it('"today" moves missed and today\'s planner sessions into free time, never manual ones', () => {
    const missed: Exam = { ...chemExam, plan: [{ id: 'm1', date: addDays(today, -1), type: 'practice', title: 'Atombau: Üben', description: '', topicIds: ['tw'], minutes: 30, done: false, doneAt: null, attemptId: null, start: '16:00' }] }
    const manual = ev({ id: 'mine', title: 'Eigener Block', category: 'study', date: today, start: '17:00', end: '18:00' })
    const p = proposeTodayPlan(base({ exams: [missed], events: [lesson, manual], cardsDueByDay: new Map() }))
    const m = p.changes.find((c) => c.id === 'plan:chem:m1')!
    expect(m).toMatchObject({ action: 'move', date: today })
    expect(toMin(m.start!)).toBeGreaterThanOrEqual(16 * 60 + 15)
    expect(p.changes.some((c) => c.id === 'ev:mine')).toBe(false)
  })
})

describe('preparation & weekly review use real data only', () => {
  it('computes readiness from answers, never from the self-assessment', () => {
    const exam: Exam = {
      id: 'x', subjectId: 's', title: 'T', type: 'Test', date: '2026-11-10', topicIds: ['a', 'b'], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [1],
      notes: '', plan: [{ id: 'p', date: '2026-11-08', type: 'final', title: 'Abschluss', description: '', topicIds: [], minutes: 20, done: false, doneAt: null, attemptId: null }],
      planWarnings: [], planGeneratedAt: null, gradingScaleId: null, createdAt: '2026-10-01T00:00:00.000Z', topicConfidence: { a: 5, b: 5 },
    }
    const topics = ['a', 'b'].map((id) => ({ id, subjectId: 's', parentId: null, name: id, description: '', order: 0, prerequisiteIds: [], curriculum: 'own' as const, createdAt: '' }))
    const none = examPreparation({ exam, topics, answers: [], decks: [], cards: [], cardReviews: [], attempts: [], sessions: [], events: [], today: '2026-11-02' })
    expect(none.readiness).toBe(0) // feeling confident is not the same as having practised
    expect(none.topics[0].confidence).toBe(5)
    expect(none).toMatchObject({ daysLeft: 8, planTotal: 1, planDone: 0, remainingPlannedMinutes: 20, finalSession: { date: '2026-11-08', done: false } })
    const answers = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, attemptId: 'q', questionId: `q${i}`, subjectId: 's', topicId: 'a', given: '', correct: true, score: 1, at: `2026-10-2${i % 5}T10:00:00.000Z`, hintsUsed: 0, timeMs: 1, mode: 'practice' as const, selfAssessed: false, feedback: '', errorTag: null }))
    const some = examPreparation({ exam, topics, answers, decks: [], cards: [], cardReviews: [], attempts: [], sessions: [], events: [], today: '2026-11-02', now: new Date('2026-11-02T12:00:00') })
    expect(some.readiness!).toBeGreaterThan(0.3)
    expect(some.readiness!).toBeLessThanOrEqual(0.5) // topic b is still untouched
    expect(some.weakTopics.map((t) => t.id)).toEqual(['b'])
  })
  it('summarises planned vs done study time and flags overloaded days', () => {
    const monday = '2026-11-02'
    const items = buildItems({
      events: [
        ev({ id: 'a', category: 'study', date: monday, start: '15:00', end: '17:00', status: 'done' }),
        ev({ id: 'b', category: 'study', date: addDays(monday, 1), start: '15:00', end: '15:30' }),
      ],
      exams: [], tasks: [], from: monday, to: addDays(monday, 6),
    })
    const w = summarizeWeek({ weekStart: monday, items, sessions: [], tasks: [], settings: DEFAULT_PLANNER_SETTINGS, restDays: [], today: addDays(monday, 3), examReadiness: [], cardsDue: 0, weakTopics: [] })
    expect(w.plannedStudy).toBe(150)
    expect(w.doneStudy).toBe(120)
    expect(w.days[0].overloaded).toBe(true) // 120 > 90 min maximum
    expect(w.recommendations.join(' ')).toContain('Montag ist voll')
  })
})

describe('storage: events, tasks, recurrence scopes, persistence', () => {
  let n = 0
  beforeEach(async () => {
    useTestDatabase(`cal-${n++}`)
    clearUndo()
    await repo.saveProfile({ name: 'Test' })
  })

  it('creates, edits and deletes events with validation', async () => {
    await expect(cal.saveEvent(cal.emptyEvent('2026-02-30', { title: 'X' }))).rejects.toThrow('gültiges Datum')
    await expect(cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'X', start: '10:00', end: '09:00' }))).rejects.toThrow('Endzeit')
    const id = await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Zahnarzt', location: 'Praxis' }))
    const e = (await db.events.get(id))!
    await cal.saveEvent({ ...e, title: 'Zahnarzt (verschoben)', start: '16:00', end: '16:30' })
    expect((await db.events.get(id))!).toMatchObject({ title: 'Zahnarzt (verschoben)', start: '16:00', createdAt: e.createdAt })
    await cal.deleteEvent(id)
    expect(await db.events.count()).toBe(0)
    expect(await undoLast()).toBe('Eintrag gelöscht')
    expect(await db.events.get(id)).toBeDefined()
  })

  it('edits one occurrence, following occurrences or the whole series', async () => {
    const id = await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Mathe', category: 'lesson', start: '08:00', end: '08:45', recurrence: rule({ byWeekday: [1] }) }))
    const series = (await db.events.get(id))!
    // only this one
    const single = await cal.saveOccurrence(id, '2026-11-09', { ...series, date: '2026-11-09', start: '10:00', end: '10:45' }, 'single')
    let items = buildItems({ events: await db.events.toArray(), exams: [], tasks: [], from: '2026-11-02', to: '2026-11-23' })
    expect(items.map((i) => `${i.date} ${i.start}`)).toEqual(['2026-11-02 08:00', '2026-11-09 10:00', '2026-11-16 08:00', '2026-11-23 08:00'])
    expect((await db.events.get(single))!.seriesId).toBe(id)
    // this and following
    await cal.saveOccurrence(id, '2026-11-16', { ...series, date: '2026-11-16', title: 'Mathe (neuer Raum)', location: 'A12' }, 'following')
    items = buildItems({ events: await db.events.toArray(), exams: [], tasks: [], from: '2026-11-02', to: '2026-11-30' })
    expect(items.map((i) => i.title)).toEqual(['Mathe', 'Mathe', 'Mathe (neuer Raum)', 'Mathe (neuer Raum)', 'Mathe (neuer Raum)'])
    // all (the first series)
    await cal.saveOccurrence(id, '2026-11-02', { ...(await db.events.get(id))!, title: 'Mathematik' }, 'all')
    expect((await db.events.get(id))!.title).toBe('Mathematik')
    // delete one occurrence of the second series, then everything after a date
    const second = (await db.events.toArray()).find((e) => e.title === 'Mathe (neuer Raum)')!
    await cal.deleteEvent(second.id, { scope: 'single', occurrence: '2026-11-23' })
    await cal.deleteEvent(second.id, { scope: 'following', occurrence: '2026-11-30' })
    items = buildItems({ events: await db.events.toArray(), exams: [], tasks: [], from: '2026-11-02', to: '2026-12-31' })
    expect(items.filter((i) => i.title === 'Mathe (neuer Raum)').map((i) => i.date)).toEqual(['2026-11-16'])
  })

  it('moves items across all stores without duplicating them and pins planner entries', async () => {
    const sid = await repo.createSubject('Mathe')
    const examId = await repo.saveExam({ subjectId: sid, title: 'Arbeit', type: 'Klassenarbeit', date: '2026-11-20', topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [1, 2, 3, 4, 5], notes: '', gradingScaleId: null })
    await repo.setExamPlan(examId, [{ id: 'ps', date: '2026-11-10', type: 'practice', title: 'Üben', description: '', topicIds: [], minutes: 30, done: false, doneAt: null, attemptId: null }], [])
    const taskId = await cal.saveTask(cal.emptyTask({ title: 'Arbeitsblatt', dueDate: '2026-11-05', subjectId: sid }))
    const all = async () => buildItems({ events: await db.events.toArray(), exams: await db.exams.toArray(), tasks: await db.tasks.toArray(), from: '2026-11-01', to: '2026-11-30' })
    let items = await all()
    await cal.moveItem(items.find((i) => i.source === 'plan')!, '2026-11-11', '16:30')
    await cal.moveItem(items.find((i) => i.source === 'task')!, '2026-11-06')
    await cal.moveItem(items.find((i) => i.source === 'exam')!, '2026-11-21', '08:00')
    items = await all()
    expect(items.find((i) => i.source === 'plan')).toMatchObject({ date: '2026-11-11', start: '16:30', end: '17:00', pinned: true })
    expect(items.find((i) => i.source === 'task')!.date).toBe('2026-11-06')
    expect(items.find((i) => i.source === 'exam')).toMatchObject({ date: '2026-11-21', start: '08:00' })
    expect(await db.tasks.count()).toBe(1)
    expect((await db.tasks.get(taskId))!.title).toBe('Arbeitsblatt')
    await expect(cal.moveItem(items.find((i) => i.source === 'plan')!, '2026-11-25')).rejects.toThrow('vor dem Prüfungstag')
  })

  it('scheduling a task links a session; completing it removes future planner sessions only', async () => {
    const today = dayKey()
    const taskId = await cal.saveTask(cal.emptyTask({ title: 'Projekt', kind: 'project', dueDate: addDays(today, 10), estimateMinutes: 120 }))
    const manual = await cal.scheduleTask(taskId, addDays(today, 1), '16:00', 45)
    await db.events.add({ ...(await db.events.get(manual))!, id: 'planned', source: 'planner', date: addDays(today, 2) })
    await cal.setTaskDone(taskId, true)
    expect((await db.tasks.get(taskId))!.status).toBe('done')
    expect(await db.events.get('planned')).toBeUndefined()
    expect((await db.events.get(manual))!.taskId).toBe(taskId) // the student's own block stays
    await undoLast()
    expect((await db.tasks.get(taskId))!.status).toBe('open')
    expect(await db.events.get('planned')).toBeDefined()
    await cal.deleteTask(taskId)
    expect(await db.events.where('taskId').equals(taskId).count()).toBe(0)
  })

  it('marks recurring occurrences done individually', async () => {
    const id = await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Vokabeln', category: 'flashcards', recurrence: rule({ freq: 'daily', count: 5 }) }))
    const items = buildItems({ events: await db.events.toArray(), exams: [], tasks: [], from: '2026-11-02', to: '2026-11-06' })
    await cal.setItemDone(items[1], true)
    expect((await db.events.get(id))!.completedDates).toEqual(['2026-11-03'])
  })

  it('commits a planner proposal without touching manual entries', async () => {
    const manualId = await cal.saveEvent(cal.emptyEvent(dayKey(), { title: 'Fußball', start: '16:00', end: '17:30' }))
    const manual = (await db.events.get(manualId))!
    const proposal = { mode: 'full' as const, warnings: [], untimedCount: 0, changes: [
      { id: 'x', action: 'move' as const, title: 'hack', subjectId: null, kind: 'study' as const, minutes: 30, date: dayKey(), start: '10:00', end: '10:30', reason: '', target: { type: 'event' as const, event: { ...manual, start: '10:00', end: '10:30' } } },
      { id: 'y', action: 'remove' as const, title: 'hack', subjectId: null, kind: 'study' as const, minutes: 30, date: dayKey(), start: null, end: null, reason: '', target: { type: 'event' as const, event: manual } },
    ] }
    await cal.commitProposal(proposal, new Set(['x', 'y']))
    expect((await db.events.get(manualId))!.start).toBe('16:00')
  })

  it('backup contains calendar data and restores it', async () => {
    const sid = await repo.createSubject('Englisch')
    await repo.updateSubject(sid, { icon: 'languages' })
    await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Englisch', category: 'lesson', subjectId: sid, recurrence: rule({}) }))
    await cal.saveTask(cal.emptyTask({ title: 'Vokabeln lernen', subtasks: [{ id: '', text: 'Unit 3', done: false }] }))
    await cal.saveCustomCategory({ name: 'Chor', color: 3 })
    const text = await exportBackup(false)
    const check = checkBackup(text)
    expect(check.ok).toBe(true)
    expect(check.counts).toMatchObject({ events: 1, tasks: 1, eventCategories: 1 })
    useTestDatabase(`restore-${n++}`)
    await restoreBackup(check.backup!)
    expect(await db.events.count()).toBe(1)
    expect((await db.tasks.toArray())[0].subtasks[0].text).toBe('Unit 3')
    expect((await db.subjects.get(sid))!.icon).toBe('languages')
  })

  it('a version-1 backup (without calendar tables) still restores', async () => {
    const v1 = JSON.parse(await exportBackup(false))
    v1.version = 1
    for (const t of ['events', 'tasks', 'eventCategories']) delete v1.tables[t]
    expect(checkBackup(JSON.stringify(v1)).ok).toBe(true)
  })

  it('planner settings are validated and stored', async () => {
    const s = await cal.getPlannerSettings()
    expect(s.horizonDays).toBe(14)
    await expect(cal.savePlannerSettings({ ...s, windows: s.windows.map((w, i) => (i === 1 ? { from: '18:00', to: '17:00' } : w)) })).rejects.toThrow('Zeitfenster')
    await cal.savePlannerSettings({ ...s, maxDailyMinutes: 120 })
    expect((await cal.getPlannerSettings()).maxDailyMinutes).toBe(120)
  })

  it('deleting a subject keeps calendar entries and tasks (without subject)', async () => {
    const sid = await repo.createSubject('Physik')
    await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Physik', category: 'lesson', subjectId: sid }))
    await cal.saveTask(cal.emptyTask({ title: 'Protokoll', subjectId: sid }))
    await repo.deleteSubject(sid)
    expect((await db.events.toArray())[0].subjectId).toBeNull()
    expect((await db.tasks.toArray())[0].subjectId).toBeNull()
  })
})

describe('sanity', () => {
  it('weekday helper matches the planner window index', () => {
    expect(rangeDays('2026-11-01', '2026-11-07').map(weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })
})
