import type { DayKey, PlanSession, PlanSessionType } from '@/db/types'
import { addDays, diffDays, formatDayShort, rangeDays, weekday } from './dates'
import type { MasteryLevel } from './mastery'
import { uid } from './id'

export interface PlanTopic {
  id: string
  name: string
  mastery: number
  level: MasteryLevel
  prerequisiteIds: string[]
}

export interface PlanInput {
  today: DayKey
  examDate: DayKey
  topics: PlanTopic[]
  minutesPerDay: number
  availableWeekdays: number[]
  difficulty: 1 | 2 | 3
  /** Sessions already done – kept as they are when re-planning. */
  keep?: PlanSession[]
  /** Skip the diagnostic (e.g. when re-planning after it was done). */
  skipDiagnostic?: boolean
}

export interface PlanResult {
  sessions: PlanSession[]
  warnings: string[]
}

interface Item {
  type: PlanSessionType
  title: string
  description: string
  topicIds: string[]
  minutes: number
  priority: number // lower = more important (dropped last)
}

export const SESSION_LABELS: Record<PlanSessionType, string> = {
  diagnostic: 'Diagnose',
  learn: 'Lernen',
  practice: 'Üben',
  review: 'Wiederholen',
  mock: 'Probeklausur',
  analysis: 'Fehleranalyse',
  final: 'Abschluss',
}

/** Orders topics so that prerequisites come first, otherwise weakest first. */
export function orderTopics(topics: PlanTopic[]): PlanTopic[] {
  const ids = new Set(topics.map((t) => t.id))
  const byWeakness = [...topics].sort((a, b) => a.mastery - b.mastery)
  const done = new Set<string>()
  const out: PlanTopic[] = []
  const visit = (t: PlanTopic, stack: Set<string>) => {
    if (done.has(t.id) || stack.has(t.id)) return
    stack.add(t.id)
    for (const p of t.prerequisiteIds) {
      if (!ids.has(p)) continue
      const pt = topics.find((x) => x.id === p)
      if (pt) visit(pt, stack)
    }
    done.add(t.id)
    out.push(t)
  }
  for (const t of byWeakness) visit(t, new Set())
  return out
}

/**
 * Builds a realistic plan between today and the day before the test:
 * Diagnose → topic blocks (weakest first, foundations first) with spaced reviews →
 * Probeklausur → Fehleranalyse → targeted practice → Abschluss-Wiederholung on the last day.
 * If time is short, less important items are dropped and a warning explains what was cut.
 */
export function generateStudyPlan(input: PlanInput): PlanResult {
  const warnings: string[] = []
  // done sessions and sessions the student placed by hand (pinned) stay as they are
  const kept = (input.keep ?? []).filter((s) => s.done || s.pinned)
  const daysUntil = diffDays(input.today, input.examDate)
  if (daysUntil <= 0) {
    return { sessions: kept, warnings: [daysUntil === 0 ? 'Die Prüfung ist heute. Viel Erfolg – eine kurze, ruhige Wiederholung reicht jetzt.' : 'Das Prüfungsdatum liegt in der Vergangenheit.'] }
  }
  if (input.topics.length === 0) warnings.push('Es sind noch keine Themen ausgewählt. Der Plan enthält deshalb nur allgemeine Einheiten.')

  const lastDay = addDays(input.examDate, -1)
  let days = rangeDays(input.today, lastDay).filter((d) => input.availableWeekdays.includes(weekday(d)))
  if (days.length === 0) {
    warnings.push('An keinem deiner verfügbaren Wochentage ist vor der Prüfung noch Zeit. Der Plan nutzt deshalb die verbleibenden Tage.')
    days = rangeDays(input.today, lastDay)
  }
  if (!input.availableWeekdays.includes(weekday(lastDay)) && days.length > 0) {
    warnings.push(`Der Tag vor der Prüfung (${formatDayShort(lastDay)}) ist kein Lerntag – die Abschluss-Wiederholung liegt deshalb früher.`)
  }

  const perDay = Math.max(10, input.minutesPerDay)
  const scale = (m: number) => Math.max(10, Math.min(m, perDay))
  const ordered = orderTopics(input.topics)
  const names = (ids: string[]) => ids.map((id) => input.topics.find((t) => t.id === id)?.name ?? '').filter(Boolean).join(', ')
  const allIds = input.topics.map((t) => t.id)
  const N = days.length

  // Fixed anchors
  const anchors = new Map<number, Item[]>()
  const addAnchor = (dayIdx: number, item: Item) => {
    const arr = anchors.get(dayIdx) ?? []
    arr.push(item)
    anchors.set(dayIdx, arr)
  }
  const hasDiag = !input.skipDiagnostic && !kept.some((s) => s.type === 'diagnostic')
  const hasMock = !kept.some((s) => s.type === 'mock')

  if (hasDiag && N >= 3) {
    addAnchor(0, { type: 'diagnostic', title: 'Diagnosetest', description: 'Kurzer Test über alle Themen: Wo stehst du? Danach weiß der Plan, was du zuerst üben solltest.', topicIds: allIds, minutes: scale(15), priority: 0 })
  }
  let mockIdx = -1
  if (hasMock && N >= 2) {
    mockIdx = N >= 5 ? N - 3 : N >= 3 ? N - 2 : 0
    if (N === 2) mockIdx = 0
    addAnchor(mockIdx, { type: 'mock', title: 'Probeklausur', description: 'Unter Prüfungsbedingungen: ohne Hilfen, mit Zeitlimit. Ergebnis zeigt eine geschätzte Note.', topicIds: allIds, minutes: scale(input.difficulty === 3 ? 45 : 30), priority: 1 })
    const analysisIdx = Math.min(mockIdx + 1, N - 1)
    addAnchor(analysisIdx === N - 1 && N > 2 ? mockIdx : analysisIdx, { type: 'analysis', title: 'Fehleranalyse', description: 'Fehler aus der Probeklausur durchgehen: Warum war es falsch? Danach ähnliche Aufgaben üben.', topicIds: allIds, minutes: scale(15), priority: 1 })
  }
  if (!hasMock && !kept.some((s) => s.type === 'analysis')) {
    addAnchor(0, { type: 'analysis', title: 'Fehleranalyse', description: 'Fehler aus der Probeklausur durchgehen: Warum war es falsch? Danach ähnliche Aufgaben üben.', topicIds: allIds, minutes: scale(15), priority: 1 })
  }
  addAnchor(N - 1, { type: 'final', title: 'Abschluss-Wiederholung', description: 'Locker wiederholen: Merkzettel, wichtigste Regeln, ein paar leichte Aufgaben. Danach Pause und früh schlafen.', topicIds: allIds, minutes: scale(20), priority: 0 })

  // Topic blocks
  const learnItems: Item[] = []
  for (const t of ordered) {
    const extra = input.difficulty === 3 ? 1 : 0
    if (t.level === 'new' || t.level === 'struggling') {
      learnItems.push({ type: 'learn', title: `${t.name}: Grundlagen`, description: 'Erklärung lesen oder mit dem Tutor durchgehen, dann leichte Aufgaben.', topicIds: [t.id], minutes: scale(20), priority: 2 })
      learnItems.push({ type: 'practice', title: `${t.name}: Üben`, description: 'Aufgaben auf deinem Niveau, mit Hinweisen.', topicIds: [t.id], minutes: scale(15), priority: 3 })
      for (let i = 0; i < extra; i++) learnItems.push({ type: 'practice', title: `${t.name}: Vertiefen`, description: 'Schwierigere Aufgaben.', topicIds: [t.id], minutes: scale(15), priority: 5 })
    } else if (t.level === 'practicing') {
      learnItems.push({ type: 'practice', title: `${t.name}: Gezielt üben`, description: 'Aufgaben zu deinen Schwachstellen in diesem Thema.', topicIds: [t.id], minutes: scale(15), priority: 3 })
      if (extra) learnItems.push({ type: 'practice', title: `${t.name}: Vertiefen`, description: 'Schwierigere Aufgaben.', topicIds: [t.id], minutes: scale(15), priority: 5 })
    } else if (t.level === 'solid') {
      learnItems.push({ type: 'practice', title: `${t.name}: Auffrischen`, description: 'Kurze Übung, damit es sicher bleibt.', topicIds: [t.id], minutes: scale(10), priority: 6 })
    } else {
      learnItems.push({ type: 'review', title: `${t.name}: Kurz wiederholen`, description: 'Du kannst das schon gut – ein kurzer Check genügt.', topicIds: [t.id], minutes: scale(10), priority: 7 })
    }
  }

  // Capacity check: drop the least important topic items first.
  const anchorMinutes = [...anchors.values()].flat().reduce((s, i) => s + i.minutes, 0)
  const capacity = N * perDay - anchorMinutes
  let needed = learnItems.reduce((s, i) => s + i.minutes, 0)
  const dropped: Item[] = []
  while (needed > capacity && learnItems.length > 0) {
    let worst = 0
    for (let i = 1; i < learnItems.length; i++) if (learnItems[i].priority >= learnItems[worst].priority) worst = i
    const [it] = learnItems.splice(worst, 1)
    dropped.push(it)
    needed -= it.minutes
  }
  if (dropped.length > 0) {
    const weakest = ordered.filter((t) => t.level === 'new' || t.level === 'struggling' || t.level === 'practicing').slice(0, 3).map((t) => t.name)
    warnings.push(
      `Die Zeit reicht nicht für alles (${dropped.length} Einheit${dropped.length === 1 ? '' : 'en'} gestrichen). ` +
        (weakest.length ? `Der Plan konzentriert sich auf: ${weakest.join(', ')}.` : 'Der Plan konzentriert sich auf das Wichtigste.') +
        ' Mehr Minuten pro Tag oder zusätzliche Lerntage würden helfen.',
    )
  }

  // Place items day by day. Topic blocks go before the mock exam; spaced reviews 2 days after learning.
  const schedule: Item[][] = days.map((_, i) => [...(anchors.get(i) ?? [])])
  const used = (i: number) => schedule[i].reduce((s, it) => s + it.minutes, 0)
  const lastTopicDay = mockIdx > 0 ? mockIdx - 1 : N - 2
  let cursor = 0
  const pendingReviews: { day: number; topicId: string }[] = []
  for (const item of learnItems) {
    let placed = false
    for (let i = cursor; i <= Math.max(lastTopicDay, cursor) && i < N; i++) {
      if (used(i) + item.minutes <= perDay) {
        schedule[i].push(item)
        cursor = i
        placed = true
        if (item.type === 'learn') pendingReviews.push({ day: i + 2, topicId: item.topicIds[0] })
        break
      }
    }
    if (!placed) {
      // Fall back to any day with room (after the mock exam is fine for practice).
      for (let i = 0; i < N; i++) {
        if (used(i) + item.minutes <= perDay) {
          schedule[i].push(item)
          placed = true
          break
        }
      }
    }
    if (!placed) dropped.push(item)
  }
  // Spaced reviews: group topics due the same day into one session.
  const reviewsByDay = new Map<number, string[]>()
  for (const r of pendingReviews) {
    const d = Math.min(r.day, N - 1)
    if (d === N - 1) continue // final revision covers it
    reviewsByDay.set(d, [...(reviewsByDay.get(d) ?? []), r.topicId])
  }
  for (const [d, ids] of reviewsByDay) {
    const minutes = scale(10)
    let day = d
    while (day < N - 1 && used(day) + minutes > perDay) day++
    if (day < N - 1) schedule[day].push({ type: 'review', title: 'Verteilte Wiederholung', description: `Kurz wiederholen, was du vor zwei Tagen gelernt hast: ${names(ids)}.`, topicIds: ids, minutes, priority: 4 })
  }
  // Remaining capacity before the test → mixed practice on the weakest topics.
  const weakIds = ordered.filter((t) => t.level !== 'mastered').slice(0, 3).map((t) => t.id)
  if (weakIds.length > 0) {
    for (let i = 1; i < N - 1; i++) {
      if (schedule[i].length === 0 && perDay - used(i) >= 10) {
        schedule[i].push({ type: 'practice', title: 'Gemischte Übung', description: `Aufgaben gemischt aus: ${names(weakIds)}. Gemischtes Üben hilft, Aufgabentypen zu unterscheiden.`, topicIds: weakIds, minutes: scale(15), priority: 8 })
      }
    }
  }

  const order: PlanSessionType[] = ['diagnostic', 'learn', 'practice', 'review', 'mock', 'analysis', 'final']
  const sessions: PlanSession[] = [...kept]
  schedule.forEach((items, i) => {
    items
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
      .forEach((it) => {
        sessions.push({ id: uid('ps'), date: days[i], type: it.type, title: it.title, description: it.description, topicIds: it.topicIds, minutes: it.minutes, done: false, doneAt: null, attemptId: null })
      })
  })
  if (N === 1) warnings.push('Nur noch ein Lerntag: Der Plan beschränkt sich auf eine kompakte Wiederholung.')
  if (daysUntil > 42) warnings.push('Die Prüfung ist noch weit weg. Der Plan ist lang – du kannst ihn später neu berechnen, wenn du mehr Daten hast.')
  sessions.sort((a, b) => a.date.localeCompare(b.date) || order.indexOf(a.type) - order.indexOf(b.type))
  return { sessions, warnings }
}
