import { db } from '@/db/index'
import type { AttemptKind, Card, Deck, Difficulty, Question, QuestionType } from '@/db/types'
import { computeTopicStats, type TopicStats } from '@/lib/mastery'
import { openMistakes } from '@/lib/mistakes'
import { SKILLS, generateQuestion } from '@/lib/mathgen'
import { shuffle } from '@/lib/id'

export type DifficultyChoice = 'adaptive' | Difficulty
export type Preset = 'quick' | 'mistakes' | 'practice' | 'challenge' | 'learn' | 'review' | 'diagnostic' | 'mock'

export interface QuizConfig {
  kind: AttemptKind
  mode: 'practice' | 'exam'
  title: string
  subjectId: string | null
  topicIds: string[]
  types: QuestionType[]
  count: number
  difficulty: DifficultyChoice
  source: 'all' | 'library' | 'own'
  useGenerators: boolean
  examId?: string | null
  planSessionId?: string | null
}

/** Difficulty that fits the current mastery – simple and explainable. */
export function targetDifficulty(s: TopicStats | undefined): Difficulty[] {
  if (!s || s.level === 'new') return [1, 2]
  if (s.level === 'struggling') return [1, 2]
  if (s.level === 'practicing') return s.mastery < 0.45 ? [1, 2] : [2, 3]
  return s.challengeReady ? [3, 4] : [2, 3]
}

function skillsForTopic(topicId: string) {
  return SKILLS.filter((s) => s.topicKey === topicId)
}

/**
 * Picks questions for a quiz:
 * open mistakes first (practice), then unanswered, then least recently answered; difficulty
 * adapted to mastery; math topics are topped up with generated exercises.
 */
export async function buildQuestions(cfg: QuizConfig): Promise<Question[]> {
  let topicIds = cfg.topicIds
  if (topicIds.length === 0 && cfg.subjectId) topicIds = (await db.topics.where('subjectId').equals(cfg.subjectId).toArray()).map((t) => t.id)
  const allAnswers = await db.answers.toArray()
  const stats = new Map(topicIds.map((t) => [t, computeTopicStats(t, allAnswers)]))
  let pool = topicIds.length ? await db.questions.where('topicId').anyOf(topicIds).toArray() : cfg.subjectId ? await db.questions.where('subjectId').equals(cfg.subjectId).toArray() : await db.questions.toArray()
  pool = pool.filter((q) => q.source !== 'generator')
  if (cfg.types.length) pool = pool.filter((q) => cfg.types.includes(q.type))
  if (cfg.source === 'library') pool = pool.filter((q) => q.source === 'library')
  if (cfg.source === 'own') pool = pool.filter((q) => q.source !== 'library')

  const wanted = (q: Question) => (cfg.difficulty === 'adaptive' ? targetDifficulty(stats.get(q.topicId)).includes(q.difficulty) : q.difficulty === cfg.difficulty)
  const open = new Set(openMistakes(allAnswers).map((m) => m.questionId))
  const lastSeen = new Map<string, string>()
  for (const a of allAnswers) if ((lastSeen.get(a.questionId) ?? '') < a.at) lastSeen.set(a.questionId, a.at)

  const rank = (q: Question) => {
    let r = 0
    if (cfg.mode === 'practice' && open.has(q.id)) r -= 100
    if (wanted(q)) r -= 50
    const seen = lastSeen.get(q.id)
    if (!seen) r -= 25
    else r += (Date.now() - new Date(seen).getTime() < 86_400_000 ? 30 : 0)
    return r + Math.random() * 20
  }
  // spread across topics so one big topic doesn't crowd out the others
  const byTopic = new Map<string, Question[]>()
  for (const q of pool.sort((a, b) => rank(a) - rank(b))) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q])
  const picked: Question[] = []
  const queues = [...byTopic.values()]
  while (picked.length < cfg.count && queues.some((q) => q.length)) {
    for (const queue of queues) {
      const q = queue.shift()
      if (q && picked.length < cfg.count) picked.push(q)
    }
  }

  // Math: top up (or mix in) generated exercises
  const allowGen = cfg.useGenerators && (cfg.types.length === 0 || cfg.types.includes('math') || cfg.types.includes('numeric'))
  if (allowGen) {
    const genTopics = topicIds.filter((t) => skillsForTopic(t).length > 0)
    let guard = 0
    while (picked.length < cfg.count && genTopics.length > 0 && guard++ < 200) {
      const topicId = genTopics[picked.length % genTopics.length]
      const skill = shuffle(skillsForTopic(topicId))[0]
      const diffs = cfg.difficulty === 'adaptive' ? targetDifficulty(stats.get(topicId)) : [cfg.difficulty]
      const d = diffs[Math.floor(Math.random() * diffs.length)]
      const topic = await db.topics.get(topicId)
      if (!topic) break
      const q = generateQuestion(skill.key, d, { subjectId: topic.subjectId, topicId })
      if (cfg.types.length && !cfg.types.includes(q.type)) continue
      picked.push(q)
    }
  }
  return cfg.mode === 'exam' ? picked : shuffle(picked)
}

/** Questions that are still open mistakes (optionally limited to a subject/topic). */
export async function mistakeQuestions(limit = 10, filter: { subjectId?: string; topicId?: string } = {}): Promise<Question[]> {
  const answers = await db.answers.toArray()
  let open = openMistakes(answers)
  if (filter.subjectId) open = open.filter((m) => m.subjectId === filter.subjectId)
  if (filter.topicId) open = open.filter((m) => m.topicId === filter.topicId)
  const qs = await db.questions.bulkGet(open.slice(0, limit).map((m) => m.questionId))
  return qs.filter((q): q is Question => !!q)
}

/** 5-minute session: a few open mistakes plus questions from the most urgent topics. */
export async function quickSessionQuestions(recommendedTopicIds: string[]): Promise<Question[]> {
  const fromMistakes = await mistakeQuestions(3)
  const rest = await buildQuestions({
    kind: 'quick', mode: 'practice', title: '', subjectId: null, topicIds: recommendedTopicIds.slice(0, 3), types: [], count: 6 - fromMistakes.length,
    difficulty: 'adaptive', source: 'all', useGenerators: true,
  })
  const ids = new Set(fromMistakes.map((q) => q.id))
  const combined = [...fromMistakes, ...rest.filter((q) => !ids.has(q.id))]
  if (combined.length < 6) {
    // no recommendations yet (new student): fill from anything available
    const any = shuffle(await db.questions.filter((q) => q.source !== 'generator' && q.difficulty <= 2).toArray()).slice(0, 6 - combined.length)
    combined.push(...any.filter((q) => !ids.has(q.id)))
  }
  return combined
}

/** Vocabulary test from a deck: one card = one question (stable id so mistakes accumulate per card). */
export function vocabQuestions(deck: Deck, cards: Card[], direction: 'front-back' | 'back-front', count: number): Question[] {
  const now = new Date().toISOString()
  return shuffle(cards)
    .slice(0, count)
    .map((c) => ({
      id: `vq_${c.id}_${direction}`,
      subjectId: deck.subjectId ?? 'none',
      topicId: c.topicId ?? deck.topicId ?? `deck:${deck.id}`,
      type: 'vocab' as const,
      prompt: direction === 'front-back' ? `Was bedeutet **${c.front}**?` : `Übersetze: **${c.back}**`,
      answer: direction === 'front-back' ? c.back : c.front,
      explanation: c.example ? `Beispiel: _${c.example}_` : '',
      hints: [direction === 'front-back' ? `Beginnt mit „${c.back.replace(/^(der|die|das|to)\s+/i, '').slice(0, 1)}…“` : `Beginnt mit „${c.front.replace(/^(to)\s+/i, '').slice(0, 1)}…“`],
      difficulty: 2 as Difficulty,
      points: 1,
      source: 'generator' as const,
      skill: 'vocab',
      createdAt: now,
    }))
}
