import { describe, expect, it } from 'vitest'
import { computeTopicStats } from '@/lib/mastery'
import { openMistakes, recurringPatterns } from '@/lib/mistakes'
import type { Answer } from '@/db/types'

const now = new Date('2026-10-20T12:00:00')
let n = 0
function ans(daysAgo: number, correct: boolean, opts: Partial<Answer> = {}): Answer {
  const at = new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  return {
    id: `a${n++}`, attemptId: 'x', questionId: opts.questionId ?? `q${n}`, subjectId: 's', topicId: 't', given: '', correct,
    score: correct ? 1 : 0, at, hintsUsed: 0, timeMs: 1000, mode: 'practice', selfAssessed: false, feedback: '', errorTag: null, ...opts,
  }
}

describe('computeTopicStats', () => {
  it('new topic has level new', () => {
    expect(computeTopicStats('t', [], now).level).toBe('new')
  })
  it('one correct answer is never mastered', () => {
    const s = computeTopicStats('t', [ans(0, true)], now)
    expect(s.mastery).toBeCloseTo(1 / 3)
    expect(s.level).toBe('practicing')
  })
  it('many correct answers on one day are not mastered (needs several days)', () => {
    const list = Array.from({ length: 12 }, () => ans(0, true))
    const s = computeTopicStats('t', list, now)
    expect(s.level).not.toBe('mastered')
    expect(s.level).toBe('practicing')
  })
  it('consistent correct answers over several days → mastered', () => {
    const list = [0, 0, 0, 2, 2, 2, 5, 5, 5, 5].map((d) => ans(d, true))
    const s = computeTopicStats('t', list, now)
    expect(s.level).toBe('mastered')
    expect(s.nextReview).not.toBeNull()
  })
  it('mostly wrong → struggling', () => {
    const s = computeTopicStats('t', [ans(1, false), ans(1, false), ans(0, true), ans(0, false)], now)
    expect(s.level).toBe('struggling')
    expect(s.recentWrong).toBe(3)
  })
  it('recent answers weigh more than old ones', () => {
    const oldWrongNewRight = computeTopicStats('t', [ans(90, false), ans(90, false), ans(1, true), ans(1, true)], now)
    const oldRightNewWrong = computeTopicStats('t', [ans(90, true), ans(90, true), ans(1, false), ans(1, false)], now)
    expect(oldWrongNewRight.mastery).toBeGreaterThan(oldRightNewWrong.mastery)
  })
  it('a wrong last answer prevents mastered', () => {
    const list = [0, 0, 0, 2, 2, 2, 5, 5, 5, 5].map((d) => ans(d, true))
    list.push(ans(0, false))
    expect(computeTopicStats('t', list, now).level).not.toBe('mastered')
  })
})

describe('openMistakes', () => {
  it('stays open until two correct answers follow the last wrong one', () => {
    const q = 'q-x'
    const a1 = ans(3, false, { questionId: q })
    expect(openMistakes([a1])).toHaveLength(1)
    const a2 = ans(2, true, { questionId: q })
    expect(openMistakes([a1, a2])).toHaveLength(1)
    const a3 = ans(1, true, { questionId: q })
    expect(openMistakes([a1, a2, a3])).toHaveLength(0)
    const a4 = ans(0, false, { questionId: q })
    const open = openMistakes([a1, a2, a3, a4])
    expect(open).toHaveLength(1)
    expect(open[0].wrongCount).toBe(2)
  })
})

describe('recurringPatterns', () => {
  it('finds repeated error tags', () => {
    const list = [ans(1, false, { errorTag: 'sign-error' }), ans(2, false, { errorTag: 'sign-error' }), ans(2, false, { errorTag: 'rounding' })]
    const p = recurringPatterns(list)
    expect(p.find((x) => x.key === 'tag:sign-error')?.count).toBe(2)
    expect(p.find((x) => x.key === 'tag:rounding')).toBeUndefined()
  })
})
