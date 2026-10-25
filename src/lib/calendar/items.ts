import type { CalendarEvent, DayKey, Exam, LessonChange, Priority, Task, WeekType } from '@/db/types'
import { addDays } from '../dates'
import { KIND_META, type ItemKind } from './meta'
import { occurrencesInRange, spanDays } from './recurrence'
import { durationMin, fromMin, toMin } from './time'

/** Where the item is stored – needed to edit it in the right place. */
export type ItemSource = 'event' | 'exam' | 'plan' | 'task'

/**
 * One entry as the calendar shows it. Built at render time from events, exams (+ their plan) and tasks –
 * the calendar has no data of its own, so every view always shows the same, current state.
 */
export interface CalItem {
  key: string
  source: ItemSource
  /** Event / exam / task id. */
  refId: string
  /** Plan session id (source "plan"). */
  sessionId?: string
  kind: ItemKind
  title: string
  subjectId: string | null
  customCategoryId: string | null
  /** Day of this occurrence. */
  date: DayKey
  /** Last day (multi-day entries), otherwise = date. */
  endDate: DayKey
  allDay: boolean
  /** True for study sessions that have a day but no time yet. */
  untimed: boolean
  start: string | null
  end: string | null
  minutes: number
  done: boolean
  cancelled: boolean
  priority: Priority
  recurring: boolean
  planner: boolean
  pinned: boolean
  description: string
  location: string
  teacher: string
  topicIds: string[]
  taskId: string | null
  examId: string | null
  checklist: { done: number; total: number }
  /** Deadline (task) – shown as "fällig". */
  deadline: boolean
  /** All-day entry during which no studying is possible (internship day …). */
  blocksStudy?: boolean
  /** Timetable: periods, A/B week, change of this single lesson, series it replaces. */
  period?: number | null
  periodEnd?: number | null
  weekType?: WeekType | null
  lessonChange?: LessonChange | null
  seriesId?: string | null
}

export interface BuildInput {
  events: CalendarEvent[]
  exams: Exam[]
  tasks: Task[]
  from: DayKey
  to: DayKey
}

const priorityFromDifficulty = (d: 1 | 2 | 3): Priority => (d === 3 ? 'high' : d === 2 ? 'medium' : 'low')

export function eventOccurrences(e: CalendarEvent, from: DayKey, to: DayKey): CalItem[] {
  const span = spanDays(e.date, e.endDate)
  return occurrencesInRange(e.date, e.recurrence, from, to, span).map((d) => ({
    key: e.recurrence ? `ev:${e.id}:${d}` : `ev:${e.id}`,
    source: 'event',
    refId: e.id,
    kind: e.category,
    title: e.title,
    subjectId: e.subjectId,
    customCategoryId: e.customCategoryId,
    date: d,
    endDate: addDays(d, span),
    allDay: e.allDay,
    untimed: false,
    start: e.allDay ? null : e.start,
    end: e.allDay ? null : e.end,
    minutes: e.allDay ? (e.workloadMinutes ?? 0) : durationMin(e.start, e.end),
    done: e.recurrence ? e.completedDates.includes(d) : e.status === 'done',
    cancelled: e.status === 'cancelled',
    priority: e.priority,
    recurring: !!e.recurrence || !!e.seriesId,
    planner: e.source === 'planner',
    pinned: e.pinned,
    description: e.description,
    location: e.location,
    teacher: e.teacher,
    topicIds: e.topicIds,
    taskId: e.taskId,
    examId: e.examId,
    checklist: { done: e.checklist.filter((c) => c.done).length, total: e.checklist.length },
    deadline: false,
    blocksStudy: e.blocksStudy,
    period: e.period ?? null,
    periodEnd: e.periodEnd ?? e.period ?? null,
    weekType: e.weekType ?? null,
    lessonChange: e.lessonChange ?? null,
    seriesId: e.seriesId,
  }))
}

export function examItem(x: Exam): CalItem {
  const timed = !!x.startTime
  const end = x.endTime ?? (x.startTime ? fromMin(toMin(x.startTime) + 45) : null)
  return {
    key: `exam:${x.id}`, source: 'exam', refId: x.id, kind: 'exam', title: x.title, subjectId: x.subjectId, customCategoryId: null,
    date: x.date, endDate: x.date, allDay: !timed, untimed: false, start: x.startTime ?? null, end: timed ? end : null,
    minutes: timed ? durationMin(x.startTime ?? null, end) : 0, done: false, cancelled: false, priority: priorityFromDifficulty(x.difficulty),
    recurring: false, planner: false, pinned: false, description: x.notes, location: x.location ?? '', teacher: '', topicIds: x.topicIds,
    taskId: null, examId: x.id, checklist: { done: 0, total: 0 }, deadline: false,
  }
}

export function planItems(x: Exam, from: DayKey, to: DayKey): CalItem[] {
  return x.plan
    .filter((s) => s.date >= from && s.date <= to)
    .map((s) => {
      const start = s.start ?? null
      return {
        key: `plan:${x.id}:${s.id}`, source: 'plan', refId: x.id, sessionId: s.id, kind: 'study', title: s.title, subjectId: x.subjectId,
        customCategoryId: null, date: s.date, endDate: s.date, allDay: !start, untimed: !start, start, end: start ? fromMin(toMin(start) + s.minutes) : null,
        minutes: s.minutes, done: s.done, cancelled: false, priority: 'medium', recurring: false, planner: true, pinned: !!s.pinned,
        description: s.description, location: '', teacher: '', topicIds: s.topicIds, taskId: null, examId: x.id, checklist: { done: 0, total: 0 }, deadline: false,
      } satisfies CalItem
    })
}

export function taskItem(t: Task): CalItem | null {
  if (!t.dueDate) return null
  return {
    key: `task:${t.id}`, source: 'task', refId: t.id, kind: t.kind, title: t.title, subjectId: t.subjectId, customCategoryId: null,
    date: t.dueDate, endDate: t.dueDate, allDay: true, untimed: false, start: t.dueTime, end: null, minutes: t.estimateMinutes ?? 0,
    done: t.status === 'done', cancelled: false, priority: t.priority, recurring: false, planner: false, pinned: false, description: t.description,
    location: '', teacher: '', topicIds: t.topicIds, taskId: t.id, examId: null,
    checklist: { done: t.subtasks.filter((c) => c.done).length, total: t.subtasks.length }, deadline: true,
  }
}

export function compareItems(a: CalItem, b: CalItem): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date)
  const rank = (i: CalItem) => (i.kind === 'exam' ? 0 : i.deadline ? 1 : i.allDay ? 2 : 3)
  if (rank(a) !== rank(b)) return rank(a) - rank(b)
  return (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title, 'de')
}

export function buildItems({ events, exams, tasks, from, to }: BuildInput): CalItem[] {
  const out: CalItem[] = []
  for (const e of events) out.push(...eventOccurrences(e, from, to))
  for (const x of exams) {
    if (x.date >= from && x.date <= to) out.push(examItem(x))
    out.push(...planItems(x, from, to))
  }
  for (const t of tasks) {
    const it = taskItem(t)
    if (it && it.date >= from && it.date <= to) out.push(it)
  }
  return out.sort(compareItems)
}

/** Items that touch a given day (multi-day entries appear on each of their days). */
export const itemsOnDay = (items: CalItem[], day: DayKey) => items.filter((i) => i.date <= day && i.endDate >= day)

export const isStudyItem = (i: CalItem) => KIND_META[i.kind].study

export function isOverdue(i: CalItem, today: DayKey): boolean {
  if (i.done || i.cancelled) return false
  if (i.deadline) return i.date < today
  return (i.source === 'plan' || (i.source === 'event' && (i.kind === 'study' || i.kind === 'flashcards'))) && i.endDate < today
}
