import type { CardRating, SrsState } from '@/db/types'

const MINUTE = 60_000
const DAY = 86_400_000
export const MAX_INTERVAL_DAYS = 180
export const MIN_EASE = 1.3

export function newSrs(now: Date = new Date()): SrsState {
  return { state: 'new', due: now.toISOString(), intervalDays: 0, ease: 2.5, reps: 0, lapses: 0, lastReviewed: null }
}

/**
 * Simplified SM-2 scheduling.
 * - "Vergessen" (again): card comes back in 10 minutes (same session), ease drops.
 * - "Schwer" (hard): small step, ease drops slightly.
 * - "Gut" (good): interval grows by the ease factor.
 * - "Leicht" (easy): bigger jump, ease rises.
 * Intervals are in days; learning steps are 1 and 3 days.
 */
export function reviewCard(srs: SrsState, rating: CardRating, now: Date = new Date()): SrsState {
  let { ease, intervalDays, reps, lapses, state } = srs
  const t = now.getTime()
  let dueMs: number

  if (rating === 'again') {
    lapses += state === 'review' ? 1 : 0
    ease = Math.max(MIN_EASE, ease - 0.2)
    intervalDays = 0
    reps = 0
    state = 'learning'
    dueMs = t + 10 * MINUTE
  } else if (state === 'new' || state === 'learning') {
    reps += 1
    if (rating === 'hard') {
      intervalDays = 1
      ease = Math.max(MIN_EASE, ease - 0.15)
      state = 'learning'
    } else if (rating === 'good') {
      intervalDays = reps >= 2 ? 3 : 1
      state = reps >= 2 ? 'review' : 'learning'
    } else {
      intervalDays = 4
      ease = ease + 0.15
      state = 'review'
    }
    dueMs = t + intervalDays * DAY
  } else {
    reps += 1
    const prev = Math.max(1, intervalDays)
    if (rating === 'hard') {
      intervalDays = Math.max(prev + 1, Math.round(prev * 1.2))
      ease = Math.max(MIN_EASE, ease - 0.15)
    } else if (rating === 'good') {
      intervalDays = Math.max(prev + 1, Math.round(prev * ease))
    } else {
      intervalDays = Math.max(prev + 2, Math.round(prev * ease * 1.3))
      ease = ease + 0.15
    }
    intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays)
    dueMs = t + intervalDays * DAY
  }

  return { state, ease: Math.round(ease * 100) / 100, intervalDays, reps, lapses, due: new Date(dueMs).toISOString(), lastReviewed: now.toISOString() }
}

export function isDue(srs: SrsState, now: Date = new Date()): boolean {
  return new Date(srs.due).getTime() <= now.getTime()
}

/** Due by the end of the local day – what the dashboard calls "heute fällig". */
export function isDueToday(srs: SrsState, now: Date = new Date()): boolean {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return new Date(srs.due).getTime() <= end.getTime()
}

export function previewIntervals(srs: SrsState, now: Date = new Date()): Record<CardRating, string> {
  const out = {} as Record<CardRating, string>
  for (const r of ['again', 'hard', 'good', 'easy'] as CardRating[]) {
    const next = reviewCard(srs, r, now)
    const ms = new Date(next.due).getTime() - now.getTime()
    out[r] = ms < DAY ? `${Math.max(1, Math.round(ms / MINUTE))} Min.` : `${Math.round(ms / DAY)} T.`
  }
  return out
}

/** "Behalten" = share of reviews of already-learned cards that were not forgotten. */
export function retentionRate(ratings: { rating: CardRating; intervalBefore: number }[]): number | null {
  const mature = ratings.filter((r) => r.intervalBefore >= 1)
  if (mature.length === 0) return null
  return mature.filter((r) => r.rating !== 'again').length / mature.length
}

/** New cards introduced per day – like a teacher handing out a few new words, not the whole book at once. */
export const NEW_CARDS_PER_DAY = 10

/**
 * Today's queue: all due review cards plus up to NEW_CARDS_PER_DAY new cards
 * (minus new cards already started today). Pure function so it is testable.
 */
export function selectDueCards<C extends { id: string; srs: SrsState; createdAt: string }>(
  cards: C[],
  reviews: { cardId: string; at: string }[],
  now: Date = new Date(),
): { reviews: C[]; fresh: C[] } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const firstSeen = new Map<string, string>()
  for (const r of reviews) if (!firstSeen.has(r.cardId) || r.at < firstSeen.get(r.cardId)!) firstSeen.set(r.cardId, r.at)
  const introducedToday = [...firstSeen.values()].filter((at) => new Date(at) >= start).length
  const allowance = Math.max(0, NEW_CARDS_PER_DAY - introducedToday)
  const due = cards.filter((c) => c.srs.state !== 'new' && isDueToday(c.srs, now)).sort((a, b) => a.srs.due.localeCompare(b.srs.due))
  const fresh = cards.filter((c) => c.srs.state === 'new').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, allowance)
  return { reviews: due, fresh }
}
