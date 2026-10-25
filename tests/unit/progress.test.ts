import { describe, expect, it } from 'vitest'
import { countFixedMistakes, currentStreak, longestStreak } from '@/lib/progress'
import { recommendTopics, buildTodayTasks } from '@/lib/recommend'
import { computeTopicStats } from '@/lib/mastery'
import type { Answer, Exam, Subject, Topic } from '@/db/types'

describe('streaks', () => {
  const active = new Set(['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'])
  it('today not yet active does not break the streak', () => {
    expect(currentStreak(active, '2026-10-24', [], null)).toBe(2)
  })
  it('a missed day breaks it unless it is a rest day or paused', () => {
    expect(currentStreak(active, '2026-10-23', [], null)).toBe(2)
    // 2026-10-21 is a Wednesday (3)
    expect(currentStreak(active, '2026-10-23', [3], null)).toBe(4)
    expect(currentStreak(active, '2026-10-23', [], '2026-10-21')).toBe(4)
    expect(longestStreak(active, '2026-10-23', [3], null)).toBe(4)
  })
})

const now = new Date('2026-10-20T12:00:00')
let i = 0
const ans = (topicId: string, questionId: string, daysAgo: number, correct: boolean): Answer => ({
  id: `a${i++}`, attemptId: 'x', questionId, subjectId: 's1', topicId, given: '', correct, score: correct ? 1 : 0,
  at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), hintsUsed: 0, timeMs: 1, mode: 'practice', selfAssessed: false, feedback: '', errorTag: null,
})

describe('countFixedMistakes', () => {
  it('counts a mistake as fixed after two later correct answers', () => {
    expect(countFixedMistakes([ans('t', 'q', 3, false), ans('t', 'q', 2, true), ans('t', 'q', 1, true)])).toBe(1)
    expect(countFixedMistakes([ans('t', 'q', 3, false), ans('t', 'q', 2, true)])).toBe(0)
  })
})

describe('recommendTopics', () => {
  const subjects: Subject[] = [{ id: 's1', name: 'Mathe', color: 0, order: 0, createdAt: '' }]
  const mk = (id: string, prereq: string[] = []): Topic => ({ id, subjectId: 's1', parentId: null, name: id.toUpperCase(), description: '', order: 0, prerequisiteIds: prereq, curriculum: 'own', createdAt: '' })
  const topics = [mk('wrong'), mk('exam'), mk('done'), mk('base'), mk('top', ['base'])]
  const answers = [
    ans('wrong', 'q1', 1, false), ans('wrong', 'q2', 1, false), ans('wrong', 'q3', 0, false),
    ...[0, 0, 0, 2, 2, 2, 5, 5, 5, 5].map((d, k) => ans('done', `d${k}`, d, true)),
    ans('base', 'b1', 10, false), ans('base', 'b2', 10, true),
  ]
  const stats = new Map(topics.map((t) => [t.id, computeTopicStats(t.id, answers, now)]))
  const exams: Exam[] = [{ id: 'e', subjectId: 's1', title: 'KA', type: 'Klassenarbeit', date: '2026-10-25', topicIds: ['exam', 'top'], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [], notes: '', plan: [], planWarnings: [], planGeneratedAt: null, gradingScaleId: null, createdAt: '' }]
  const mistakes = [{ questionId: 'q1', topicId: 'wrong', subjectId: 's1', lastWrong: answers[0], wrongCount: 1, correctSince: 0 }]
  const recs = recommendTopics({ topics, subjects, stats, mistakes, exams, today: '2026-10-20' })
  it('puts repeated mistakes and exam topics before mastered ones, with reasons', () => {
    const ids = recs.map((r) => r.topicId)
    expect(ids[0]).toBe('wrong')
    expect(ids).toContain('exam')
    expect(recs.find((r) => r.topicId === 'exam')!.reasons.join(' ')).toMatch(/Klassenarbeit in 5 Tagen/)
    const done = recs.find((r) => r.topicId === 'done')
    if (done) expect(ids.indexOf('done')).toBeGreaterThan(ids.indexOf('exam'))
  })
  it('flags foundations of topics needed soon', () => {
    expect(recs.find((r) => r.topicId === 'base')!.reasons.join(' ')).toMatch(/Grundlage für/)
  })
  it('today tasks respect the daily budget order', () => {
    const tasks = buildTodayTasks({ dailyGoalMinutes: 20, planSessionsToday: [], openMistakeCount: 3, dueCards: [{ deckId: 'd', deckName: 'Englisch Unit 1', count: 12, fresh: 0 }], recommendations: recs, topicName: (id) => id })
    expect(tasks[0].kind).toBe('mistakes')
    expect(tasks[1].kind).toBe('cards')
  })
})
