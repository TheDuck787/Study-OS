import type { Answer, DayKey, Question } from '@/db/types'
import { addDays, dayKey, daysBetweenDates } from './dates'

/**
 * Topic mastery – deliberately simple and explainable:
 *
 *   mastery = Σ(weight · score) / (Σ weight + PRIOR)
 *
 * - Every answer counts; newer answers count more (weight halves every 30 days).
 * - PRIOR = 2 acts like two "imaginary wrong answers" at the start, so one correct
 *   answer gives only 33 % and a topic can never be "gefestigt" after one answer.
 * - Levels additionally require enough answers on enough different days.
 */
export const HALF_LIFE_DAYS = 30
export const PRIOR = 2

export type MasteryLevel = 'new' | 'struggling' | 'practicing' | 'solid' | 'mastered'

export const LEVEL_LABELS: Record<MasteryLevel, string> = {
  new: 'Noch nicht geübt',
  struggling: 'Häufig falsch',
  practicing: 'Braucht Übung',
  solid: 'Gut verstanden',
  mastered: 'Gefestigt',
}

export const LEVEL_ORDER: MasteryLevel[] = ['new', 'struggling', 'practicing', 'solid', 'mastered']

export interface TopicStats {
  topicId: string
  answers: number
  correct: number
  mastery: number // 0..1
  level: MasteryLevel
  distinctDays: number
  lastPracticed: string | null // ISO
  recentWrong: number // wrong answers in the last 14 days
  lastThreeCorrect: boolean
  hardAttempts: number
  hardCorrectRate: number | null
  /** Ready for harder questions (solid understanding, few hard questions tried yet or doing well on them). */
  challengeReady: boolean
  nextReview: DayKey | null
  /** German one-line explanation of how the level was reached. */
  explanation: string
}

type AnswerLike = Pick<Answer, 'topicId' | 'score' | 'correct' | 'at' | 'questionId'>

export function computeTopicStats(
  topicId: string,
  answers: AnswerLike[],
  now: Date = new Date(),
  questionDifficulty?: (questionId: string) => Question['difficulty'] | undefined,
): TopicStats {
  const list = answers.filter((a) => a.topicId === topicId).sort((a, b) => a.at.localeCompare(b.at))
  const n = list.length
  if (n === 0) {
    return {
      topicId, answers: 0, correct: 0, mastery: 0, level: 'new', distinctDays: 0, lastPracticed: null,
      recentWrong: 0, lastThreeCorrect: false, hardAttempts: 0, hardCorrectRate: null, challengeReady: false,
      nextReview: null, explanation: 'Zu diesem Thema gibt es noch keine Antworten.',
    }
  }

  let wSum = 0
  let wScore = 0
  const days = new Set<string>()
  let recentWrong = 0
  let hardAttempts = 0
  let hardCorrect = 0
  for (const a of list) {
    const age = Math.max(0, daysBetweenDates(a.at, now))
    const w = Math.pow(0.5, age / HALF_LIFE_DAYS)
    wSum += w
    wScore += w * a.score
    days.add(dayKey(a.at))
    if (!a.correct && age <= 14) recentWrong++
    const diff = questionDifficulty?.(a.questionId)
    if (diff !== undefined && diff >= 3) {
      hardAttempts++
      if (a.correct) hardCorrect++
    }
  }
  const mastery = wScore / (wSum + PRIOR)
  const correct = list.filter((a) => a.correct).length
  const last3 = list.slice(-3)
  const lastThreeCorrect = last3.length === 3 && last3.every((a) => a.correct)
  const distinctDays = days.size
  const accuracy = correct / n

  let level: MasteryLevel
  let explanation: string
  if (mastery >= 0.75 && n >= 8 && distinctDays >= 3 && lastThreeCorrect) {
    level = 'mastered'
    explanation = `${correct} von ${n} richtig an ${distinctDays} verschiedenen Tagen, die letzten 3 Antworten waren richtig.`
  } else if (mastery >= 0.6 && n >= 5 && distinctDays >= 2) {
    level = 'solid'
    explanation = `${correct} von ${n} richtig an ${distinctDays} Tagen. Für „gefestigt“ braucht es mindestens 8 Antworten an 3 Tagen und 3 richtige in Folge.`
  } else if (n >= 3 && accuracy < 0.5) {
    level = 'struggling'
    explanation = `Nur ${correct} von ${n} Antworten richtig – hier lohnt sich Üben in kleinen Schritten.`
  } else {
    level = 'practicing'
    explanation =
      n < 5
        ? `Erst ${n} Antwort${n === 1 ? '' : 'en'} – für eine sichere Einschätzung braucht es mehr Übung an mehreren Tagen.`
        : `${correct} von ${n} richtig – noch nicht stabil genug für „gut verstanden“.`
  }

  const hardCorrectRate = hardAttempts > 0 ? hardCorrect / hardAttempts : null
  const challengeReady =
    (level === 'solid' || level === 'mastered') && (hardAttempts < 3 || (hardCorrectRate ?? 0) >= 0.7)

  const lastPracticed = list[n - 1].at
  return {
    topicId, answers: n, correct, mastery, level, distinctDays, lastPracticed, recentWrong, lastThreeCorrect,
    hardAttempts, hardCorrectRate, challengeReady,
    nextReview: addDays(dayKey(lastPracticed), reviewIntervalDays(level, distinctDays)),
    explanation,
  }
}

/** Topic-level spaced repetition: how many days until a topic should come back. */
export function reviewIntervalDays(level: MasteryLevel, distinctDays: number): number {
  switch (level) {
    case 'new':
      return 0
    case 'struggling':
      return 1
    case 'practicing':
      return 2
    case 'solid':
      return 5
    case 'mastered':
      return Math.min(45, 14 + Math.max(0, distinctDays - 3) * 7)
  }
}

export function computeAllTopicStats(
  topicIds: string[],
  answers: AnswerLike[],
  now: Date = new Date(),
  questionDifficulty?: (questionId: string) => Question['difficulty'] | undefined,
): Map<string, TopicStats> {
  const byTopic = new Map<string, AnswerLike[]>()
  for (const a of answers) {
    const arr = byTopic.get(a.topicId)
    if (arr) arr.push(a)
    else byTopic.set(a.topicId, [a])
  }
  const out = new Map<string, TopicStats>()
  for (const id of topicIds) out.set(id, computeTopicStats(id, byTopic.get(id) ?? [], now, questionDifficulty))
  return out
}

/** Average mastery of a set of topics (used per subject). Untouched topics count as 0. */
export function averageMastery(stats: TopicStats[]): number {
  if (stats.length === 0) return 0
  return stats.reduce((s, t) => s + t.mastery, 0) / stats.length
}
