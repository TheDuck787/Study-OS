import type { DayKey } from '@/db/types'
import { dayKey, parseDay } from '../dates'

/** Times are local wall-clock strings "HH:MM" (24 h). */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export const isTime = (t: unknown): t is string => typeof t === 'string' && TIME_RE.test(t)

/** A real calendar day in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDayKey(d: unknown): d is DayKey {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  return dayKey(parseDay(d)) === d
}

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Minutes since midnight → "HH:MM" (clamped to the day). */
export function fromMin(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const roundUpTo = (min: number, step: number) => Math.ceil(min / step) * step
export const snap = (min: number, step = 15) => Math.round(min / step) * step

export function durationMin(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  return Math.max(0, toMin(end) - toMin(start))
}

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

/** Date + time → Date in local time. */
export function toDate(day: DayKey, time: string | null): Date {
  const d = parseDay(day)
  if (time) {
    const m = toMin(time)
    d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  }
  return d
}

export const formatTimeRange = (start: string | null, end: string | null) => (start ? (end ? `${start}–${end}` : start) : 'ganztägig')
