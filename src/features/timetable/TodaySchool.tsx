import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, GraduationCap, NotebookPen, School } from 'lucide-react'
import type { DayKey } from '@/db/types'
import { Badge, ButtonLink, Card, cn, ProgressBar } from '@/components/ui'
import { addDays, dayKey, diffDays, parseDay, relativeDay } from '@/lib/dates'
import { CHANGE_LABELS, dayStatus, lessonsOn } from '@/lib/timetable/core'
import { fromMin } from '@/lib/calendar/time'
import { lessonColor, useLessons, useTimetableData } from './data'
import { useNowMin } from './WeekGrid'

/**
 * Daily school overview: what is happening now, the rest of today's lessons (or the next school day),
 * homework that is due soon and upcoming exams. Renders nothing until the timetable has lessons.
 */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function TodaySchool({ compact }: { compact?: boolean }) {
  const data = useTimetableData()
  const today = dayKey()
  const nowMin = useNowMin()
  const lessons = useLessons(data, today, addDays(today, 14))
  const view = useMemo(() => {
    const todays = lessonsOn(lessons, today)
    const status = dayStatus(todays, nowMin)
    // after school (or on a free day) the overview looks at the next school day
    let day: DayKey = today
    if (!todays.length || status.schoolOver) {
      const next = lessons.find((l) => l.date > today)
      if (next) day = next.date
    }
    return { day, status: day === today ? status : null, list: lessonsOn(lessons, day).filter((l) => day !== today || (l.end ?? '') > fromMin(nowMin)) }
  }, [lessons, today, nowMin])
  if (!data.ready || lessons.length === 0) return null

  const due = data.tasks.filter((t) => t.status === 'open' && t.kind !== 'todo' && t.dueDate && t.dueDate <= addDays(view.day, 1)).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const exams = data.exams.filter((x) => x.date >= today && diffDays(today, x.date) <= 14).sort((a, b) => a.date.localeCompare(b.date))
  const name = (id: string | null) => (id ? data.subjectMap.get(id)?.name : undefined)
  const { status } = view

  return (
    <Card as="section" className="flex flex-col gap-3 p-4" aria-label="Schulübersicht">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-md font-semibold"><School className="size-4 text-accent" aria-hidden />{view.day === today ? 'Heute in der Schule' : `${capitalize(relativeDay(view.day, today))} in der Schule`}</h2>
        {compact && <ButtonLink to="/stundenplan" size="sm" variant="ghost">Stundenplan<ArrowRight className="size-4" aria-hidden /></ButtonLink>}
      </div>

      {status?.current && (
        <div className="rounded-md bg-accent-soft px-3 py-2 text-sm" aria-live="polite">
          <div className="flex justify-between gap-2"><span className="font-semibold">Jetzt: {name(status.current.subjectId) ?? status.current.title}{status.current.location && ` · ${status.current.location}`}</span><span className="tabular text-fg-muted">noch {status.minutesLeft} Min.</span></div>
          <ProgressBar value={status.progress} label="Fortschritt der aktuellen Stunde" className="mt-1.5" />
        </div>
      )}
      {status && !status.current && status.next && (
        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm"><Clock className="size-4 text-fg-muted" aria-hidden />Nächste Stunde in {status.minutesLeft} Min.: <span className="font-semibold">{name(status.next.subjectId) ?? status.next.title}</span></div>
      )}

      {view.list.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {view.list.slice(0, compact ? 5 : 12).map((l) => (
            <li key={l.key} className="flex items-center gap-2.5 text-sm">
              <span className="w-11 shrink-0 text-xs text-fg-muted tabular">{l.start}</span>
              <span className="h-5 w-1 shrink-0 rounded-full" style={{ background: lessonColor(l.subjectId, data.subjectMap) }} aria-hidden />
              <span className={cn('min-w-0 flex-1 truncate', l.cancelled && 'text-fg-muted line-through')}>{name(l.subjectId) ?? l.title}{l.location && <span className="text-fg-muted"> · {l.location}</span>}</span>
              {l.lessonChange && <Badge tone={l.cancelled ? 'danger' : 'accent'}>{CHANGE_LABELS[l.lessonChange.type]}</Badge>}
            </li>
          ))}
          {view.list.length > (compact ? 5 : 12) && <li className="text-xs text-fg-subtle">+ {view.list.length - (compact ? 5 : 12)} weitere</li>}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">Für heute ist der Unterricht vorbei.</p>
      )}

      {(due.length > 0 || exams.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          {exams.slice(0, 3).map((x) => (
            <Link key={x.id} to={`/pruefungen/${x.id}`} className="flex items-center gap-2 text-sm hover:underline">
              <GraduationCap className="size-4 shrink-0 text-danger" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{x.title}</span>
              <span className="shrink-0 text-xs text-danger">{relativeDay(x.date, today)}</span>
            </Link>
          ))}
          {due.slice(0, 4).map((t) => (
            <Link key={t.id} to="/aufgaben" className="flex items-center gap-2 text-sm hover:underline">
              <NotebookPen className="size-4 shrink-0 text-warn" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className={cn('shrink-0 text-xs', t.dueDate! < today ? 'text-danger' : 'text-fg-muted')}>{t.dueDate! < today ? 'überfällig' : `bis ${parseDay(t.dueDate!).toLocaleDateString('de-DE', { weekday: 'short' })}`}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
