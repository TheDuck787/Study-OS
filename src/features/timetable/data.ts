import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import type { DayKey, Exam, Subject, Task, TimetableSettings } from '@/db/types'
import { getTimetableSettings } from '@/db/timetable'
import { buildItems, type CalItem } from '@/lib/calendar/items'
import { subjectColorVar } from '@/lib/colors'
import { addDays, dayKey, startOfWeek, weekday } from '@/lib/dates'
import { isLesson } from '@/lib/timetable/core'

/** Everything the timetable shows, live from IndexedDB (the same records the calendar and planner use). */
export function useTimetableData() {
  const settings = useLiveQuery(() => getTimetableSettings(), [])
  const events = useLiveQuery(() => db.events.where('category').equals('lesson').toArray(), [])
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const exams = useLiveQuery(() => db.exams.toArray(), [])
  const ready = !!(settings && events && subjects && tasks && exams)
  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s])), [subjects])
  return {
    ready, settings: settings as TimetableSettings, events: events ?? [], subjects: subjects ?? [], subjectMap, tasks: tasks ?? [], exams: exams ?? [],
  }
}

export type TimetableData = ReturnType<typeof useTimetableData>

export function useLessons(data: TimetableData, from: DayKey, to: DayKey): CalItem[] {
  return useMemo(() => (data.ready ? buildItems({ events: data.events, exams: [], tasks: [], from, to }).filter(isLesson) : []), [data.ready, data.events, from, to])
}

export const lessonColor = (subjectId: string | null, subjects: Map<string, Subject>) => {
  const s = subjectId ? subjects.get(subjectId) : undefined
  return s ? subjectColorVar(s.color) : 'var(--fg-subtle)'
}

/** Open homework due on a day for a subject (shown on the lesson card). */
export const homeworkFor = (tasks: Task[], subjectId: string | null, day: DayKey) =>
  subjectId ? tasks.filter((t) => t.subjectId === subjectId && t.dueDate === day && t.kind !== 'todo') : []

export const examsFor = (exams: Exam[], subjectId: string | null, day: DayKey) => (subjectId ? exams.filter((x) => x.subjectId === subjectId && x.date === day) : [])

/** On weekends the timetable opens on the coming week (like WebUntis). */
export function initialCursor(days: number[], today: DayKey = dayKey()): DayKey {
  const wd = weekday(today)
  if (days.includes(wd)) return today
  if (wd === 0 || wd === 6) return addDays(startOfWeek(today), 7 + ((Math.min(...days) + 6) % 7))
  return today
}

export function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked – the choice just is not remembered */
  }
}
