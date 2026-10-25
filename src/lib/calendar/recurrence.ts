import type { DayKey, Recurrence } from '@/db/types'
import { addDays, diffDays, parseDay, dayKey, startOfWeek, weekday, WEEKDAYS_SHORT } from '../dates'

const MAX_STEPS = 4000

/** All occurrence start days of a series in order (honours interval, byWeekday, until, count; exceptions removed). */
export function* iterateOccurrences(start: DayKey, rule: Recurrence): Generator<DayKey> {
  const exceptions = new Set(rule.exceptions)
  const interval = Math.max(1, rule.interval || 1)
  let produced = 0
  const emit = (d: DayKey): 'stop' | 'ok' => {
    if (rule.until && d > rule.until) return 'stop'
    if (rule.count !== null && produced >= rule.count) return 'stop'
    produced++
    return 'ok'
  }
  if (rule.freq === 'daily') {
    for (let i = 0, d = start; i < MAX_STEPS; i++, d = addDays(d, interval)) {
      if (emit(d) === 'stop') return
      if (!exceptions.has(d)) yield d
    }
  } else if (rule.freq === 'weekly') {
    const days = (rule.byWeekday.length ? [...rule.byWeekday] : [weekday(start)]).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    const week0 = startOfWeek(start)
    for (let w = 0; w < MAX_STEPS; w++) {
      const monday = addDays(week0, w * 7 * interval)
      for (const wd of days) {
        const d = addDays(monday, (wd + 6) % 7)
        if (d < start) continue
        if (emit(d) === 'stop') return
        if (!exceptions.has(d)) yield d
      }
    }
  } else {
    const s = parseDay(start)
    const dom = s.getDate()
    for (let i = 0; i < MAX_STEPS; i++) {
      const m = new Date(s.getFullYear(), s.getMonth() + i * interval, 1)
      const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
      if (dom > last) continue // e.g. the 31st does not exist in this month
      const d = dayKey(new Date(m.getFullYear(), m.getMonth(), dom))
      if (emit(d) === 'stop') return
      if (!exceptions.has(d)) yield d
    }
  }
}

/** Occurrence start days whose span (start … start+spanDays) touches [from, to]. */
export function occurrencesInRange(start: DayKey, rule: Recurrence | null, from: DayKey, to: DayKey, spanDays = 0): DayKey[] {
  if (!rule) return addDays(start, spanDays) >= from && start <= to ? [start] : []
  const out: DayKey[] = []
  for (const d of iterateOccurrences(start, rule)) {
    if (d > to) break
    if (addDays(d, spanDays) >= from) out.push(d)
  }
  return out
}

/** True if `day` is an occurrence start of the series. */
export function isOccurrence(start: DayKey, rule: Recurrence | null, day: DayKey): boolean {
  return occurrencesInRange(start, rule, day, day).includes(day)
}

export function describeRecurrence(rule: Recurrence | null, start: DayKey): string {
  if (!rule) return 'Einmalig'
  const n = Math.max(1, rule.interval)
  let base: string
  if (rule.freq === 'daily') base = n === 1 ? 'Täglich' : `Alle ${n} Tage`
  else if (rule.freq === 'weekly') {
    const days = (rule.byWeekday.length ? rule.byWeekday : [weekday(start)]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(', ')
    base = `${n === 1 ? 'Wöchentlich' : n === 2 ? 'Alle 2 Wochen' : `Alle ${n} Wochen`} (${days})`
  } else base = n === 1 ? `Monatlich am ${parseDay(start).getDate()}.` : `Alle ${n} Monate am ${parseDay(start).getDate()}.`
  if (rule.until) base += ` bis ${parseDay(rule.until).toLocaleDateString('de-DE')}`
  else if (rule.count) base += `, ${rule.count}×`
  return base
}

export const spanDays = (date: DayKey, endDate: DayKey | null) => (endDate && endDate > date ? diffDays(date, endDate) : 0)
