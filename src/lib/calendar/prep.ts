import type { Answer, Card, CalendarEvent, Deck, DayKey, Exam, QuizAttempt, StudySession, Topic } from '@/db/types'
import { diffDays } from '../dates'
import { computeTopicStats, type MasteryLevel } from '../mastery'
import { openMistakes } from '../mistakes'
import { selectDueCards } from '../srs'
import { eventMinutes } from './planner'

/** Mastery at which a topic counts as "ready for the test" (level "solid" starts at about this value). */
export const READY_MASTERY = 0.75

export interface PrepTopic {
  id: string
  name: string
  mastery: number
  level: MasteryLevel
  answers: number
  /** Student's own rating 1–5 (null = not rated). Never mixed into the measured values. */
  confidence: number | null
  needsRevision: boolean
  openMistakes: number
}

export interface ExamPrep {
  daysLeft: number
  topics: PrepTopic[]
  /**
   * Readiness 0..1 = average over the exam topics of min(1, mastery / READY_MASTERY).
   * Topics never practised count as 0. null when the exam has no topics.
   */
  readiness: number | null
  planDone: number
  planTotal: number
  /** Open planned minutes (plan sessions + study blocks linked to the exam). */
  remainingPlannedMinutes: number
  /** Studied minutes in this subject since the exam was created (measured). */
  studiedMinutes: number
  /** Student's own total estimate minus measured time (null without estimate). */
  remainingEstimateMinutes: number | null
  nextSessions: { date: DayKey; start: string | null; title: string; minutes: number }[]
  /** Flashcards of this subject that will be due up to the exam day. */
  cardsDueBeforeExam: number
  cardsDueToday: number
  quizzesCompleted: number
  mockExams: number
  weakTopics: PrepTopic[]
  finalSession: { date: DayKey; done: boolean } | null
}

export interface PrepInput {
  exam: Exam
  topics: Topic[]
  answers: Answer[]
  decks: Deck[]
  cards: Card[]
  cardReviews: { cardId: string; at: string }[]
  attempts: QuizAttempt[]
  sessions: StudySession[]
  events: CalendarEvent[]
  today: DayKey
  now?: Date
}

export function examPreparation(i: PrepInput): ExamPrep {
  const { exam, today } = i
  const now = i.now ?? new Date()
  const mistakes = openMistakes(i.answers)
  const topics: PrepTopic[] = exam.topicIds
    .map((id) => i.topics.find((t) => t.id === id))
    .filter((t): t is Topic => !!t)
    .map((t) => {
      const s = computeTopicStats(t.id, i.answers, now)
      const open = mistakes.filter((m) => m.topicId === t.id).length
      return {
        id: t.id, name: t.name, mastery: s.mastery, level: s.level, answers: s.answers, confidence: exam.topicConfidence?.[t.id] ?? null,
        needsRevision: s.mastery < READY_MASTERY || open > 0, openMistakes: open,
      }
    })
  const readiness = topics.length ? topics.reduce((sum, t) => sum + Math.min(1, t.mastery / READY_MASTERY), 0) / topics.length : null
  const linked = i.events.filter((e) => e.examId === exam.id && e.status !== 'cancelled')
  const openPlan = exam.plan.filter((s) => !s.done)
  const remainingPlannedMinutes = openPlan.reduce((s, p) => s + p.minutes, 0) + linked.filter((e) => e.status === 'planned').reduce((s, e) => s + eventMinutes(e), 0)
  const studiedMinutes = Math.round(
    i.sessions.filter((s) => s.subjectId === exam.subjectId && s.startedAt >= exam.createdAt).reduce((sum, s) => sum + s.durationSec, 0) / 60,
  )
  const nextSessions = [
    ...openPlan.filter((s) => s.date >= today).map((s) => ({ date: s.date, start: s.start ?? null, title: s.title, minutes: s.minutes })),
    ...linked.filter((e) => e.status === 'planned' && e.date >= today).map((e) => ({ date: e.date, start: e.start, title: e.title, minutes: eventMinutes(e) })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
  const deckIds = new Set(i.decks.filter((d) => d.subjectId === exam.subjectId || (d.topicId && exam.topicIds.includes(d.topicId))).map((d) => d.id))
  const subjectCards = i.cards.filter((c) => deckIds.has(c.deckId))
  const examEnd = `${exam.date}T23:59:59`
  const cardsDueBeforeExam = subjectCards.filter((c) => c.srs.state === 'new' || c.srs.due <= new Date(examEnd).toISOString()).length
  const due = selectDueCards(subjectCards, i.cardReviews.filter((r) => subjectCards.some((c) => c.id === r.cardId)), now)
  const topicSet = new Set(exam.topicIds)
  const finished = i.attempts.filter((a) => a.finishedAt && (a.examId === exam.id || (a.startedAt >= exam.createdAt && a.topicIds.some((t) => topicSet.has(t)))))
  const final = exam.plan.find((s) => s.type === 'final')
  return {
    daysLeft: diffDays(today, exam.date),
    topics,
    readiness,
    planDone: exam.plan.filter((s) => s.done).length,
    planTotal: exam.plan.length,
    remainingPlannedMinutes,
    studiedMinutes,
    remainingEstimateMinutes: exam.estimatedPrepMinutes ? Math.max(0, exam.estimatedPrepMinutes - studiedMinutes) : null,
    nextSessions: nextSessions.slice(0, 5),
    cardsDueBeforeExam,
    cardsDueToday: due.reviews.length + due.fresh.length,
    quizzesCompleted: finished.length,
    mockExams: finished.filter((a) => a.kind === 'mock').length,
    weakTopics: topics.filter((t) => t.needsRevision).sort((a, b) => a.mastery - b.mastery).slice(0, 3),
    finalSession: final ? { date: final.date, done: final.done } : null,
  }
}
