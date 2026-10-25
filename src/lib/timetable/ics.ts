import type { CalendarEvent, DayKey, Subject, WeekType } from '@/db/types'
import { addDays, dayKey, diffDays, startOfWeek, weekday } from '../dates'
import { fromMin, isDayKey, toMin } from '../calendar/time'
import type { LessonDraft } from './csv'
import { weekTypeOf } from './core'

/**
 * iCalendar (RFC 5545) for the timetable.
 * Export: one recurring VEVENT per lesson, changes as overrides (RECURRENCE-ID), cancelled ones STATUS:CANCELLED.
 * Import: weekly series stay series; single events (e.g. a WebUntis export) are grouped into weekly lessons
 * when the same lesson repeats at the same weekday and time. Untrusted text is only ever stored as plain text.
 */

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const unesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([\\;,])/g, '$1')
const local = (day: DayKey, time: string) => `${day.replace(/-/g, '')}T${time.replace(':', '')}00`
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** Lines longer than 75 octets are folded (continuation lines start with a space). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let curLen = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (curLen + n > (parts.length ? 74 : 75)) {
      parts.push(cur)
      cur = ''
      curLen = 0
    }
    cur += ch
    curLen += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

export function exportTimetableIcs(events: CalendarEvent[], subjects: Subject[], now = new Date()): string {
  const bySubject = new Map(subjects.map((s) => [s.id, s]))
  const lessons = events.filter((e) => e.category === 'lesson' && !e.allDay && e.start && e.end)
  const series = new Map(lessons.filter((e) => e.recurrence).map((e) => [e.id, e]))
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Study OS//Stundenplan//DE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Stundenplan']
  const title = (e: CalendarEvent) => {
    const s = e.subjectId ? bySubject.get(e.subjectId) : undefined
    return s?.name ?? e.title
  }
  const body = (e: CalendarEvent) => {
    const lines = [`SUMMARY:${esc(title(e))}`]
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`)
    const desc = [e.teacher ? `Lehrkraft: ${e.teacher}` : '', e.lessonChange?.note ?? '', e.description].filter(Boolean).join('\n')
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    if (e.status === 'cancelled') lines.push('STATUS:CANCELLED')
    return lines
  }
  for (const e of lessons) {
    if (e.seriesId && series.has(e.seriesId)) continue // written with its series below
    const uid = `${e.id}@study-os`
    out.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `DTSTART:${local(e.date, e.start!)}`, `DTEND:${local(e.date, e.end!)}`, ...body(e))
    if (e.recurrence) {
      const r = e.recurrence
      let rule = `RRULE:FREQ=WEEKLY;INTERVAL=${r.interval};BYDAY=${(r.byWeekday.length ? r.byWeekday : [weekday(e.date)]).map((d) => BYDAY[d]).join(',')}`
      if (r.until) rule += `;UNTIL=${r.until.replace(/-/g, '')}T235959`
      else if (r.count) rule += `;COUNT=${r.count}`
      out.push(rule)
      const overridden = new Set(lessons.filter((o) => o.seriesId === e.id).map((o) => o.originalDate))
      const ex = r.exceptions.filter((d) => !overridden.has(d))
      if (ex.length) out.push(`EXDATE:${ex.map((d) => local(d, e.start!)).join(',')}`)
    }
    out.push('END:VEVENT')
    for (const o of lessons.filter((x) => x.seriesId === e.id && x.originalDate)) {
      out.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `RECURRENCE-ID:${local(o.originalDate!, e.start!)}`, `DTSTART:${local(o.date, o.start ?? e.start!)}`, `DTEND:${local(o.date, o.end ?? e.end!)}`, ...body(o), 'END:VEVENT')
    }
  }
  out.push('END:VCALENDAR')
  return `${out.map(fold).join('\r\n')}\r\n`
}

// ───────────────────────── Import ─────────────────────────

export interface IcsEvent {
  uid: string
  summary: string
  location: string
  description: string
  date: DayKey
  start: string | null
  end: string | null
  allDay: boolean
  cancelled: boolean
  recurrenceId: boolean
  rrule: { freq: string; interval: number; until: DayKey | null; count: number | null; byday: number[] } | null
  exdates: DayKey[]
}

const MAX_BYTES = 2_000_000
const MAX_EVENTS = 5000

/** Parses an ICS date/time value to local wall-clock time. UTC values ("…Z") are converted to the device's time zone. */
function parseDt(value: string): { date: DayKey; time: string | null } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  if (!m[4]) {
    const date = `${m[1]}-${m[2]}-${m[3]}`
    return isDayKey(date) ? { date, time: null } : null
  }
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
    if (Number.isNaN(d.getTime())) return null
    return { date: dayKey(d), time: fromMin(d.getHours() * 60 + d.getMinutes()) }
  }
  const date = `${m[1]}-${m[2]}-${m[3]}`
  const h = +m[4]
  const min = +m[5]
  return isDayKey(date) && h < 24 && min < 60 ? { date, time: fromMin(h * 60 + min) } : null
}

export function parseIcs(text: string): { events: IcsEvent[]; error: string | null } {
  if (text.length > MAX_BYTES) return { events: [], error: 'Die Datei ist zu groß (höchstens 2 MB).' }
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], error: 'Das ist keine gültige ICS-Kalenderdatei.' }
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const events: IcsEvent[] = []
  let cur: Record<string, { value: string; params: string }[]> | null = null
  let depth = 0
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^BEGIN:VEVENT$/i.test(line)) {
      cur = {}
      depth = 0
      continue
    }
    if (!cur) continue
    if (/^BEGIN:/i.test(line)) depth++ // VALARM etc.
    else if (/^END:VEVENT$/i.test(line)) {
      const ev = toEvent(cur)
      if (ev) events.push(ev)
      cur = null
      if (events.length >= MAX_EVENTS) return { events, error: `Mehr als ${MAX_EVENTS} Termine – der Rest wird ignoriert.` }
    } else if (/^END:/i.test(line)) depth--
    else if (depth === 0) {
      const m = line.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/)
      if (m) (cur[m[1].toUpperCase()] ??= []).push({ value: m[3], params: m[2] })
    }
  }
  return { events, error: null }
}

function toEvent(p: Record<string, { value: string; params: string }[]>): IcsEvent | null {
  const first = (k: string) => p[k]?.[0]
  const dtStart = first('DTSTART')
  if (!dtStart) return null
  const s = parseDt(dtStart.value.trim())
  if (!s) return null
  const dtEnd = first('DTEND')
  const e = dtEnd ? parseDt(dtEnd.value.trim()) : null
  let end = e?.time ?? null
  if (s.time && !end) {
    const dur = first('DURATION')?.value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
    if (dur) end = fromMin(toMin(s.time) + Number(dur[1] ?? 0) * 60 + Number(dur[2] ?? 0))
  }
  if (s.time && e && e.date !== s.date) end = null // spans midnight – not a lesson
  let rrule: IcsEvent['rrule'] = null
  const rr = first('RRULE')?.value
  if (rr) {
    const kv = Object.fromEntries(rr.split(';').map((x) => x.split('=') as [string, string]))
    const until = kv.UNTIL ? parseDt(kv.UNTIL)?.date ?? null : null
    rrule = {
      freq: String(kv.FREQ ?? '').toUpperCase(), interval: Math.max(1, Math.min(52, Number(kv.INTERVAL) || 1)), until,
      count: kv.COUNT ? Math.max(1, Math.min(500, Number(kv.COUNT) || 1)) : null,
      byday: String(kv.BYDAY ?? '').split(',').map((d) => BYDAY.indexOf(d.replace(/^[+-]?\d+/, '').toUpperCase())).filter((d) => d >= 0),
    }
  }
  const exdates = (p.EXDATE ?? []).flatMap((x) => x.value.split(',').map((v) => parseDt(v.trim())?.date)).filter((d): d is DayKey => !!d)
  const text = (k: string, n: number) => unesc(first(k)?.value ?? '').trim().slice(0, n)
  return {
    uid: text('UID', 200), summary: text('SUMMARY', 120), location: text('LOCATION', 120), description: text('DESCRIPTION', 500),
    date: s.date, start: s.time, end, allDay: !s.time, cancelled: /CANCELLED/i.test(first('STATUS')?.value ?? ''), recurrenceId: !!first('RECURRENCE-ID'), rrule, exdates,
  }
}

export interface IcsDraftResult {
  drafts: LessonDraft[]
  /** Events that occur only once (kept as single lessons only if the student wants). */
  singles: IcsEvent[]
  skipped: { allDay: number; cancelled: number; other: number }
  /** A/B weeks found but not configured yet: proposed Monday of an A week. */
  suggestedWeekAMonday: DayKey | null
}

const teacherFrom = (description: string) => description.match(/(?:Lehrkraft|Lehrer(?:in)?|Teacher)\s*:\s*([^\n]+)/i)?.[1]?.trim().slice(0, 120) ?? ''

export function icsToDrafts(events: IcsEvent[], weekAMonday: DayKey | null): IcsDraftResult {
  const skipped = { allDay: 0, cancelled: 0, other: 0 }
  const drafts: LessonDraft[] = []
  const singlesPool: IcsEvent[] = []
  let suggested: DayKey | null = null
  const ref = () => weekAMonday ?? suggested
  const draftBase = (e: IcsEvent, wd: number): LessonDraft => ({
    weekday: wd, start: e.start!, end: e.end!, period: null, periodEnd: null, subject: e.summary || 'Unterricht', subjectShort: '', teacher: teacherFrom(e.description),
    room: e.location, weekType: null, validFrom: null, validUntil: null, note: '',
  })
  for (const e of events) {
    if (e.allDay) skipped.allDay++
    else if (e.cancelled) skipped.cancelled++
    else if (!e.start || !e.end || e.end <= e.start || e.recurrenceId) skipped.other++
    else if (e.rrule) {
      if (e.rrule.freq !== 'WEEKLY' || e.rrule.interval > 2) {
        skipped.other++
        continue
      }
      let weekType: WeekType | null = null
      if (e.rrule.interval === 2) {
        suggested ??= weekAMonday ? null : startOfWeek(e.date)
        weekType = weekTypeOf(e.date, ref())
      }
      for (const wd of e.rrule.byday.length ? e.rrule.byday : [weekday(e.date)]) {
        if (wd === 0) {
          skipped.other++
          continue
        }
        drafts.push({ ...draftBase(e, wd), weekType, validFrom: e.date, validUntil: e.rrule.until, exceptions: e.exdates })
      }
    } else if (weekday(e.date) === 0) skipped.other++
    else singlesPool.push(e)
  }
  // group repeated single events: same weekday, time, subject and room → one weekly lesson
  const groups = new Map<string, IcsEvent[]>()
  for (const e of singlesPool) {
    const k = [weekday(e.date), e.start, e.end, e.summary.toLowerCase(), e.location.toLowerCase()].join('|')
    groups.set(k, [...(groups.get(k) ?? []), e])
  }
  const singles: IcsEvent[] = []
  for (const list of groups.values()) {
    const dates = [...new Set(list.map((e) => e.date))].sort()
    if (dates.length < 2) {
      singles.push(...list)
      continue
    }
    const gaps = dates.slice(1).map((d, i) => diffDays(dates[i], d))
    const biweekly = gaps.every((g) => g % 14 === 0)
    let weekType: WeekType | null = null
    if (biweekly) {
      suggested ??= weekAMonday ? null : startOfWeek(dates[0])
      weekType = weekTypeOf(dates[0], ref())
    }
    const step = biweekly ? 14 : 7
    const present = new Set(dates)
    const exceptions: DayKey[] = []
    for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, step)) if (!present.has(d)) exceptions.push(d)
    drafts.push({ ...draftBase(list[0], weekday(dates[0])), weekType, validFrom: dates[0], validUntil: dates[dates.length - 1], exceptions })
  }
  return { drafts, singles: singles.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')), skipped, suggestedWeekAMonday: weekAMonday ? null : suggested }
}
