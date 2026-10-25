import type { DayKey } from '@/db/types'

const DAY_MS = 86_400_000

/** Local calendar day (YYYY-MM-DD) – learning days follow the student's clock, not UTC. */
export function dayKey(d: Date | string | number = new Date()): DayKey {
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses a DayKey as local midnight. */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Whole calendar days from a to b (b - a). DST-safe because it rounds. */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS)
}

export function daysBetweenDates(a: Date | string, b: Date | string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY_MS
}

/** Monday of the week containing `key` (German weeks start on Monday). */
export function startOfWeek(key: DayKey): DayKey {
  const d = parseDay(key)
  const offset = (d.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function weekday(key: DayKey): number {
  return parseDay(key).getDay()
}

export function rangeDays(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let k = from; diffDays(k, to) >= 0; k = addDays(k, 1)) out.push(k)
  return out
}

const fmtLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const fmtDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtDateTime = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatDayLong = (key: DayKey) => fmtLong.format(parseDay(key))
export const formatDayShort = (key: DayKey) => fmtShort.format(parseDay(key))
export const formatDate = (d: Date | string) => fmtDate.format(new Date(d))
export const formatDateTime = (d: Date | string) => fmtDateTime.format(new Date(d))

/** "heute", "morgen", "in 5 Tagen", "vor 2 Tagen" */
export function relativeDay(key: DayKey, today: DayKey = dayKey()): string {
  const n = diffDays(today, key)
  if (n === 0) return 'heute'
  if (n === 1) return 'morgen'
  if (n === 2) return 'übermorgen'
  if (n === -1) return 'gestern'
  if (n > 0) return `in ${n} Tagen`
  return `vor ${-n} Tagen`
}

export function formatMinutes(totalMinutes: number): string {
  const m = Math.round(totalMinutes)
  if (m < 60) return `${m} Min.`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} Std. ${rest} Min.` : `${h} Std.`
}

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
