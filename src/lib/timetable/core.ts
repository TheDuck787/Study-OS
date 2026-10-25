import type { DayKey, Recurrence, Subject, TimeWindow, TimetablePeriod, TimetableSettings, WeekType } from '@/db/types'
import type { CalItem } from '../calendar/items'
import { addDays, diffDays, parseDay, startOfWeek, weekday } from '../dates'
import { fromMin, isTime, toMin } from '../calendar/time'

/**
 * School timetable (Stundenplan) – pure helpers. Lessons are ordinary calendar events (category "lesson",
 * weekly series), so the calendar, the study planner and the cloud sync see the same data.
 * Nothing here invents a school schedule: the bell schedule, lessons and changes all come from the student.
 */

export const DEFAULT_TIMETABLE_SETTINGS: TimetableSettings = { periods: [], days: [1, 2, 3, 4, 5], teachers: [], rooms: [], weekAMonday: null }

export const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] as const

// ───────────────────────── Bell schedule ─────────────────────────

export interface PeriodGenInput {
  firstStart: string
  /** Length of one lesson in minutes. */
  minutes: number
  count: number
  /** Default gap between lessons. */
  gap: number
  /** Longer breaks: after period n → minutes (replaces the default gap). */
  breaks: Record<number, number>
}

/** Builds a bell schedule from the student's own numbers (first lesson, length, breaks). */
export function generatePeriods(g: PeriodGenInput): TimetablePeriod[] {
  if (!isTime(g.firstStart)) throw new Error('Ungültige Startzeit.')
  const out: TimetablePeriod[] = []
  let t = toMin(g.firstStart)
  for (let n = 1; n <= g.count; n++) {
    const end = t + g.minutes
    if (end > 23 * 60 + 59) break
    out.push({ n, start: fromMin(t), end: fromMin(end) })
    t = end + (g.breaks[n] ?? g.gap)
  }
  return out
}

/** null = fine, otherwise a German error message. */
export function validatePeriods(periods: TimetablePeriod[]): string | null {
  if (periods.length > 20) return 'Höchstens 20 Stunden pro Tag.'
  const seen = new Set<number>()
  let prevEnd = -1
  for (const p of [...periods].sort((a, b) => a.n - b.n)) {
    if (!Number.isInteger(p.n) || p.n < 0 || p.n > 20) return 'Die Stundennummer muss zwischen 0 und 20 liegen.'
    if (seen.has(p.n)) return `Die ${p.n}. Stunde ist doppelt.`
    seen.add(p.n)
    if (!isTime(p.start) || !isTime(p.end)) return `Bitte gib für die ${p.n}. Stunde gültige Zeiten an (z. B. 07:45).`
    if (toMin(p.end) <= toMin(p.start)) return `Bei der ${p.n}. Stunde muss das Ende nach dem Beginn liegen.`
    if (toMin(p.start) < prevEnd) return `Die ${p.n}. Stunde überschneidet sich mit der vorherigen.`
    prevEnd = toMin(p.end)
  }
  return null
}

export const sortPeriods = (periods: TimetablePeriod[]) => [...periods].sort((a, b) => a.n - b.n)

/** Start/end time of a period range ("3.–4. Stunde" → 09:35–11:10). */
export function periodTimes(periods: TimetablePeriod[], from: number, to = from): { start: string; end: string } | null {
  const a = periods.find((p) => p.n === from)
  const b = periods.find((p) => p.n === to)
  if (!a || !b || toMin(b.end) <= toMin(a.start)) return null
  return { start: a.start, end: b.end }
}

/** Period numbers that exactly match a lesson's times (null if the lesson does not follow the bell schedule). */
export function matchPeriods(periods: TimetablePeriod[], start: string | null, end: string | null): { period: number; periodEnd: number } | null {
  if (!start || !end) return null
  const a = periods.find((p) => p.start === start)
  const b = periods.find((p) => p.end === end)
  return a && b && b.n >= a.n ? { period: a.n, periodEnd: b.n } : null
}

/** Periods a timed lesson overlaps (for lessons entered with free times). */
export function overlappingPeriods(periods: TimetablePeriod[], start: string, end: string): number[] {
  const s = toMin(start)
  const e = toMin(end)
  return periods.filter((p) => toMin(p.start) < e && s < toMin(p.end)).map((p) => p.n)
}

export function formatPeriods(period: number | null | undefined, periodEnd?: number | null): string {
  if (period == null) return ''
  return periodEnd != null && periodEnd !== period ? `${period}.–${periodEnd}. Std.` : `${period}. Std.`
}

// ───────────────────────── Weeks ─────────────────────────

/** ISO 8601 calendar week. */
export function isoWeek(day: DayKey): number {
  const d = parseDay(day)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const wd = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - wd)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function weekTypeOf(day: DayKey, weekAMonday: DayKey | null): WeekType | null {
  if (!weekAMonday) return null
  const weeks = Math.round(diffDays(startOfWeek(weekAMonday), startOfWeek(day)) / 7)
  return ((weeks % 2) + 2) % 2 === 0 ? 'A' : 'B'
}

/** First day ≥ `from` that falls on `wd` (0 = Sunday … 6 = Saturday) and – if given – in a week of the given type. */
export function alignedStart(from: DayKey, wd: number, weekType: WeekType | null, weekAMonday: DayKey | null): DayKey {
  let d = addDays(startOfWeek(from), (wd + 6) % 7)
  if (d < from) d = addDays(d, 7)
  if (weekType && weekAMonday && weekTypeOf(d, weekAMonday) !== weekType) d = addDays(d, 7)
  return d
}

export function lessonRecurrence(weekType: WeekType | null, until: DayKey | null, exceptions: DayKey[] = []): Recurrence {
  return { freq: 'weekly', interval: weekType ? 2 : 1, byWeekday: [], until, count: null, exceptions }
}

// ───────────────────────── Labels ─────────────────────────

/** Short subject code for narrow cells: the student's own code, otherwise derived from the name. */
export function subjectShort(s: Pick<Subject, 'name' | 'short'> | undefined | null): string {
  if (!s) return '–'
  if (s.short?.trim()) return s.short.trim()
  const name = s.name.trim()
  if (name.length <= 4) return name
  const words = name.split(/[\s/-]+/).filter(Boolean)
  if (words.length > 1) return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase()
  return name.slice(0, 3)
}

export const CHANGE_LABELS = { cancelled: 'Entfall', substitute: 'Vertretung', room: 'Raumänderung', extra: 'Zusatzstunde', info: 'Hinweis' } as const

// ───────────────────────── Derived views ─────────────────────────

export const isLesson = (i: CalItem) => i.kind === 'lesson' && !i.allDay && !!i.start

/** Lessons of one day in time order (changes included, cancelled ones flagged). */
export const lessonsOn = (items: CalItem[], day: DayKey) =>
  items.filter((i) => isLesson(i) && i.date === day).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || (a.period ?? 0) - (b.period ?? 0))

/** Next lesson of a subject strictly after `after` (cancelled lessons are skipped) – default due day for homework. */
export function nextLessonOf(items: CalItem[], subjectId: string, after: DayKey): CalItem | null {
  return items.filter((i) => isLesson(i) && i.subjectId === subjectId && !i.cancelled && i.date > after).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))[0] ?? null
}

/** School hours per weekday (index 0 = Sunday) from the regular lessons of a week – for the study planner. */
export function schoolWindows(items: CalItem[]): (TimeWindow | null)[] {
  const out: (TimeWindow | null)[] = [null, null, null, null, null, null, null]
  for (const i of items) {
    if (!isLesson(i) || i.cancelled || !i.end) continue
    const wd = weekday(i.date)
    const w = out[wd]
    out[wd] = w ? { from: i.start! < w.from ? i.start! : w.from, to: i.end > w.to ? i.end : w.to } : { from: i.start!, to: i.end }
  }
  return out
}

export interface DayStatus {
  current: CalItem | null
  next: CalItem | null
  /** Minutes until the next lesson starts (or the current one ends). */
  minutesLeft: number | null
  /** 0–1 progress of the current lesson. */
  progress: number
  schoolOver: boolean
  remaining: number
}

/** What is happening now on a school day. */
export function dayStatus(dayLessons: CalItem[], nowMin: number): DayStatus {
  const active = dayLessons.filter((l) => !l.cancelled)
  const current = active.find((l) => toMin(l.start!) <= nowMin && nowMin < toMin(l.end ?? l.start!)) ?? null
  const next = active.find((l) => toMin(l.start!) > nowMin) ?? null
  const remaining = active.filter((l) => toMin(l.end ?? l.start!) > nowMin).length
  let minutesLeft: number | null = null
  let progress = 0
  if (current) {
    const s = toMin(current.start!)
    const e = toMin(current.end ?? current.start!)
    minutesLeft = e - nowMin
    progress = e > s ? (nowMin - s) / (e - s) : 0
  } else if (next) minutesLeft = toMin(next.start!) - nowMin
  return { current, next, minutesLeft, progress, schoolOver: active.length > 0 && remaining === 0, remaining }
}

/** Monday … (last shown day) of the week containing `day`. */
export function weekDays(day: DayKey, days: number[]): DayKey[] {
  const monday = startOfWeek(day)
  return [...days].sort((a, b) => a - b).map((wd) => addDays(monday, (wd + 6) % 7))
}

/** Rows of the week grid: the bell schedule if there is one, otherwise whole hours covering all lessons. */
export function gridRange(periods: TimetablePeriod[], lessons: CalItem[]): { from: number; to: number } {
  const starts = [...periods.map((p) => toMin(p.start)), ...lessons.filter(isLesson).map((l) => toMin(l.start!))]
  const ends = [...periods.map((p) => toMin(p.end)), ...lessons.filter(isLesson).map((l) => toMin(l.end ?? l.start!))]
  if (!starts.length) return { from: 8 * 60, to: 14 * 60 }
  // with a bell schedule the grid hugs the school day; without one it shows whole hours
  if (periods.length) return { from: Math.min(...starts) - 5, to: Math.max(...ends) + 5 }
  const from = Math.floor(Math.min(...starts) / 60) * 60
  return { from, to: Math.min(24 * 60, Math.max(from + 6 * 60, Math.ceil(Math.max(...ends) / 60) * 60)) }
}
