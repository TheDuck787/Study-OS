import { db } from './index'
import type { CalendarEvent, ChecklistItem, DayKey, EventCustomCategory, Exam, ID, PlannerSettings, PlanSession, Recurrence, Task } from './types'
import { markPlanSession, requireText, setMeta, getMeta, ValidationError } from './repo'
import { uid, nowIso } from '@/lib/id'
import { addDays, dayKey, diffDays } from '@/lib/dates'
import { isDayKey, isTime, toMin, fromMin } from '@/lib/calendar/time'
import { EVENT_CATEGORIES } from '@/lib/calendar/meta'
import { DEFAULT_PLANNER_SETTINGS, type PlanProposal, applyProposal } from '@/lib/calendar/planner'
import type { CalItem } from '@/lib/calendar/items'
import { pushUndo } from '@/lib/undo'

/**
 * Calendar & task storage. Exams keep living in `exams` (with their plan); everything the calendar shows is
 * derived from `events`, `exams` and `tasks`, so there is exactly one place for every piece of information.
 */

export type EventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'completedDates' | 'seriesId' | 'originalDate' | 'source' | 'pinned'> &
  Partial<Pick<CalendarEvent, 'id' | 'completedDates' | 'seriesId' | 'originalDate' | 'source' | 'pinned'>>

const PRIORITIES = ['low', 'medium', 'high']

export function emptyEvent(date: DayKey, patch: Partial<CalendarEvent> = {}): EventInput {
  return {
    title: '', category: 'appointment', customCategoryId: null, subjectId: null, date, endDate: null, allDay: false, start: '15:00', end: '16:00',
    priority: 'medium', status: 'planned', description: '', location: '', teacher: '', topicIds: [], materialIds: [], deckId: null, taskId: null,
    examId: null, workloadMinutes: null, reminderMinutes: null, checklist: [], recurrence: null, blocksStudy: false, ...patch,
  }
}

function cleanChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((c) => ({ id: c.id || uid('chk'), text: c.text.trim().slice(0, 200), done: !!c.done })).filter((c) => c.text)
}

export function validateRecurrence(r: Recurrence | null, start: DayKey): Recurrence | null {
  if (!r) return null
  if (!['daily', 'weekly', 'monthly'].includes(r.freq)) throw new ValidationError('Unbekannte Wiederholung.')
  const interval = Math.round(r.interval)
  if (!(interval >= 1 && interval <= 52)) throw new ValidationError('Der Abstand der Wiederholung muss zwischen 1 und 52 liegen.')
  if (r.until !== null && (!isDayKey(r.until) || r.until < start)) throw new ValidationError('Das Ende der Wiederholung muss ein gültiges Datum nach dem Start sein.')
  if (r.count !== null && !(Number.isInteger(r.count) && r.count >= 1 && r.count <= 500)) throw new ValidationError('Die Anzahl der Wiederholungen muss zwischen 1 und 500 liegen.')
  if (r.byWeekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new ValidationError('Ungültiger Wochentag in der Wiederholung.')
  return { freq: r.freq, interval, byWeekday: [...new Set(r.byWeekday)].sort(), until: r.until, count: r.count, exceptions: [...new Set(r.exceptions.filter(isDayKey))].sort() }
}

function validateTimes(allDay: boolean, start: string | null, end: string | null) {
  if (allDay) return { start: null, end: null }
  if (!isTime(start) || !isTime(end)) throw new ValidationError('Bitte gib eine gültige Start- und Endzeit an (z. B. 14:30).')
  if (toMin(end) <= toMin(start)) throw new ValidationError('Die Endzeit muss nach der Startzeit liegen.')
  return { start, end }
}

export async function validateEvent(e: EventInput): Promise<Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>> {
  const title = requireText(e.title, 'Der Titel', 120)
  if (!EVENT_CATEGORIES.includes(e.category)) throw new ValidationError('Unbekannter Eintragstyp.')
  if (e.category === 'custom' && (!e.customCategoryId || !(await db.eventCategories.get(e.customCategoryId)))) throw new ValidationError('Bitte wähle einen eigenen Typ aus.')
  if (!isDayKey(e.date)) throw new ValidationError('Bitte gib ein gültiges Datum an.')
  if (e.endDate !== null && (!isDayKey(e.endDate) || e.endDate < e.date)) throw new ValidationError('Das Enddatum darf nicht vor dem Startdatum liegen.')
  if (e.endDate && e.endDate !== e.date && !e.allDay) throw new ValidationError('Mehrtägige Einträge müssen ganztägig sein.')
  const { start, end } = validateTimes(e.allDay, e.start, e.end)
  if (!PRIORITIES.includes(e.priority)) throw new ValidationError('Ungültige Priorität.')
  if (e.subjectId && !(await db.subjects.get(e.subjectId))) throw new ValidationError('Das Fach gibt es nicht mehr.')
  if (e.reminderMinutes !== null && !(e.reminderMinutes >= 0 && e.reminderMinutes <= 20160)) throw new ValidationError('Ungültige Erinnerung.')
  if (e.workloadMinutes !== null && !(e.workloadMinutes >= 1 && e.workloadMinutes <= 1440)) throw new ValidationError('Der Aufwand muss zwischen 1 und 1440 Minuten liegen.')
  const recurrence = validateRecurrence(e.recurrence, e.date)
  return {
    title, category: e.category, customCategoryId: e.category === 'custom' ? e.customCategoryId : null, subjectId: e.subjectId, date: e.date,
    endDate: e.endDate && e.endDate !== e.date ? e.endDate : null, allDay: e.allDay, start, end, priority: e.priority, status: e.status,
    description: e.description.trim().slice(0, 5000), location: e.location.trim().slice(0, 120), teacher: e.teacher.trim().slice(0, 120),
    topicIds: [...new Set(e.topicIds)], materialIds: [...new Set(e.materialIds)], deckId: e.deckId, taskId: e.taskId, examId: e.examId,
    workloadMinutes: e.workloadMinutes, reminderMinutes: e.reminderMinutes, checklist: cleanChecklist(e.checklist), recurrence,
    completedDates: recurrence ? (e.completedDates ?? []) : [], seriesId: e.seriesId ?? null, originalDate: e.originalDate ?? null,
    source: e.source ?? 'manual', pinned: e.pinned ?? false, blocksStudy: e.blocksStudy,
  }
}

// ───────────────────────── Undo ─────────────────────────

type SnapTable = 'events' | 'tasks' | 'exams'
async function capture(entries: [SnapTable, ID][]): Promise<() => Promise<void>> {
  const snaps = await Promise.all(entries.map(async ([t, id]) => ({ t, id, before: await db.table(t).get(id) })))
  return async () => {
    await db.transaction('rw', db.events, db.tasks, db.exams, async () => {
      for (const s of snaps) {
        if (s.before) await db.table(s.t).put(s.before)
        else await db.table(s.t).delete(s.id)
      }
    })
  }
}

// ───────────────────────── Events ─────────────────────────

export async function saveEvent(input: EventInput, opts: { undoLabel?: string } = {}): Promise<ID> {
  const clean = await validateEvent(input)
  const id = input.id ?? uid('ev')
  const existing = input.id ? await db.events.get(input.id) : undefined
  const revert = await capture([['events', id]])
  // A planner block the student edits by hand is never moved by the planner again.
  const pinned = existing?.source === 'planner' ? true : clean.pinned
  await db.events.put({ ...clean, pinned, id, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso() })
  pushUndo(opts.undoLabel ?? (existing ? 'Eintrag geändert' : 'Eintrag erstellt'), revert)
  return id
}

export type SeriesScope = 'single' | 'following' | 'all'

/** Saves changes to one occurrence of a recurring event with the chosen scope. */
export async function saveOccurrence(seriesId: ID, occurrence: DayKey, input: EventInput, scope: SeriesScope): Promise<ID> {
  const series = await db.events.get(seriesId)
  if (!series?.recurrence) return saveEvent({ ...input, id: seriesId })
  const revert = await capture([['events', seriesId]])
  if (scope === 'all' || (scope === 'following' && occurrence === series.date)) {
    const shift = diffDays(occurrence, input.date)
    const date = addDays(series.date, shift)
    const recurrence = input.recurrence ? { ...input.recurrence, exceptions: series.recurrence.exceptions.map((d) => addDays(d, shift)), until: input.recurrence.until } : null
    const clean = await validateEvent({ ...input, date, endDate: input.endDate ? addDays(input.endDate, diffDays(input.date, date)) : null, recurrence, completedDates: series.completedDates })
    await db.events.put({ ...series, ...clean, id: series.id, updatedAt: nowIso() })
    pushUndo('Serie geändert', revert)
    return series.id
  }
  if (scope === 'single') {
    const single = await validateEvent({ ...input, recurrence: null, seriesId: series.id, originalDate: occurrence, status: series.completedDates.includes(occurrence) ? 'done' : input.status })
    const id = uid('ev')
    await db.transaction('rw', db.events, async () => {
      await db.events.update(series.id, { recurrence: { ...series.recurrence!, exceptions: [...series.recurrence!.exceptions, occurrence].sort() }, updatedAt: nowIso() })
      await db.events.add({ ...single, id, createdAt: nowIso(), updatedAt: nowIso() })
    })
    pushUndo('Termin geändert', async () => {
      await db.events.delete(id)
      await revert()
    })
    return id
  }
  // following: end the old series the day before, start a new one
  const r = series.recurrence
  const next = await validateEvent({
    ...input,
    recurrence: input.recurrence ? { ...input.recurrence, exceptions: r.exceptions.filter((d) => d >= occurrence) } : null,
    completedDates: series.completedDates.filter((d) => d >= occurrence),
  })
  const id = uid('ev')
  await db.transaction('rw', db.events, async () => {
    await db.events.update(series.id, {
      recurrence: { ...r, until: addDays(occurrence, -1), count: null, exceptions: r.exceptions.filter((d) => d < occurrence) },
      completedDates: series.completedDates.filter((d) => d < occurrence),
      updatedAt: nowIso(),
    })
    await db.events.add({ ...next, id, createdAt: nowIso(), updatedAt: nowIso() })
  })
  pushUndo('Serie ab hier geändert', async () => {
    await db.events.delete(id)
    await revert()
  })
  return id
}

export async function deleteEvent(id: ID, opts: { scope?: SeriesScope; occurrence?: DayKey } = {}) {
  const e = await db.events.get(id)
  if (!e) return
  const overrides = e.recurrence ? await db.events.where('seriesId').equals(id).toArray() : []
  const revert = await capture([['events', id], ...overrides.map((o) => ['events', o.id] as [SnapTable, ID])])
  const scope = e.recurrence ? (opts.scope ?? 'all') : 'all'
  const occ = opts.occurrence ?? e.date
  if (scope === 'all' || (scope === 'following' && occ <= e.date)) {
    await db.transaction('rw', db.events, async () => {
      await db.events.bulkDelete(overrides.map((o) => o.id))
      await db.events.delete(id)
    })
  } else if (scope === 'single') {
    await db.events.update(id, { recurrence: { ...e.recurrence!, exceptions: [...new Set([...e.recurrence!.exceptions, occ])].sort() }, updatedAt: nowIso() })
  } else {
    await db.transaction('rw', db.events, async () => {
      await db.events.update(id, { recurrence: { ...e.recurrence!, until: addDays(occ, -1), count: null }, completedDates: e.completedDates.filter((d) => d < occ), updatedAt: nowIso() })
      await db.events.bulkDelete(overrides.filter((o) => (o.originalDate ?? o.date) >= occ).map((o) => o.id))
    })
  }
  pushUndo('Eintrag gelöscht', revert)
}

// ───────────────────────── Generic item actions (calendar) ─────────────────────────

/** Moves any calendar entry to another day and/or start time, keeping its duration and all its data. */
export async function moveItem(item: CalItem, toDate: DayKey, toStart?: string | null) {
  if (!isDayKey(toDate)) throw new ValidationError('Ungültiges Datum.')
  const duration = item.start && item.end ? toMin(item.end) - toMin(item.start) : item.minutes || 30
  const start = toStart === undefined ? item.start : toStart
  const end = start ? fromMin(Math.min(24 * 60 - 1, toMin(start) + duration)) : null
  if (start && toMin(start) + duration > 24 * 60 - 1) throw new ValidationError('Der Eintrag würde über Mitternacht gehen.')
  if (item.source === 'event') {
    const e = await db.events.get(item.refId)
    if (!e) return
    if (e.recurrence) {
      // moving one occurrence of a series = exception + separate entry (the rest of the series stays)
      return saveOccurrence(e.id, item.date, { ...e, date: toDate, endDate: e.endDate ? addDays(toDate, diffDays(e.date, e.endDate)) : null, allDay: !start && e.allDay, start: start ?? e.start, end: end ?? e.end }, 'single')
    }
    const revert = await capture([['events', e.id]])
    await db.events.update(e.id, {
      date: toDate, endDate: e.endDate ? addDays(toDate, diffDays(e.date, e.endDate)) : null, start: e.allDay && !toStart ? null : start, end: e.allDay && !toStart ? null : end,
      allDay: e.allDay && !toStart, pinned: e.source === 'planner' ? true : e.pinned, updatedAt: nowIso(),
    })
    pushUndo('Eintrag verschoben', revert)
  } else if (item.source === 'plan') {
    await updatePlanSession(item.refId, item.sessionId!, { date: toDate, start: start ?? null, pinned: true }, 'Lerneinheit verschoben')
  } else if (item.source === 'exam') {
    const x = await db.exams.get(item.refId)
    if (!x) return
    const revert = await capture([['exams', x.id]])
    await db.exams.update(x.id, { date: toDate, startTime: start ?? x.startTime ?? null, endTime: start ? end : (x.endTime ?? null) })
    pushUndo('Prüfung verschoben', revert)
  } else {
    const t = await db.tasks.get(item.refId)
    if (!t) return
    const revert = await capture([['tasks', t.id]])
    await db.tasks.update(t.id, { dueDate: toDate, dueTime: toStart === undefined ? t.dueTime : (toStart ?? null), updatedAt: nowIso() })
    pushUndo('Frist verschoben', revert)
  }
}

/** Changes the end time of a timed entry (drag the lower edge). */
export async function resizeItem(item: CalItem, newEnd: string) {
  if (!item.start || !isTime(newEnd) || toMin(newEnd) <= toMin(item.start)) throw new ValidationError('Die Endzeit muss nach der Startzeit liegen.')
  if (item.source === 'event') {
    const e = await db.events.get(item.refId)
    if (!e) return
    if (e.recurrence) return saveOccurrence(e.id, item.date, { ...e, date: item.date, end: newEnd }, 'single')
    const revert = await capture([['events', e.id]])
    await db.events.update(e.id, { end: newEnd, pinned: e.source === 'planner' ? true : e.pinned, updatedAt: nowIso() })
    pushUndo('Dauer geändert', revert)
  } else if (item.source === 'plan') {
    await updatePlanSession(item.refId, item.sessionId!, { minutes: toMin(newEnd) - toMin(item.start), pinned: true }, 'Dauer geändert')
  } else if (item.source === 'exam') {
    const revert = await capture([['exams', item.refId]])
    await db.exams.update(item.refId, { endTime: newEnd })
    pushUndo('Dauer geändert', revert)
  }
}

export async function setItemDone(item: CalItem, done: boolean) {
  if (item.source === 'event') {
    const e = await db.events.get(item.refId)
    if (!e) return
    if (e.recurrence) {
      const set = new Set(e.completedDates)
      if (done) set.add(item.date)
      else set.delete(item.date)
      await db.events.update(e.id, { completedDates: [...set].sort(), updatedAt: nowIso() })
    } else await db.events.update(e.id, { status: done ? 'done' : 'planned', updatedAt: nowIso() })
  } else if (item.source === 'plan') {
    await markPlanSession(item.refId, item.sessionId!, done)
  } else if (item.source === 'task') {
    await setTaskDone(item.refId, done, { undo: false })
  } else return
  pushUndo(done ? 'Als erledigt markiert' : 'Wieder offen', () => setItemDone(item, !done).then(() => undefined))
}

/** Duplicates an entry (events and tasks; exams and plan sessions are copied as a free study block). */
export async function duplicateItem(item: CalItem, toDate: DayKey = item.date): Promise<ID | null> {
  if (item.source === 'event') {
    const e = await db.events.get(item.refId)
    if (!e) return null
    return saveEvent({ ...e, id: undefined, date: toDate, endDate: e.endDate ? addDays(toDate, diffDays(e.date, e.endDate)) : null, recurrence: null, completedDates: [], seriesId: null, originalDate: null, status: 'planned', source: 'manual', pinned: false, checklist: e.checklist.map((c) => ({ ...c, id: uid('chk'), done: false })) }, { undoLabel: 'Eintrag dupliziert' })
  }
  if (item.source === 'task') {
    const t = await db.tasks.get(item.refId)
    if (!t) return null
    return saveTask({ ...t, id: undefined, dueDate: toDate, status: 'open', subtasks: t.subtasks.map((s) => ({ ...s, id: uid('chk'), done: false })) })
  }
  return saveEvent(emptyEvent(toDate, { title: item.title, category: 'study', subjectId: item.subjectId, topicIds: item.topicIds, examId: item.examId, allDay: !item.start, start: item.start ?? '15:00', end: item.end ?? (item.start ? fromMin(toMin(item.start) + Math.max(15, item.minutes)) : '16:00') }), { undoLabel: 'Als Lernblock kopiert' })
}

async function updatePlanSession(examId: ID, sessionId: ID, patch: Partial<PlanSession>, label: string) {
  const x = await db.exams.get(examId)
  if (!x) return
  if (patch.date && patch.date >= x.date) throw new ValidationError('Lerneinheiten müssen vor dem Prüfungstag liegen.')
  if (patch.minutes !== undefined && !(patch.minutes >= 5 && patch.minutes <= 600)) throw new ValidationError('Ungültige Dauer.')
  const revert = await capture([['exams', examId]])
  await db.exams.update(examId, { plan: x.plan.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)) })
  pushUndo(label, revert)
}

export async function savePlanSession(examId: ID, sessionId: ID, patch: Pick<PlanSession, 'date' | 'start' | 'minutes' | 'title' | 'description'>) {
  if (!isDayKey(patch.date)) throw new ValidationError('Ungültiges Datum.')
  if (patch.start !== null && !isTime(patch.start)) throw new ValidationError('Ungültige Uhrzeit.')
  await updatePlanSession(examId, sessionId, { ...patch, title: requireText(patch.title, 'Der Titel', 120), pinned: true }, 'Lerneinheit geändert')
}

export async function deletePlanSession(examId: ID, sessionId: ID) {
  const x = await db.exams.get(examId)
  if (!x) return
  const revert = await capture([['exams', examId]])
  await db.exams.update(examId, { plan: x.plan.filter((s) => s.id !== sessionId) })
  pushUndo('Lerneinheit gelöscht', revert)
}

/** Exam fields that the calendar editor may change (the full exam form lives in features/exams). */
export async function updateExamSchedule(id: ID, patch: Partial<Pick<Exam, 'date' | 'startTime' | 'endTime' | 'location' | 'topicConfidence' | 'estimatedPrepMinutes'>>) {
  if (patch.date !== undefined && !isDayKey(patch.date)) throw new ValidationError('Ungültiges Datum.')
  for (const t of [patch.startTime, patch.endTime]) if (t && !isTime(t)) throw new ValidationError('Ungültige Uhrzeit.')
  if (patch.startTime && patch.endTime && toMin(patch.endTime) <= toMin(patch.startTime)) throw new ValidationError('Die Endzeit muss nach der Startzeit liegen.')
  const revert = await capture([['exams', id]])
  await db.exams.update(id, patch)
  pushUndo('Prüfung geändert', revert)
}

// ───────────────────────── Tasks ─────────────────────────

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'doneAt'> & { id?: ID }

export function emptyTask(patch: Partial<Task> = {}): TaskInput {
  return { title: '', description: '', kind: 'homework', subjectId: null, topicIds: [], materialId: null, dueDate: null, dueTime: null, priority: 'medium', estimateMinutes: null, status: 'open', subtasks: [], reminderMinutes: null, ...patch }
}

export async function saveTask(t: TaskInput): Promise<ID> {
  const title = requireText(t.title, 'Der Titel', 160)
  if (!['homework', 'project', 'todo'].includes(t.kind)) throw new ValidationError('Unbekannte Aufgabenart.')
  if (t.dueDate !== null && !isDayKey(t.dueDate)) throw new ValidationError('Bitte gib ein gültiges Fälligkeitsdatum an.')
  if (t.dueTime !== null && (!isTime(t.dueTime) || !t.dueDate)) throw new ValidationError('Eine Uhrzeit braucht ein gültiges Datum.')
  if (!PRIORITIES.includes(t.priority)) throw new ValidationError('Ungültige Priorität.')
  if (t.estimateMinutes !== null && !(t.estimateMinutes >= 5 && t.estimateMinutes <= 6000)) throw new ValidationError('Der Aufwand muss zwischen 5 und 6000 Minuten liegen.')
  if (t.subjectId && !(await db.subjects.get(t.subjectId))) throw new ValidationError('Das Fach gibt es nicht mehr.')
  const id = t.id ?? uid('task')
  const existing = t.id ? await db.tasks.get(t.id) : undefined
  const revert = await capture([['tasks', id]])
  await db.tasks.put({
    ...t, id, title, description: t.description.trim().slice(0, 5000), subtasks: cleanChecklist(t.subtasks), topicIds: [...new Set(t.topicIds)],
    doneAt: t.status === 'done' ? (existing?.doneAt ?? nowIso()) : null, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso(),
  })
  pushUndo(existing ? 'Aufgabe geändert' : 'Aufgabe erstellt', revert)
  return id
}

/** Quick add: "Mathe S. 42 Nr. 3" → homework (due tomorrow unless a date is given). */
export async function quickAddTask(title: string, patch: Partial<Task> = {}): Promise<ID> {
  return saveTask(emptyTask({ title, ...patch }))
}

/**
 * Completes/reopens a task. Open planner sessions after today are removed when the task is done
 * (they are no longer needed); sessions that already happened stay as history.
 */
export async function setTaskDone(id: ID, done: boolean, opts: { undo?: boolean } = {}) {
  const t = await db.tasks.get(id)
  if (!t) return
  const today = dayKey()
  const obsolete = done ? (await db.events.where('taskId').equals(id).toArray()).filter((e) => e.source === 'planner' && !e.pinned && e.status === 'planned' && e.date > today) : []
  const revert = await capture([['tasks', id], ...obsolete.map((e) => ['events', e.id] as [SnapTable, ID])])
  await db.transaction('rw', db.tasks, db.events, async () => {
    await db.tasks.update(id, { status: done ? 'done' : 'open', doneAt: done ? nowIso() : null, updatedAt: nowIso() })
    await db.events.bulkDelete(obsolete.map((e) => e.id))
  })
  if (opts.undo !== false) pushUndo(done ? 'Aufgabe erledigt' : 'Aufgabe wieder offen', revert)
}

export async function toggleSubtask(taskId: ID, subtaskId: ID) {
  const t = await db.tasks.get(taskId)
  if (!t) return
  await db.tasks.update(taskId, { subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)), updatedAt: nowIso() })
}

export async function toggleChecklist(eventId: ID, itemId: ID) {
  const e = await db.events.get(eventId)
  if (!e) return
  await db.events.update(eventId, { checklist: e.checklist.map((s) => (s.id === itemId ? { ...s, done: !s.done } : s)), updatedAt: nowIso() })
}

/** Deletes a task with its scheduled work sessions (the calendar shows them as part of the task). */
export async function deleteTask(id: ID) {
  const sessions = await db.events.where('taskId').equals(id).toArray()
  const revert = await capture([['tasks', id], ...sessions.map((e) => ['events', e.id] as [SnapTable, ID])])
  await db.transaction('rw', db.tasks, db.events, async () => {
    await db.events.bulkDelete(sessions.map((e) => e.id))
    await db.tasks.delete(id)
  })
  pushUndo('Aufgabe gelöscht', revert)
}

/** Plans time for a task: a calendar block linked to the task (the task itself is not copied). */
export async function scheduleTask(taskId: ID, date: DayKey, start: string, minutes: number): Promise<ID> {
  const t = await db.tasks.get(taskId)
  if (!t) throw new ValidationError('Die Aufgabe gibt es nicht mehr.')
  if (!isTime(start)) throw new ValidationError('Ungültige Uhrzeit.')
  const end = toMin(start) + minutes
  if (minutes < 5 || end >= 24 * 60) throw new ValidationError('Ungültige Dauer.')
  return saveEvent(emptyEvent(date, { title: t.title, category: 'study', subjectId: t.subjectId, topicIds: t.topicIds, taskId: t.id, priority: t.priority, start, end: fromMin(end), materialIds: t.materialId ? [t.materialId] : [] }), { undoLabel: 'Aufgabe eingeplant' })
}

// ───────────────────────── Custom categories ─────────────────────────

export async function saveCustomCategory(c: { id?: ID; name: string; color: number }): Promise<ID> {
  const name = requireText(c.name, 'Der Name', 40)
  const id = c.id ?? uid('cat')
  const existing = c.id ? await db.eventCategories.get(c.id) : undefined
  if ((await db.eventCategories.toArray()).some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) throw new ValidationError(`Den Typ „${name}“ gibt es schon.`)
  await db.eventCategories.put({ id, name, color: c.color, createdAt: existing?.createdAt ?? nowIso() } satisfies EventCustomCategory)
  return id
}

export async function deleteCustomCategory(id: ID) {
  await db.transaction('rw', db.eventCategories, db.events, async () => {
    await db.events.filter((e) => e.customCategoryId === id).modify({ category: 'appointment', customCategoryId: null })
    await db.eventCategories.delete(id)
  })
}

// ───────────────────────── Planner ─────────────────────────

export async function getPlannerSettings(): Promise<PlannerSettings> {
  const stored = await getMeta<Partial<PlannerSettings>>('plannerSettings')
  return { ...DEFAULT_PLANNER_SETTINGS, ...(stored ?? {}) }
}

export async function savePlannerSettings(s: PlannerSettings) {
  for (const w of [...s.windows, ...s.school]) {
    if (w && (!isTime(w.from) || !isTime(w.to) || toMin(w.to) <= toMin(w.from))) throw new ValidationError('Jedes Zeitfenster braucht eine Startzeit vor der Endzeit.')
  }
  if (!(s.maxDailyMinutes >= 10 && s.maxDailyMinutes <= 600)) throw new ValidationError('Die Lernzeit pro Tag muss zwischen 10 und 600 Minuten liegen.')
  if (!(s.sessionMaxMinutes >= 10 && s.sessionMaxMinutes <= 180)) throw new ValidationError('Eine Einheit muss zwischen 10 und 180 Minuten lang sein.')
  if (!(s.breakMinutes >= 0 && s.breakMinutes <= 60) || !(s.bufferMinutes >= 0 && s.bufferMinutes <= 120)) throw new ValidationError('Ungültige Pausen- oder Pufferzeit.')
  if (!(s.horizonDays >= 1 && s.horizonDays <= 42)) throw new ValidationError('Der Planungszeitraum muss zwischen 1 und 42 Tagen liegen.')
  await setMeta('plannerSettings', s)
}

/** Writes the approved part of a planner proposal. Manual entries are never part of a proposal. */
export async function commitProposal(p: PlanProposal, selected: Set<string>) {
  const exams = await db.exams.toArray()
  const { examPlans, putEvents, deleteEventIds } = applyProposal(p, selected, exams)
  const revert = await capture([...[...examPlans.keys()].map((id) => ['exams', id] as [SnapTable, ID]), ...putEvents.map((e) => ['events', e.id] as [SnapTable, ID]), ...deleteEventIds.map((id) => ['events', id] as [SnapTable, ID])])
  await db.transaction('rw', db.exams, db.events, async () => {
    for (const [id, plan] of examPlans) await db.exams.update(id, { plan, planGeneratedAt: nowIso() })
    // safety net: never overwrite a manual entry, even if a stale proposal refers to one
    const safe = []
    for (const e of putEvents) {
      const cur = await db.events.get(e.id)
      if (!cur || (cur.source === 'planner' && !cur.pinned)) safe.push(e)
    }
    await db.events.bulkPut(safe)
    const deletable = (await db.events.bulkGet(deleteEventIds)).filter((e): e is CalendarEvent => !!e && e.source === 'planner' && !e.pinned).map((e) => e.id)
    await db.events.bulkDelete(deletable)
  })
  pushUndo('Lernplan übernommen', revert)
  return { exams: examPlans.size, events: putEvents.length, removed: deleteEventIds.length }
}
