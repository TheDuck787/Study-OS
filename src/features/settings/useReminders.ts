import { useEffect } from 'react'
import { db } from '@/db/index'
import { isDueToday } from '@/lib/srs'
import { openMistakes } from '@/lib/mistakes'
import { dayKey, diffDays } from '@/lib/dates'

const KEY = 'studyos.lastReminder'

/**
 * Friendly reminders while the app is open (no push server, no guilt messages).
 * Fires at most once a day after the chosen time, and only if something is actually due.
 */
export function useReminders() {
  useEffect(() => {
    const check = async () => {
      const p = await db.profile.get('me')
      if (!p?.notifications.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      const today = dayKey()
      let last: string | null = null
      try {
        last = localStorage.getItem(KEY)
      } catch {
        /* ignore */
      }
      if (last === today) return
      const now = new Date()
      const [h, m] = p.notifications.reminderTime.split(':').map(Number)
      if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return
      const cards = (await db.cards.toArray()).filter((c) => isDueToday(c.srs, now)).length
      const mistakes = openMistakes(await db.answers.toArray()).length
      const exams = p.notifications.examReminders ? (await db.exams.toArray()).filter((e) => { const d = diffDays(today, e.date); return d >= 0 && d <= 3 }) : []
      const parts: string[] = []
      if (cards) parts.push(`${cards} Karteikarten`)
      if (mistakes) parts.push(`${mistakes} Fehler`)
      if (exams.length) parts.push(`${exams[0].title} bald`)
      if (parts.length === 0) return
      try {
        new Notification('Study OS', { body: `Wenn du heute Zeit hast: ${parts.join(', ')}. Ein paar Minuten reichen.`, tag: 'studyos-daily' })
        localStorage.setItem(KEY, today)
      } catch {
        /* notifications unavailable */
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [])
}
