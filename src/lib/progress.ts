import type { Answer, CardReview, DayKey, Exam, QuizAttempt, StudySession, XpEvent } from '@/db/types'
import { addDays, dayKey, diffDays, startOfWeek, weekday } from './dates'
import type { TopicStats } from './mastery'

/**
 * XP rewards learning, not time on the site:
 * correct answers (more for harder questions), fixing an old mistake, due card reviews,
 * finished plan sessions and reaching a new mastery level.
 */
export const XP_RULES = {
  correctAnswer: (difficulty: number, hintsUsed: number) => (hintsUsed > 0 ? 1 : Math.max(1, difficulty)),
  fixedMistake: 3,
  dueCardReview: 1,
  dailyCardXpCap: 60,
  quizFinished: 5,
  quizFinishedMinQuestions: 5,
  planSession: 10,
  levelSolid: 15,
  levelMastered: 30,
}

export const XP_EXPLANATION = [
  'Richtige Antwort: 1–4 XP je nach Schwierigkeit (mit Hinweis 1 XP)',
  'Alten Fehler richtig beantwortet: +3 XP',
  'Fällige Karteikarte wiederholt: 1 XP (vorzeitiges Wiederholen gibt keine XP)',
  'Quiz mit mindestens 5 Fragen beendet: +5 XP',
  'Lernplan-Einheit erledigt: +10 XP',
  'Thema „gut verstanden“: +15 XP, „gefestigt“: +30 XP',
  'Für reine Zeit auf der Seite gibt es keine XP.',
]

/** A day counts as a learning day with at least this much XP (≈ a few real answers or reviews). */
export const ACTIVE_DAY_XP = 5

export function xpByDay(events: XpEvent[]): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const e of events) m.set(e.day, (m.get(e.day) ?? 0) + e.amount)
  return m
}

export function activeDays(events: XpEvent[]): Set<DayKey> {
  const s = new Set<DayKey>()
  for (const [d, xp] of xpByDay(events)) if (xp >= ACTIVE_DAY_XP) s.add(d)
  return s
}

/** Rest days and pauses never break a streak – rest is part of learning. */
function isExcused(d: DayKey, restDays: number[], pausedUntil: DayKey | null): boolean {
  return restDays.includes(weekday(d)) || (pausedUntil !== null && d <= pausedUntil)
}

export function currentStreak(active: Set<DayKey>, today: DayKey, restDays: number[], pausedUntil: DayKey | null): number {
  let count = 0
  let d = today
  if (!active.has(today)) d = addDays(today, -1) // today is not over yet
  for (let i = 0; i < 3660; i++) {
    if (active.has(d)) count++
    else if (!isExcused(d, restDays, pausedUntil)) break
    d = addDays(d, -1)
  }
  return count
}

export function longestStreak(active: Set<DayKey>, today: DayKey, restDays: number[], pausedUntil: DayKey | null): number {
  if (active.size === 0) return 0
  const first = [...active].sort()[0]
  let best = 0
  let cur = 0
  for (let d = first; diffDays(d, today) >= 0; d = addDays(d, 1)) {
    if (active.has(d)) {
      cur++
      best = Math.max(best, cur)
    } else if (!isExcused(d, restDays, pausedUntil) && d !== today) cur = 0
  }
  return best
}

export interface ProgressSummary {
  totalXp: number
  xpToday: number
  streak: number
  longestStreak: number
  weekActiveDays: number
  weeklyGoalDays: number
  weekMinutes: number
  todayMinutes: number
  personalBests: { label: string; value: string }[]
  levelCounts: Record<string, number>
}

export function summarizeProgress(input: {
  xpEvents: XpEvent[]
  sessions: StudySession[]
  attempts: QuizAttempt[]
  answers: Answer[]
  cardReviews: CardReview[]
  stats: TopicStats[]
  restDays: number[]
  pausedUntil: DayKey | null
  weeklyGoalDays: number
  today?: DayKey
}): ProgressSummary {
  const today = input.today ?? dayKey()
  const active = activeDays(input.xpEvents)
  const byDay = xpByDay(input.xpEvents)
  const weekStart = startOfWeek(today)
  const weekActiveDays = [...active].filter((d) => d >= weekStart && d <= today).length
  const weekMinutes = input.sessions.filter((s) => s.day >= weekStart && s.day <= today).reduce((s, x) => s + x.durationSec, 0) / 60
  const todayMinutes = input.sessions.filter((s) => s.day === today).reduce((s, x) => s + x.durationSec, 0) / 60

  const finished = input.attempts.filter((a) => a.finishedAt && a.questionIds.length >= 5)
  const bestQuiz = finished.reduce((m, a) => Math.max(m, a.percent), -1)
  const correctByDay = new Map<string, number>()
  for (const a of input.answers) if (a.correct) correctByDay.set(dayKey(a.at), (correctByDay.get(dayKey(a.at)) ?? 0) + 1)
  const cardsByDay = new Map<string, number>()
  for (const r of input.cardReviews) cardsByDay.set(dayKey(r.at), (cardsByDay.get(dayKey(r.at)) ?? 0) + 1)
  const maxOf = (m: Map<string, number>) => [...m.values()].reduce((a, b) => Math.max(a, b), 0)

  const longest = longestStreak(active, today, input.restDays, input.pausedUntil)
  const personalBests = [
    { label: 'Längste Lernserie', value: `${longest} Tag${longest === 1 ? '' : 'e'}` },
    { label: 'Bestes Quiz (ab 5 Fragen)', value: bestQuiz >= 0 ? `${Math.round(bestQuiz)} %` : '–' },
    { label: 'Meiste richtige Antworten an einem Tag', value: String(maxOf(correctByDay)) },
    { label: 'Meiste Karteikarten an einem Tag', value: String(maxOf(cardsByDay)) },
    { label: 'Meiste XP an einem Tag', value: String(maxOf(byDay)) },
  ]
  const levelCounts: Record<string, number> = { new: 0, struggling: 0, practicing: 0, solid: 0, mastered: 0 }
  for (const s of input.stats) levelCounts[s.level]++

  return {
    totalXp: input.xpEvents.reduce((s, e) => s + e.amount, 0),
    xpToday: byDay.get(today) ?? 0,
    streak: currentStreak(active, today, input.restDays, input.pausedUntil),
    longestStreak: longest,
    weekActiveDays,
    weeklyGoalDays: input.weeklyGoalDays,
    weekMinutes,
    todayMinutes,
    personalBests,
    levelCounts,
  }
}

export interface AchievementDef {
  key: string
  title: string
  description: string
}

export interface AchievementContext {
  attempts: QuizAttempt[]
  answers: Answer[]
  cardReviews: CardReview[]
  stats: TopicStats[]
  exams: Exam[]
  streak: number
  longestStreak: number
  fixedMistakes: number
  weekGoalReached: boolean
}

export const ACHIEVEMENTS: (AchievementDef & { check: (c: AchievementContext) => boolean })[] = [
  { key: 'first-quiz', title: 'Erster Schritt', description: 'Das erste Quiz abgeschlossen.', check: (c) => c.attempts.some((a) => a.finishedAt) },
  { key: 'focused', title: 'Konzentriert', description: '20 richtige Antworten an einem Tag.', check: (c) => maxPerDay(c.answers.filter((a) => a.correct).map((a) => a.at)) >= 20 },
  { key: 'streak-3', title: 'Dranbleiben', description: '3 Lerntage in Folge (Ruhetage zählen nicht dagegen).', check: (c) => c.longestStreak >= 3 },
  { key: 'streak-7', title: 'Eine Woche', description: '7 Lerntage in Folge.', check: (c) => c.longestStreak >= 7 },
  { key: 'streak-30', title: 'Gewohnheit', description: '30 Lerntage in Folge.', check: (c) => c.longestStreak >= 30 },
  { key: 'first-solid', title: 'Verstanden', description: 'Ein Thema erreicht „gut verstanden“.', check: (c) => c.stats.some((s) => s.level === 'solid' || s.level === 'mastered') },
  { key: 'first-mastered', title: 'Gefestigt', description: 'Ein Thema ist gefestigt.', check: (c) => c.stats.some((s) => s.level === 'mastered') },
  { key: 'five-mastered', title: 'Solides Fundament', description: 'Fünf Themen sind gefestigt.', check: (c) => c.stats.filter((s) => s.level === 'mastered').length >= 5 },
  { key: 'mistake-fixer', title: 'Aus Fehlern gelernt', description: '10 Fehler nachträglich korrigiert.', check: (c) => c.fixedMistakes >= 10 },
  { key: 'cards-100', title: 'Kartenprofi', description: '100 Karteikarten wiederholt.', check: (c) => c.cardReviews.length >= 100 },
  { key: 'mock-done', title: 'Generalprobe', description: 'Eine Probeklausur abgeschlossen.', check: (c) => c.attempts.some((a) => a.kind === 'mock' && a.finishedAt) },
  { key: 'plan-complete', title: 'Plan erfüllt', description: 'Alle Einheiten eines Lernplans erledigt.', check: (c) => c.exams.some((e) => e.plan.length > 0 && e.plan.every((p) => p.done)) },
  { key: 'perfect', title: 'Fehlerfrei', description: '100 % in einem Quiz mit mindestens 8 Fragen.', check: (c) => c.attempts.some((a) => a.finishedAt && a.questionIds.length >= 8 && a.percent >= 100) },
  { key: 'explorer', title: 'Vielseitig', description: 'In drei verschiedenen Fächern geübt.', check: (c) => new Set(c.answers.map((a) => a.subjectId)).size >= 3 },
  { key: 'week-goal', title: 'Wochenziel', description: 'Das Wochenziel an Lerntagen erreicht.', check: (c) => c.weekGoalReached },
]

function maxPerDay(isoDates: string[]): number {
  const m = new Map<string, number>()
  for (const d of isoDates) m.set(dayKey(d), (m.get(dayKey(d)) ?? 0) + 1)
  return [...m.values()].reduce((a, b) => Math.max(a, b), 0)
}

/** Number of mistakes that were later answered correctly twice in a row (resolved). */
export function countFixedMistakes(answers: Answer[]): number {
  const byQ = new Map<string, Answer[]>()
  for (const a of answers) byQ.set(a.questionId, [...(byQ.get(a.questionId) ?? []), a])
  let fixed = 0
  for (const list of byQ.values()) {
    list.sort((a, b) => a.at.localeCompare(b.at))
    let sawWrong = false
    let correctAfter = 0
    for (const a of list) {
      if (!a.correct) {
        sawWrong = true
        correctAfter = 0
      } else if (sawWrong) {
        correctAfter++
        if (correctAfter === 2) {
          fixed++
          sawWrong = false
          correctAfter = 0
        }
      }
    }
  }
  return fixed
}
