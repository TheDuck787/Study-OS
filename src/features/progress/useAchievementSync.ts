import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { unlockAchievements } from '@/db/repo'
import { ACHIEVEMENTS, activeDays, countFixedMistakes, longestStreak, currentStreak } from '@/lib/progress'
import { computeAllTopicStats } from '@/lib/mastery'
import { dayKey, startOfWeek } from '@/lib/dates'
import { useToast } from '@/components/ui'
import { celebrate } from '@/lib/motion'

/** Checks achievement conditions when learning data changes and announces new badges once. */
export function useAchievementSync() {
  const toast = useToast()
  const first = useRef(true)
  const signal = useLiveQuery(async () => ({ a: await db.answers.count(), x: await db.xpEvents.count(), e: await db.exams.count() }), [])
  useEffect(() => {
    if (!signal) return
    let alive = true
    ;(async () => {
      const [attempts, answers, cardReviews, exams, topics, xp, profile] = await Promise.all([
        db.attempts.toArray(), db.answers.toArray(), db.cardReviews.toArray(), db.exams.toArray(), db.topics.toArray(), db.xpEvents.toArray(), db.profile.get('me'),
      ])
      const stats = [...computeAllTopicStats(topics.map((t) => t.id), answers).values()]
      const active = activeDays(xp)
      const today = dayKey()
      const rest = profile?.restDays ?? []
      const paused = profile?.pausedUntil ?? null
      const weekStart = startOfWeek(today)
      const ctx = {
        attempts, answers, cardReviews, stats, exams,
        streak: currentStreak(active, today, rest, paused),
        longestStreak: longestStreak(active, today, rest, paused),
        fixedMistakes: countFixedMistakes(answers),
        weekGoalReached: [...active].filter((d) => d >= weekStart).length >= (profile?.weeklyGoalDays ?? 4),
      }
      const earned = ACHIEVEMENTS.filter((a) => a.check(ctx)).map((a) => a.key)
      const fresh = await unlockAchievements(earned)
      if (!alive) return
      // On first load, unlock silently (e.g. after a restore); afterwards announce new badges.
      if (!first.current) for (const k of fresh) {
        const def = ACHIEVEMENTS.find((a) => a.key === k)
        if (def) {
          toast({ title: `Abzeichen: ${def.title}`, description: def.description, tone: 'success' })
          celebrate(null, { count: 30, spread: 1.6 })
        }
      }
      first.current = false
    })()
    return () => {
      alive = false
    }
  }, [signal, toast])
}
