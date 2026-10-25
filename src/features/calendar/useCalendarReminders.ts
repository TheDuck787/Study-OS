import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import { useToast } from '@/components/ui'
import { addDays, dayKey } from '@/lib/dates'
import { buildItems } from '@/lib/calendar/items'
import { toDate } from '@/lib/calendar/time'

const FIRED_KEY = 'studyos.reminders.fired'
const GRACE_MS = 30 * 60_000

function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

/**
 * Reminders for calendar entries and tasks while Study OS is open (there is no push server).
 * Shows a toast and – if the student allowed it – a system notification. Each reminder fires once.
 */
export function useCalendarReminders() {
  const toast = useToast()
  const events = useLiveQuery(() => db.events.filter((e) => e.reminderMinutes !== null).toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.filter((t) => t.reminderMinutes !== null && t.status === 'open').toArray(), [])
  useEffect(() => {
    if (!events || !tasks) return
    const check = () => {
      const now = new Date()
      const today = dayKey(now)
      const items = buildItems({ events, exams: [], tasks, from: today, to: addDays(today, 15) })
      const fired = loadFired()
      let changed = false
      for (const i of items) {
        const minutes = i.source === 'event' ? events.find((e) => e.id === i.refId)?.reminderMinutes : tasks.find((t) => t.id === i.refId)?.reminderMinutes
        if (minutes === null || minutes === undefined || i.done || i.cancelled) continue
        const at = toDate(i.date, i.start ?? '08:00').getTime() - minutes * 60_000
        const key = `${i.key}@${i.date}@${minutes}`
        if (fired.has(key) || now.getTime() < at || now.getTime() > at + GRACE_MS) continue
        fired.add(key)
        changed = true
        const when = i.deadline ? `fällig ${i.start ? `um ${i.start}` : i.date === today ? 'heute' : 'bald'}` : i.start ? `um ${i.start} Uhr` : 'heute'
        toast({ title: `Erinnerung: ${i.title}`, description: when, tone: 'accent' })
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(`Study OS: ${i.title}`, { body: when, tag: key })
        } catch {
          /* notifications are optional */
        }
      }
      if (changed) {
        try {
          localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-300)))
        } catch {
          /* storage blocked – reminders may repeat once */
        }
      }
    }
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [events, tasks, toast])
}
