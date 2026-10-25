import { db } from './index'
import type { CalendarEvent, DayKey, ExamType, ID, LessonChange, LessonChangeType, TimetableSettings, WeekType } from './types'
import { createSubject, getMeta, saveExam, setMeta, ValidationError } from './repo'
import { emptyEvent, emptyTask, getPlannerSettings, saveTask, savePlannerSettings, validateEvent, type EventInput } from './calendar'
import { uid, nowIso } from '@/lib/id'
import { addDays, dayKey, startOfWeek, weekday } from '@/lib/dates'
import { isDayKey, isTime } from '@/lib/calendar/time'
import { buildItems, type CalItem } from '@/lib/calendar/items'
import { pushUndo } from '@/lib/undo'
import { alignedStart, DEFAULT_TIMETABLE_SETTINGS, lessonRecurrence, nextLessonOf, schoolWindows, validatePeriods, weekTypeOf } from '@/lib/timetable/core'
import type { LessonDraft } from '@/lib/timetable/csv'

/**
 * Timetable storage. A regular lesson is a weekly `events` series (category "lesson"); a change for one day
 * (cancelled, substitute, other room) is a separate event that replaces that occurrence (seriesId + originalDate),
 * exactly like editing one occurrence in the calendar. So nothing is duplicated and the planner, calendar and
 * sync need no special cases. Bell schedule, teachers, rooms and A/B weeks live in meta "timetable".
 */

const META_KEY = 'timetable'

export async function getTimetableSettings(): Promise<TimetableSettings> {
  const s = await getMeta<Partial<TimetableSettings>>(META_KEY)
  return {
    periods: Array.isArray(s?.periods) ? s.periods : [],
    days: Array.isArray(s?.days) && s.days.length ? s.days : DEFAULT_TIMETABLE_SETTINGS.days,
    teachers: Array.isArray(s?.teachers) ? s.teachers : [],
    rooms: Array.isArray(s?.rooms) ? s.rooms : [],
    weekAMonday: s?.weekAMonday && isDayKey(s.weekAMonday) ? s.weekAMonday : null,
  }
}

export async function saveTimetableSettings(s: TimetableSettings) {
  const err = validatePeriods(s.periods)
  if (err) throw new ValidationError(err)
  const days = [...new Set(s.days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 6).sort()
  if (!days.length) throw new ValidationError('Wähle mindestens einen Schultag.')
  if (s.weekAMonday !== null && !isDayKey(s.weekAMonday)) throw new ValidationError('Ungültiger Bezug für A/B-Wochen.')
  const uniq = <T,>(list: T[], key: (x: T) => string) => list.filter((x, i) => key(x) && list.findIndex((y) => key(y) === key(x)) === i)
  await setMeta(META_KEY, {
    periods: [...s.periods].sort((a, b) => a.n - b.n).map((p) => ({ n: p.n, start: p.start, end: p.end })),
    days,
    teachers: uniq(s.teachers.map((t) => ({ id: t.id || uid('tch'), short: t.short.trim().slice(0, 12), name: t.name.trim().slice(0, 80) })), (t) => t.short.toLowerCase()),
    rooms: uniq(s.rooms.map((r) => ({ id: r.id || uid('room'), name: r.name.trim().slice(0, 40) })), (r) => r.name.toLowerCase()),
    weekAMonday: s.weekAMonday ? startOfWeek(s.weekAMonday) : null,
  } satisfies TimetableSettings)
}

/**
 * Sets (or switches off) the A/B week reference. Lessons marked "A-Woche"/"B-Woche" keep their label and are
 * moved to the matching weeks, so correcting the reference never leaves a lesson in the wrong week.
 */
export async function setWeekAMonday(monday: DayKey | null): Promise<number> {
  const settings = await getTimetableSettings()
  const ref = monday ? startOfWeek(monday) : null
  let moved = 0
  await db.transaction('rw', db.events, db.meta, async () => {
    await saveTimetableSettings({ ...settings, weekAMonday: ref })
    if (!ref) return
    const series = await db.events.where('category').equals('lesson').filter((e) => !!e.recurrence && !!e.weekType).toArray()
    for (const e of series) {
      if (weekTypeOf(e.date, ref) === e.weekType) continue
      moved++
      await db.events.update(e.id, { date: addDays(e.date, 7), recurrence: { ...e.recurrence!, exceptions: e.recurrence!.exceptions.map((d) => addDays(d, 7)) }, updatedAt: nowIso() })
    }
  })
  return moved
}

/** Remembers new teachers/rooms so they are offered next time (the lists stay editable in "Stammdaten"). */
async function rememberNames(teacher: string, room: string) {
  const s = await getTimetableSettings()
  const t = teacher.trim()
  const r = room.trim()
  let changed = false
  if (t && !s.teachers.some((x) => x.short.toLowerCase() === t.toLowerCase())) {
    s.teachers.push({ id: uid('tch'), short: t.slice(0, 12), name: '' })
    changed = true
  }
  if (r && !s.rooms.some((x) => x.name.toLowerCase() === r.toLowerCase())) {
    s.rooms.push({ id: uid('room'), name: r.slice(0, 40) })
    changed = true
  }
  if (changed) await setMeta(META_KEY, s)
}

// ───────────────────────── Snapshots for undo ─────────────────────────

async function snapshot(ids: ID[]): Promise<() => Promise<void>> {
  const before = await db.events.bulkGet(ids)
  return async () => {
    await db.transaction('rw', db.events, async () => {
      for (const [i, id] of ids.entries()) {
        const b = before[i]
        if (b) await db.events.put(b)
        else await db.events.delete(id)
      }
    })
  }
}

// ───────────────────────── Lessons ─────────────────────────

export interface LessonInput {
  subjectId: ID | null
  /** 1 = Monday … 6 = Saturday */
  weekday: number
  start: string
  end: string
  period: number | null
  periodEnd: number | null
  teacher: string
  location: string
  weekType: WeekType | null
  /** First week the lesson takes place in (any day of that week). */
  validFrom: DayKey
  validUntil: DayKey | null
  note: string
  exceptions?: DayKey[]
}

export const emptyLesson = (patch: Partial<LessonInput> = {}): LessonInput => ({
  subjectId: null, weekday: 1, start: '08:00', end: '08:45', period: null, periodEnd: null, teacher: '', location: '', weekType: null,
  validFrom: dayKey(), validUntil: null, note: '', ...patch,
})

async function lessonTitle(subjectId: ID | null) {
  return (subjectId ? (await db.subjects.get(subjectId))?.name : undefined) ?? 'Unterricht'
}

/** Checks the input and turns it into a weekly event series. */
async function lessonEvent(input: LessonInput, settings: TimetableSettings, from: DayKey = input.validFrom): Promise<EventInput> {
  if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 6) throw new ValidationError('Bitte wähle einen Schultag (Montag bis Samstag).')
  if (!isTime(input.start) || !isTime(input.end)) throw new ValidationError('Bitte gib Beginn und Ende an (z. B. 07:45).')
  if (input.end <= input.start) throw new ValidationError('Das Ende muss nach dem Beginn liegen.')
  if (!isDayKey(from)) throw new ValidationError('Ungültiges Startdatum.')
  if (input.validUntil !== null && !isDayKey(input.validUntil)) throw new ValidationError('Ungültiges Enddatum.')
  if (input.weekType && !settings.weekAMonday) throw new ValidationError('Lege zuerst unter „Stammdaten → Wochen“ fest, ob diese Woche eine A- oder B-Woche ist.')
  const date = alignedStart(from, input.weekday % 7, input.weekType, settings.weekAMonday)
  if (input.validUntil && input.validUntil < date) throw new ValidationError('In diesem Zeitraum findet die Stunde nie statt – prüfe „gültig bis“.')
  return emptyEvent(date, {
    title: await lessonTitle(input.subjectId), category: 'lesson', subjectId: input.subjectId, allDay: false, start: input.start, end: input.end,
    location: input.location, teacher: input.teacher, description: input.note, period: input.period, periodEnd: input.periodEnd ?? input.period,
    weekType: input.weekType, recurrence: lessonRecurrence(input.weekType, input.validUntil, (input.exceptions ?? []).filter((d) => isDayKey(d))),
  })
}

export async function createLesson(input: LessonInput): Promise<ID> {
  const settings = await getTimetableSettings()
  const clean = await validateEvent(await lessonEvent(input, settings))
  const id = uid('ev')
  await db.events.add({ ...clean, id, createdAt: nowIso(), updatedAt: nowIso() })
  await rememberNames(input.teacher, input.location)
  pushUndo('Stunde erstellt', async () => {
    await db.events.delete(id)
  })
  return id
}

/** The form values of an existing lesson (for the editor). */
export function lessonToInput(e: CalendarEvent): LessonInput {
  return {
    subjectId: e.subjectId, weekday: weekday(e.date) || 1, start: e.start ?? '08:00', end: e.end ?? '08:45', period: e.period ?? null, periodEnd: e.periodEnd ?? e.period ?? null,
    teacher: e.teacher, location: e.location, weekType: e.weekType ?? null, validFrom: e.date, validUntil: e.recurrence?.until ?? null, note: e.description,
  }
}

export type LessonScope = 'all' | 'following'

/**
 * Changes a regular lesson. "all": the whole series (past weeks included). "following": from the week of
 * `occurrence` on – earlier weeks keep the old lesson (useful when the timetable changes mid-year).
 */
export async function updateLesson(seriesId: ID, input: LessonInput, scope: LessonScope, occurrence: DayKey): Promise<ID> {
  const settings = await getTimetableSettings()
  const series = await db.events.get(seriesId)
  if (!series || series.category !== 'lesson') throw new ValidationError('Diese Stunde gibt es nicht mehr.')
  const overrides = await db.events.where('seriesId').equals(seriesId).toArray()
  const samePattern = weekday(series.date) === input.weekday % 7 && (series.weekType ?? null) === input.weekType

  if (!series.recurrence) {
    // single (extra) lesson: same week, possibly another day
    const date = addDays(startOfWeek(series.date), (input.weekday + 6) % 7)
    const base = await lessonEvent({ ...input, validFrom: date, validUntil: null }, settings, date)
    const clean = await validateEvent({ ...base, recurrence: null, date, lessonChange: series.lessonChange, status: series.status })
    const revert = await snapshot([seriesId])
    await db.events.put({ ...series, ...clean, id: seriesId, updatedAt: nowIso() })
    await rememberNames(input.teacher, input.location)
    pushUndo('Stunde geändert', revert)
    return seriesId
  }

  const cut = startOfWeek(occurrence)
  if (scope === 'all' || series.date >= cut) {
    const base = await lessonEvent({ ...input, exceptions: samePattern ? series.recurrence.exceptions : [] }, settings, scope === 'all' ? input.validFrom : series.date)
    const clean = await validateEvent({ ...base, completedDates: samePattern ? series.completedDates : [] })
    const revert = await snapshot([seriesId, ...overrides.map((o) => o.id)])
    await db.transaction('rw', db.events, async () => {
      await db.events.put({ ...clean, id: seriesId, createdAt: series.createdAt, updatedAt: nowIso() })
      // changes for single days only make sense while the lesson stays on the same day
      if (!samePattern) await db.events.bulkDelete(overrides.map((o) => o.id))
    })
    await rememberNames(input.teacher, input.location)
    pushUndo('Stunde geändert', revert)
    return seriesId
  }

  // from this week on: end the old series, start a new one
  const r = series.recurrence
  const moved = overrides.filter((o) => (o.originalDate ?? o.date) >= cut)
  const base = await lessonEvent({ ...input, validFrom: cut > input.validFrom ? cut : input.validFrom, exceptions: samePattern ? r.exceptions.filter((d) => d >= cut) : [] }, settings)
  const clean = await validateEvent(base)
  const newId = uid('ev')
  const revert = await snapshot([seriesId, newId, ...moved.map((o) => o.id)])
  await db.transaction('rw', db.events, async () => {
    await db.events.update(seriesId, {
      recurrence: { ...r, until: addDays(cut, -1), count: null, exceptions: r.exceptions.filter((d) => d < cut) },
      completedDates: series.completedDates.filter((d) => d < cut), updatedAt: nowIso(),
    })
    await db.events.add({ ...clean, id: newId, createdAt: nowIso(), updatedAt: nowIso() })
    if (samePattern) for (const o of moved) await db.events.update(o.id, { seriesId: newId, updatedAt: nowIso() })
    else await db.events.bulkDelete(moved.map((o) => o.id))
  })
  await rememberNames(input.teacher, input.location)
  pushUndo('Stunde ab dieser Woche geändert', revert)
  return newId
}

/** Copies a lesson to another day/time (same subject, teacher, room, weeks). */
export async function duplicateLesson(seriesId: ID, target: Pick<LessonInput, 'weekday' | 'start' | 'end' | 'period' | 'periodEnd'>): Promise<ID> {
  const e = await db.events.get(seriesId)
  if (!e) throw new ValidationError('Diese Stunde gibt es nicht mehr.')
  const input = lessonToInput(e)
  return createLesson({ ...input, ...target, validFrom: e.recurrence ? startOfWeek(e.date) : e.date, validUntil: e.recurrence?.until ?? addDays(startOfWeek(e.date), 6) })
}

// ───────────────────────── Changes for one day ─────────────────────────

export interface ChangeInput {
  type: LessonChangeType
  note: string
  subjectId?: ID | null
  teacher?: string
  location?: string
  start?: string
  end?: string
}

/** Marks one lesson as cancelled / substituted / moved to another room. The regular lesson stays untouched. */
export async function setLessonChange(item: CalItem, change: ChangeInput): Promise<ID> {
  if (item.source !== 'event' || item.kind !== 'lesson') throw new ValidationError('Nur Unterrichtsstunden können geändert werden.')
  const ev = await db.events.get(item.refId)
  if (!ev) throw new ValidationError('Diese Stunde gibt es nicht mehr.')
  const origin = ev.recurrence ? ev : ev.seriesId ? ((await db.events.get(ev.seriesId)) ?? ev) : ev
  const before: LessonChange['before'] = ev.lessonChange?.before ?? { subjectId: origin.subjectId, teacher: origin.teacher, location: origin.location, start: origin.start, end: origin.end }
  const subjectId = change.subjectId !== undefined ? change.subjectId : ev.subjectId
  const patch: Partial<CalendarEvent> = {
    status: change.type === 'cancelled' ? 'cancelled' : 'planned', subjectId, title: await lessonTitle(subjectId), teacher: change.teacher ?? ev.teacher,
    location: change.location ?? ev.location, start: change.start ?? ev.start, end: change.end ?? ev.end,
    lessonChange: { type: change.type, note: change.note, before: change.type === 'extra' ? null : before },
  }
  if (ev.recurrence) {
    const override = await validateEvent({ ...ev, ...patch, id: undefined, date: item.date, recurrence: null, completedDates: [], seriesId: ev.id, originalDate: item.date, source: 'manual', pinned: false } as EventInput)
    const id = uid('ev')
    const revert = await snapshot([ev.id, id])
    await db.transaction('rw', db.events, async () => {
      await db.events.update(ev.id, { recurrence: { ...ev.recurrence!, exceptions: [...new Set([...ev.recurrence!.exceptions, item.date])].sort() }, updatedAt: nowIso() })
      await db.events.add({ ...override, id, createdAt: nowIso(), updatedAt: nowIso() })
    })
    pushUndo('Stunde für diesen Tag geändert', revert)
    return id
  }
  const clean = await validateEvent({ ...ev, ...patch } as EventInput)
  const revert = await snapshot([ev.id])
  await db.events.put({ ...ev, ...clean, id: ev.id, updatedAt: nowIso() })
  pushUndo('Stunde für diesen Tag geändert', revert)
  return ev.id
}

/** Removes a change: the regular lesson is shown again for that day. */
export async function clearLessonChange(item: CalItem) {
  const ev = await db.events.get(item.refId)
  if (!ev) return
  if (ev.seriesId && ev.originalDate) {
    const series = await db.events.get(ev.seriesId)
    const revert = await snapshot([ev.id, ev.seriesId])
    await db.transaction('rw', db.events, async () => {
      await db.events.delete(ev.id)
      if (series?.recurrence) await db.events.update(series.id, { recurrence: { ...series.recurrence, exceptions: series.recurrence.exceptions.filter((d) => d !== ev.originalDate) }, updatedAt: nowIso() })
    })
    pushUndo('Änderung aufgehoben', revert)
    return
  }
  const b = ev.lessonChange?.before
  const revert = await snapshot([ev.id])
  const rest = { ...ev }
  delete rest.lessonChange
  await db.events.put({ ...rest, status: 'planned', ...(b ? { subjectId: b.subjectId, title: await lessonTitle(b.subjectId), teacher: b.teacher, location: b.location, start: b.start ?? ev.start, end: b.end ?? ev.end } : {}), updatedAt: nowIso() })
  pushUndo('Änderung aufgehoben', revert)
}

/** A one-off lesson on a given day (e.g. extra lesson, excursion block). */
export async function addExtraLesson(date: DayKey, input: Omit<LessonInput, 'weekday' | 'validFrom' | 'validUntil' | 'weekType'>): Promise<ID> {
  if (!isDayKey(date)) throw new ValidationError('Ungültiges Datum.')
  const settings = await getTimetableSettings()
  const base = await lessonEvent({ ...input, weekday: weekday(date) || 1, weekType: null, validFrom: date, validUntil: null }, settings, date)
  if (weekday(date) === 0) throw new ValidationError('Sonntags gibt es keinen Unterricht im Stundenplan.')
  const clean = await validateEvent({ ...base, date, recurrence: null, lessonChange: { type: 'extra', note: input.note, before: null } })
  const id = uid('ev')
  await db.events.add({ ...clean, id, createdAt: nowIso(), updatedAt: nowIso() })
  pushUndo('Zusatzstunde erstellt', async () => {
    await db.events.delete(id)
  })
  return id
}

// ───────────────────────── Homework & exams ─────────────────────────

async function lessonItems(from: DayKey, to: DayKey): Promise<CalItem[]> {
  const events = await db.events.where('category').equals('lesson').toArray()
  return buildItems({ events, exams: [], tasks: [], from, to })
}

/** Day of the next lesson of a subject after `after` (within ~3 months). */
export async function findNextLessonDate(subjectId: ID, after: DayKey): Promise<DayKey | null> {
  const items = await lessonItems(addDays(after, 1), addDays(after, 100))
  return nextLessonOf(items, subjectId, after)?.date ?? null
}

export async function addHomework(h: { subjectId: ID | null; title: string; dueDate: DayKey | null; estimateMinutes: number | null; description: string }): Promise<ID> {
  return saveTask(emptyTask({ kind: 'homework', title: h.title, subjectId: h.subjectId, dueDate: h.dueDate, estimateMinutes: h.estimateMinutes, description: h.description }))
}

/** Creates an exam linked to a lesson slot – it then appears in "Prüfungen" and the study planner prepares for it. */
export async function addExamForLesson(x: { subjectId: ID; title: string; type: ExamType; date: DayKey; startTime: string | null; endTime: string | null; location: string; notes: string }): Promise<ID> {
  const planner = await getPlannerSettings()
  const weekdays = planner.windows.map((w, i) => (w ? i : -1)).filter((i) => i >= 0)
  return saveExam({
    subjectId: x.subjectId, title: x.title, type: x.type, date: x.date, topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: 30,
    availableWeekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5, 6], notes: x.notes, gradingScaleId: null, startTime: x.startTime, endTime: x.endTime, location: x.location,
  })
}

/** Copies the school hours from the timetable into the study planner (it never plans study time during lessons anyway). */
export async function applySchoolTimesToPlanner(today: DayKey = dayKey()) {
  const monday = startOfWeek(today)
  const items = await lessonItems(monday, addDays(monday, 13)) // two weeks → A and B weeks
  const regular = items.filter((i) => !i.lessonChange)
  const windows = schoolWindows(regular)
  const planner = await getPlannerSettings()
  await savePlannerSettings({ ...planner, school: windows })
  return windows
}

/** Renames a teacher/room in all lessons (after editing the master data). */
export async function replaceLessonText(field: 'teacher' | 'location', from: string, to: string): Promise<number> {
  if (!from.trim() || from === to) return 0
  const value = to.trim().slice(0, 120)
  return db.events.where('category').equals('lesson').filter((e) => e[field] === from).modify((e) => {
    e[field] = value
    e.updatedAt = nowIso()
  })
}

// ───────────────────────── Import ─────────────────────────

export interface ImportResult {
  created: number
  skipped: number
  subjectsCreated: number
}

/**
 * Saves imported lessons. Subjects are matched by name (case-insensitive) or created; lessons that already
 * exist (same day, time, subject and weeks) are skipped, so importing the same file twice changes nothing.
 */
export async function importLessons(drafts: LessonDraft[], opts: { createSubjects: boolean; weekAMonday?: DayKey | null }): Promise<ImportResult> {
  let settings = await getTimetableSettings()
  if (opts.weekAMonday && !settings.weekAMonday) {
    await saveTimetableSettings({ ...settings, weekAMonday: opts.weekAMonday })
    settings = await getTimetableSettings()
  }
  const subjects = await db.subjects.toArray()
  const byName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]))
  const byShort = new Map(subjects.filter((s) => s.short).map((s) => [s.short!.toLowerCase(), s.id]))
  const createdSubjects: ID[] = []
  const existing = await db.events.where('category').equals('lesson').filter((e) => !!e.recurrence).toArray()
  const events: CalendarEvent[] = []
  let skipped = 0
  for (const d of drafts) {
    let subjectId = byName.get(d.subject.toLowerCase()) ?? byShort.get(d.subject.toLowerCase()) ?? (d.subjectShort ? byShort.get(d.subjectShort.toLowerCase()) : undefined) ?? null
    if (!subjectId && opts.createSubjects) {
      subjectId = await createSubject(d.subject)
      if (d.subjectShort) await db.subjects.update(subjectId, { short: d.subjectShort })
      byName.set(d.subject.toLowerCase(), subjectId)
      createdSubjects.push(subjectId)
    }
    const input: LessonInput = {
      subjectId, weekday: d.weekday, start: d.start, end: d.end, period: d.period, periodEnd: d.periodEnd, teacher: d.teacher, location: d.room,
      weekType: d.weekType && settings.weekAMonday ? d.weekType : null, validFrom: d.validFrom ?? startOfWeek(dayKey()), validUntil: d.validUntil, note: d.note, exceptions: d.exceptions,
    }
    const base = await lessonEvent(input, settings)
    const dup = [...existing, ...events].some((e) =>
      weekday(e.date) === d.weekday && e.start === d.start && e.end === d.end && e.subjectId === subjectId && (e.weekType ?? null) === input.weekType &&
      (!e.recurrence?.until || e.recurrence.until >= base.date) && (!input.validUntil || e.date <= input.validUntil))
    if (dup) {
      skipped++
      continue
    }
    const clean = await validateEvent({ ...base, title: subjectId ? base.title : d.subject })
    events.push({ ...clean, id: uid('ev'), createdAt: nowIso(), updatedAt: nowIso() })
  }
  await db.events.bulkAdd(events)
  const s = await getTimetableSettings()
  for (const d of drafts) {
    if (d.teacher && !s.teachers.some((t) => t.short.toLowerCase() === d.teacher.toLowerCase())) s.teachers.push({ id: uid('tch'), short: d.teacher.slice(0, 12), name: '' })
    if (d.room && !s.rooms.some((r) => r.name.toLowerCase() === d.room.toLowerCase())) s.rooms.push({ id: uid('room'), name: d.room.slice(0, 40) })
  }
  await setMeta(META_KEY, s)
  const ids = events.map((e) => e.id)
  pushUndo(`${ids.length} Stunden importiert`, async () => {
    await db.events.bulkDelete(ids)
    // subjects created by the import go too – unless something else uses them by now
    for (const sid of createdSubjects) if (!(await db.events.where('subjectId').equals(sid).count()) && !(await db.tasks.where('subjectId').equals(sid).count())) await db.subjects.delete(sid)
  })
  return { created: events.length, skipped, subjectsCreated: createdSubjects.length }
}
