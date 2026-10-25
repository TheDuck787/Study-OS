import { describe, expect, it } from 'vitest'
import { isDue, newSrs, retentionRate, reviewCard } from '@/lib/srs'
import type { SrsState } from '@/db/types'

const now = new Date('2026-10-01T10:00:00Z')
const days = (iso: string) => (new Date(iso).getTime() - now.getTime()) / 86_400_000

describe('reviewCard', () => {
  it('new card: good → 1 day, then good → 3 days and review state', () => {
    const a = reviewCard(newSrs(now), 'good', now)
    expect(a.intervalDays).toBe(1)
    expect(a.state).toBe('learning')
    const b = reviewCard(a, 'good', now)
    expect(b.intervalDays).toBe(3)
    expect(b.state).toBe('review')
  })
  it('again brings the card back within the session and lowers ease', () => {
    const r = reviewCard(newSrs(now), 'again', now)
    expect(days(r.due) * 24 * 60).toBeCloseTo(10)
    expect(r.ease).toBeCloseTo(2.3)
  })
  it('review intervals grow and are capped', () => {
    let s: SrsState = { ...newSrs(now), state: 'review' as const, intervalDays: 100, ease: 2.5, reps: 5 }
    s = reviewCard(s, 'good', now)
    expect(s.intervalDays).toBe(180)
  })
  it('a lapse counts only for review cards and ease never drops below 1.3', () => {
    let s: SrsState = { ...newSrs(now), state: 'review' as const, intervalDays: 10, ease: 1.35, reps: 3 }
    s = reviewCard(s, 'again', now)
    expect(s.lapses).toBe(1)
    expect(s.ease).toBe(1.3)
  })
  it('easy grows faster than good, hard slower', () => {
    const base = { ...newSrs(now), state: 'review' as const, intervalDays: 10, ease: 2.5, reps: 3 }
    const hard = reviewCard(base, 'hard', now).intervalDays
    const good = reviewCard(base, 'good', now).intervalDays
    const easy = reviewCard(base, 'easy', now).intervalDays
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })
  it('isDue respects due date', () => {
    const s = reviewCard(newSrs(now), 'good', now)
    expect(isDue(s, now)).toBe(false)
    expect(isDue(s, new Date(now.getTime() + 2 * 86_400_000))).toBe(true)
  })
})

describe('retentionRate', () => {
  it('ignores reviews of brand-new cards', () => {
    expect(retentionRate([{ rating: 'again', intervalBefore: 0 }])).toBeNull()
    expect(retentionRate([{ rating: 'good', intervalBefore: 3 }, { rating: 'again', intervalBefore: 5 }])).toBe(0.5)
  })
})

import { NEW_CARDS_PER_DAY, selectDueCards } from '@/lib/srs'
describe('selectDueCards', () => {
  const mk = (id: string, state: 'new' | 'review', dueOffsetDays: number) => ({
    id, createdAt: `2026-01-01T00:00:${id.padStart(2, '0')}Z`,
    srs: { ...newSrs(now), state, due: new Date(now.getTime() + dueOffsetDays * 86_400_000).toISOString() },
  })
  it('limits new cards per day and keeps all due reviews', () => {
    const cards = [...Array.from({ length: 30 }, (_, i) => mk(String(i), 'new', 0)), mk('90', 'review', -1), mk('91', 'review', 3)]
    const r = selectDueCards(cards, [], now)
    expect(r.fresh).toHaveLength(NEW_CARDS_PER_DAY)
    expect(r.reviews.map((c) => c.id)).toEqual(['90'])
  })
  it('new cards already started today reduce the allowance', () => {
    const cards = Array.from({ length: 30 }, (_, i) => mk(String(i), 'new', 0))
    const reviews = Array.from({ length: 4 }, (_, i) => ({ cardId: `x${i}`, at: now.toISOString() }))
    expect(selectDueCards(cards, reviews, now).fresh).toHaveLength(NEW_CARDS_PER_DAY - 4)
  })
})
