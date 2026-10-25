import type { DayKey, PlannerSettings, StudySession, Task } from '@/db/types'
import { addDays, formatDayShort, rangeDays, WEEKDAYS_LONG, weekday } from '../dates'
import { isStudyItem, type CalItem } from './items'
import { buildSupply } from './planner'

export interface DayLoad {
  date: DayKey
  plannedStudy: number
  doneStudy: number
  /** Measured learning time (quiz, cards …) that day. */
  measured: number
  busyMinutes: number
  deadlines: number
  exams: number
  freeMinutes: number
  overloaded: boolean
  reasons: string[]
}

export interface WeekSummary {
  days: DayLoad[]
  plannedStudy: number
  doneStudy: number
  measured: number
  completionRate: number | null
  openTasks: Task[]
  overloadedDays: DayLoad[]
  recommendations: string[]
}

export interface WeekInput {
  weekStart: DayKey
  items: CalItem[]
  sessions: StudySession[]
  tasks: Task[]
  settings: PlannerSettings
  restDays: number[]
  today: DayKey
  /** Exam readiness per exam id (0..1) for exams in the next two weeks. */
  examReadiness: { id: string; title: string; date: DayKey; readiness: number | null }[]
  cardsDue: number
  weakTopics: string[]
}

export function summarizeWeek(i: WeekInput): WeekSummary {
  const days = rangeDays(i.weekStart, addDays(i.weekStart, 6))
  const supply = buildSupply({ days, settings: i.settings, restDays: i.restDays, fixed: i.items, today: '0000-00-00', nowMin: 0 })
  const loads: DayLoad[] = days.map((date, idx) => {
    const on = i.items.filter((x) => x.date <= date && x.endDate >= date && !x.cancelled)
    const study = on.filter(isStudyItem)
    const plannedStudy = study.reduce((s, x) => s + x.minutes, 0)
    const doneStudy = study.filter((x) => x.done).reduce((s, x) => s + x.minutes, 0)
    const measured = Math.round(i.sessions.filter((s) => s.day === date).reduce((s, x) => s + x.durationSec, 0) / 60)
    const busyMinutes = on.filter((x) => !isStudyItem(x) && x.start && !x.allDay).reduce((s, x) => s + x.minutes, 0)
    const deadlines = on.filter((x) => x.deadline && !x.done).length
    const exams = on.filter((x) => x.kind === 'exam').length
    const freeMinutes = Math.min(supply[idx].capacity, supply[idx].free.reduce((s, [a, b]) => s + (b - a), 0))
    const reasons: string[] = []
    if (plannedStudy > i.settings.maxDailyMinutes) reasons.push(`${plannedStudy} Min. Lernen geplant (Maximum ${i.settings.maxDailyMinutes})`)
    if (deadlines + exams >= 3) reasons.push(`${deadlines + exams} Fristen/Prüfungen`)
    if (exams > 0 && deadlines > 0) reasons.push('Prüfung und Abgabe am selben Tag')
    return { date, plannedStudy, doneStudy, measured, busyMinutes, deadlines, exams, freeMinutes, overloaded: reasons.length > 0, reasons }
  })
  const plannedStudy = loads.reduce((s, d) => s + d.plannedStudy, 0)
  const doneStudy = loads.reduce((s, d) => s + d.doneStudy, 0)
  const measured = loads.reduce((s, d) => s + d.measured, 0)
  const pastPlanned = loads.filter((d) => d.date < i.today).reduce((s, d) => s + d.plannedStudy, 0)
  const pastDone = loads.filter((d) => d.date < i.today).reduce((s, d) => s + d.doneStudy, 0)
  const weekEnd = addDays(i.weekStart, 6)
  const openTasks = i.tasks.filter((t) => t.status === 'open' && t.dueDate && t.dueDate <= weekEnd).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const overloadedDays = loads.filter((d) => d.overloaded)

  const rec: string[] = []
  for (const d of overloadedDays) {
    const lighter = loads.filter((x) => x.date !== d.date && x.date >= i.today && !x.overloaded && x.freeMinutes >= 30).sort((a, b) => b.freeMinutes - a.freeMinutes)[0]
    rec.push(`${WEEKDAYS_LONG[weekday(d.date)]} ist voll (${d.reasons.join(', ')}).${lighter ? ` ${WEEKDAYS_LONG[weekday(lighter.date)]} hat noch ${lighter.freeMinutes} Min. frei – verschiebe dorthin eine Einheit.` : ''}`)
  }
  for (const x of i.examReadiness) {
    if (x.readiness !== null && x.readiness < 0.5) rec.push(`„${x.title}“ am ${formatDayShort(x.date)}: Vorbereitung erst bei ${Math.round(x.readiness * 100)} %. Plane mehr Übungszeit für die schwächsten Themen ein.`)
    if (x.readiness === null) rec.push(`„${x.title}“ hat noch keine Themen – trage sie ein, damit der Lernplan gezielt üben kann.`)
  }
  if (pastPlanned >= 60 && pastDone / pastPlanned < 0.5) rec.push(`Du hast diese Woche bisher ${Math.round((pastDone / pastPlanned) * 100)} % der geplanten Lernzeit geschafft. Plane lieber etwas weniger pro Tag – ein realistischer Plan wirkt besser.`)
  const unscheduled = openTasks.filter((t) => !i.items.some((x) => x.taskId === t.id && x.source === 'event'))
  if (unscheduled.length) rec.push(`${unscheduled.length} offene Aufgabe${unscheduled.length === 1 ? '' : 'n'} ohne geplante Arbeitszeit: ${unscheduled.slice(0, 3).map((t) => `„${t.title}“`).join(', ')}. „Plan neu berechnen“ verteilt sie.`)
  if (i.cardsDue >= 30) rec.push(`${i.cardsDue} Karteikarten sind fällig. Ein täglicher 10-Minuten-Block verhindert, dass sich das staut.`)
  if (i.weakTopics.length) rec.push(`Weiter üben: ${i.weakTopics.slice(0, 4).join(', ')}.`)
  if (!rec.length) rec.push('Deine Woche sieht ausgeglichen aus. Halte die geplanten Einheiten ein und hake sie ab.')
  return { days: loads, plannedStudy, doneStudy, measured, completionRate: pastPlanned > 0 ? pastDone / pastPlanned : null, openTasks, overloadedDays, recommendations: rec }
}
