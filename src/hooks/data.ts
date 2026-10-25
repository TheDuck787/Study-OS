import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '@/db/index'
import type { Answer, Card, Question } from '@/db/types'
import { computeAllTopicStats, type TopicStats } from '@/lib/mastery'
import { openMistakes, type OpenMistake } from '@/lib/mistakes'
import { selectDueCards } from '@/lib/srs'
import { dayKey } from '@/lib/dates'
import { detectAi, type AiAvailability } from '@/lib/ai/client'

export const useProfile = () => useLiveQuery(async () => (await db.profile.get('me')) ?? null, [])
export const useSubjects = () => useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
export const useTopics = (subjectId?: string) =>
  useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.orderBy('order').toArray()), [subjectId])
export const useAnswers = () => useLiveQuery(() => db.answers.toArray(), [])
export const useExams = () => useLiveQuery(() => db.exams.orderBy('date').toArray(), [])
export const useDecks = () => useLiveQuery(() => db.decks.toArray(), [])
export const useScales = () => useLiveQuery(() => db.gradingScales.toArray(), [])

/** Difficulty lookup for mastery ("challenge ready" needs to know which questions were hard). */
export function useQuestionDifficulty() {
  const qs = useLiveQuery(() => db.questions.toArray(), [])
  return useMemo(() => {
    const m = new Map<string, Question['difficulty']>()
    for (const q of qs ?? []) m.set(q.id, q.difficulty)
    return { ready: !!qs, get: (id: string) => m.get(id) }
  }, [qs])
}

export function useTopicStats(): { stats: Map<string, TopicStats>; answers: Answer[]; ready: boolean } {
  const topics = useTopics()
  const answers = useAnswers()
  const diff = useQuestionDifficulty()
  return useMemo(() => {
    if (!topics || !answers || !diff.ready) return { stats: new Map(), answers: [], ready: false }
    return { stats: computeAllTopicStats(topics.map((t) => t.id), answers, new Date(), diff.get), answers, ready: true }
  }, [topics, answers, diff])
}

export function useOpenMistakes(): OpenMistake[] | undefined {
  const answers = useAnswers()
  return useMemo(() => (answers ? openMistakes(answers) : undefined), [answers])
}

export function useDueCards(): { cards: Card[]; byDeck: Map<string, { reviews: number; fresh: number }>; reviewCount: number; newCount: number } | undefined {
  const today = dayKey()
  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), reviews: await db.cardReviews.toArray() }), [today])
  return useMemo(() => {
    if (!data) return undefined
    const { reviews, fresh } = selectDueCards(data.cards, data.reviews)
    const byDeck = new Map<string, { reviews: number; fresh: number }>()
    for (const c of reviews) byDeck.set(c.deckId, { reviews: (byDeck.get(c.deckId)?.reviews ?? 0) + 1, fresh: byDeck.get(c.deckId)?.fresh ?? 0 })
    for (const c of fresh) byDeck.set(c.deckId, { reviews: byDeck.get(c.deckId)?.reviews ?? 0, fresh: (byDeck.get(c.deckId)?.fresh ?? 0) + 1 })
    return { cards: [...reviews, ...fresh], byDeck, reviewCount: reviews.length, newCount: fresh.length }
  }, [data])
}

export function useAi(): AiAvailability | null {
  const [ai, setAi] = useState<AiAvailability | null>(null)
  useEffect(() => {
    let alive = true
    detectAi().then((a) => alive && setAi(a))
    const onChange = () => detectAi(true).then((a) => alive && setAi(a))
    window.addEventListener('studyos:ai-changed', onChange)
    return () => {
      alive = false
      window.removeEventListener('studyos:ai-changed', onChange)
    }
  }, [])
  return ai
}
