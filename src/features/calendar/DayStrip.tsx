import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ListTodo, Sun } from 'lucide-react'
import { addDays, dayKey, relativeDay } from '@/lib/dates'
import { itemsOnDay } from '@/lib/calendar/items'
import { nowMinutes, toMin } from '@/lib/calendar/time'
import { useCalendarSources, useItems, useNow } from './data'

/** Compact link from the dashboard to "Mein Tag": what's next, what's due. */
export function DayStrip() {
  const now = useNow()
  const today = dayKey(now)
  const src = useCalendarSources()
  const items = useItems(src, today, addDays(today, 1))
  const info = useMemo(() => {
    const todays = itemsOnDay(items, today)
    const next = todays.filter((i) => i.start && !i.allDay && toMin(i.start) > nowMinutes(now) && !i.cancelled).sort((a, b) => a.start!.localeCompare(b.start!))[0]
    const due = items.filter((i) => i.deadline && !i.done).length
    const exams = src.exams.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))
    return { next, due, exam: exams[0] }
  }, [items, today, now, src.exams])
  if (!src.ready || (!info.next && !info.due && !info.exam && src.events.length === 0 && src.tasks.length === 0)) return null
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2"><CalendarDays className="size-4 text-fg-subtle" />{info.next ? <>Als Nächstes <strong className="tabular">{info.next.start}</strong> {info.next.title}</> : 'Heute kein Termin mehr'}</span>
      <span className="flex items-center gap-2 text-fg-muted"><ListTodo className="size-4 text-fg-subtle" />{info.due} Frist{info.due === 1 ? '' : 'en'} heute/morgen</span>
      {info.exam && <span className="text-fg-muted">Prüfung „{info.exam.title}“ {relativeDay(info.exam.date, today)}</span>}
      <Link to="/mein-tag" className="ml-auto inline-flex items-center gap-1 font-medium text-accent hover:underline"><Sun className="size-4" />Mein Tag<ArrowRight className="size-3.5" /></Link>
    </div>
  )
}
