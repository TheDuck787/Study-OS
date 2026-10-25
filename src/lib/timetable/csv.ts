import type { CalendarEvent, Subject, TimetablePeriod, WeekType } from '@/db/types'
import { parseCsv } from '../csv'
import { isDayKey, isTime } from '../calendar/time'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, weekday } from '../dates'
import { periodTimes } from './core'

/**
 * Timetable CSV (Excel-friendly: semicolon, UTF-8 with BOM). One row per regular lesson.
 * Import is strict and shows every problem per line – nothing is saved before the student confirms.
 */

export interface LessonDraft {
  /** 1 = Monday … 6 = Saturday */
  weekday: number
  start: string
  end: string
  period: number | null
  periodEnd: number | null
  subject: string
  subjectShort: string
  teacher: string
  room: string
  weekType: WeekType | null
  validFrom: string | null
  validUntil: string | null
  note: string
  /** Weeks without this lesson (e.g. holidays in an imported calendar). */
  exceptions?: string[]
}

export interface DraftResult {
  drafts: LessonDraft[]
  errors: { line: number; message: string }[]
}

const HEADERS = ['Tag', 'Stunde', 'Bis Stunde', 'Beginn', 'Ende', 'Fach', 'Kürzel', 'Lehrkraft', 'Raum', 'Woche', 'Gültig ab', 'Gültig bis', 'Notiz']

/** Cells starting with = + - @ are prefixed so spreadsheet programs never run them as formulas. */
function cell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportTimetableCsv(series: CalendarEvent[], subjects: Subject[]): string {
  const bySubject = new Map(subjects.map((s) => [s.id, s]))
  const rows = series
    .filter((e) => e.category === 'lesson' && e.recurrence && !e.allDay && e.start && e.end)
    .sort((a, b) => ((weekday(a.date) + 6) % 7) - ((weekday(b.date) + 6) % 7) || a.start!.localeCompare(b.start!))
    .map((e) => {
      const s = e.subjectId ? bySubject.get(e.subjectId) : undefined
      return [
        WEEKDAYS_LONG[weekday(e.date)], e.period ?? '', e.periodEnd ?? '', e.start, e.end, s?.name ?? e.title, s?.short ?? '', e.teacher, e.location,
        e.weekType ?? '', e.date, e.recurrence?.until ?? '', e.description,
      ].map(cell).join(';')
    })
  return `\uFEFF${[HEADERS.join(';'), ...rows].join('\r\n')}\r\n`
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const COLUMN_ALIASES: Record<Exclude<keyof LessonDraft, 'exceptions'>, string[]> = {
  weekday: ['tag', 'wochentag', 'day', 'weekday'],
  period: ['stunde', 'std', 'vonstunde', 'period', 'lesson'],
  periodEnd: ['bisstunde', 'endstunde', 'periodend', 'tostunde'],
  start: ['beginn', 'start', 'von', 'anfang', 'startzeit', 'from'],
  end: ['ende', 'end', 'bis', 'endzeit', 'to'],
  subject: ['fach', 'subject', 'unterricht', 'kurs'],
  subjectShort: ['kurzel', 'kuerzel', 'fachkurzel', 'short', 'abkurzung'],
  teacher: ['lehrkraft', 'lehrer', 'lehrerin', 'teacher'],
  room: ['raum', 'room', 'ort', 'location'],
  weekType: ['woche', 'week', 'abwoche', 'turnus'],
  validFrom: ['gultigab', 'ab', 'validfrom', 'startdatum'],
  validUntil: ['gultigbis', 'validuntil', 'enddatum'],
  note: ['notiz', 'note', 'bemerkung', 'info'],
}

export function parseWeekday(v: string): number | null {
  const n = norm(v)
  if (/^[1-6]$/.test(n)) return Number(n)
  const en = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  for (let i = 1; i <= 6; i++) {
    if (n === norm(WEEKDAYS_LONG[i]) || n === norm(WEEKDAYS_SHORT[i]) || n === en[i] || n === en[i].slice(0, 3)) return i
  }
  return null
}

/** "7:45", "07.45", "0745" → "07:45" */
export function parseTime(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})[:.]?(\d{2})$/)
  if (!m) return null
  const t = `${m[1].padStart(2, '0')}:${m[2]}`
  return isTime(t) ? t : null
}

/** "2026-11-02" or "02.11.2026" → DayKey */
export function parseDate(v: string): string | null {
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isDayKey(s) ? s : null
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!m) return null
  const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return isDayKey(d) ? d : null
}

const MAX_ROWS = 1000
const clip = (s: string, n = 120) => s.trim().slice(0, n)

export function parseTimetableCsv(text: string, periods: TimetablePeriod[]): DraftResult {
  const errors: DraftResult['errors'] = []
  const rows = parseCsv(text)
  if (rows.length === 0) return { drafts: [], errors: [{ line: 1, message: 'Die Datei ist leer.' }] }
  const header = rows[0].map(norm)
  const col = (k: keyof typeof COLUMN_ALIASES) => header.findIndex((h) => COLUMN_ALIASES[k].includes(h))
  const idx = { weekday: col('weekday'), period: col('period'), periodEnd: col('periodEnd'), start: col('start'), end: col('end'), subject: col('subject'), subjectShort: col('subjectShort'), teacher: col('teacher'), room: col('room'), weekType: col('weekType'), validFrom: col('validFrom'), validUntil: col('validUntil'), note: col('note') }
  if (idx.weekday < 0 || idx.subject < 0) return { drafts: [], errors: [{ line: 1, message: 'Es fehlen die Spalten „Tag“ und/oder „Fach“. Die erste Zeile muss die Spaltennamen enthalten (z. B. Tag;Stunde;Beginn;Ende;Fach;Lehrkraft;Raum).' }] }
  if (rows.length - 1 > MAX_ROWS) errors.push({ line: MAX_ROWS + 2, message: `Mehr als ${MAX_ROWS} Zeilen – der Rest wird ignoriert.` })
  const drafts: LessonDraft[] = []
  rows.slice(1, MAX_ROWS + 1).forEach((r, i) => {
    const line = i + 2
    const get = (j: number) => (j >= 0 ? String(r[j] ?? '').replace(/^'(?=[=+\-@])/, '') : '')
    const wd = parseWeekday(get(idx.weekday))
    if (!wd) return errors.push({ line, message: `Unbekannter Wochentag „${clip(get(idx.weekday), 20)}“.` })
    const subject = clip(get(idx.subject), 60)
    if (!subject) return errors.push({ line, message: 'Das Fach fehlt.' })
    const pRaw = get(idx.period).replace(/\D/g, '')
    const peRaw = get(idx.periodEnd).replace(/\D/g, '')
    const period = pRaw ? Number(pRaw) : null
    const periodEnd = peRaw ? Number(peRaw) : period
    let start = parseTime(get(idx.start))
    let end = parseTime(get(idx.end))
    if ((!start || !end) && period != null) {
      const t = periodTimes(periods, period, periodEnd ?? period)
      if (t) {
        start ??= t.start
        end ??= t.end
      }
    }
    if (!start || !end) return errors.push({ line, message: period != null ? `Für die ${period}. Stunde gibt es im Stundenraster keine Zeit – trag Beginn und Ende ein oder lege zuerst das Stundenraster an.` : 'Beginn und Ende fehlen (z. B. 07:45 und 08:30).' })
    if (end <= start) return errors.push({ line, message: 'Das Ende muss nach dem Beginn liegen.' })
    const wt = norm(get(idx.weekType))
    const weekType: WeekType | null = wt === 'a' || wt === 'awoche' ? 'A' : wt === 'b' || wt === 'bwoche' ? 'B' : null
    if (wt && !weekType && !['', 'jede', 'alle', 'jedewoche', 'wochentlich'].includes(wt)) return errors.push({ line, message: `Unbekannte Woche „${clip(get(idx.weekType), 20)}“ – erlaubt sind A, B oder leer.` })
    const vf = get(idx.validFrom).trim()
    const vu = get(idx.validUntil).trim()
    const validFrom = vf ? parseDate(vf) : null
    const validUntil = vu ? parseDate(vu) : null
    if (vf && !validFrom) return errors.push({ line, message: `Ungültiges Datum „${clip(vf, 20)}“ bei „Gültig ab“.` })
    if (vu && !validUntil) return errors.push({ line, message: `Ungültiges Datum „${clip(vu, 20)}“ bei „Gültig bis“.` })
    if (validFrom && validUntil && validUntil < validFrom) return errors.push({ line, message: '„Gültig bis“ liegt vor „Gültig ab“.' })
    drafts.push({
      weekday: wd, start, end, period: period != null && period <= 20 ? period : null, periodEnd: periodEnd != null && periodEnd <= 20 && period != null && periodEnd >= period ? periodEnd : null,
      subject, subjectShort: clip(get(idx.subjectShort), 8), teacher: clip(get(idx.teacher)), room: clip(get(idx.room)), weekType, validFrom, validUntil, note: clip(get(idx.note), 500),
    })
  })
  return { drafts, errors }
}
