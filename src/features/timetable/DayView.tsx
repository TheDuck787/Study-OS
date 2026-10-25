import { CalendarCheck, Coffee, GraduationCap, NotebookPen, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DayKey, TimetablePeriod } from '@/db/types'
import { success } from '@/lib/motion'
import { setTaskDone } from '@/db/calendar'
import { Badge, cn, ProgressBar } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { fromMin, toMin } from '@/lib/calendar/time'
import { WEEKDAYS_SHORT, parseDay, weekday } from '@/lib/dates'
import { dayStatus, formatPeriods, matchPeriods } from '@/lib/timetable/core'
import { LessonCard, type CardCtx } from './LessonCard'
import { useNowMin } from './WeekGrid'

type Row =
  | { kind: 'lesson'; lesson: CalItem; label: string; start: number; end: number }
  | { kind: 'free'; period: TimetablePeriod; start: number; end: number }

/** Lessons and free periods of one day in order (free periods only inside the school day). */
export function dayRows(lessons: CalItem[], periods: TimetablePeriod[]): Row[] {
  const rows: Row[] = lessons.map((l) => {
    const m = l.period != null ? { period: l.period, periodEnd: l.periodEnd ?? l.period } : matchPeriods(periods, l.start, l.end)
    return { kind: 'lesson', lesson: l, label: m ? formatPeriods(m.period, m.periodEnd) : '', start: toMin(l.start!), end: toMin(l.end ?? l.start!) }
  })
  const first = Math.min(...rows.map((r) => r.start))
  const last = Math.max(...rows.map((r) => r.end))
  for (const p of periods) {
    const s = toMin(p.start)
    const e = toMin(p.end)
    if (rows.some((r) => r.kind === 'lesson' && r.start < e && s < r.end)) continue
    if (rows.length && s > first && e < last) rows.push({ kind: 'free', period: p, start: s, end: e })
  }
  return rows.sort((a, b) => a.start - b.start || a.end - b.end)
}

/** One school day as a vertical list – the default on phones. */
export function DayView({ day, lessons, periods, ctx, today, onOpen, onAdd }: {
  day: DayKey; lessons: CalItem[]; periods: TimetablePeriod[]; ctx: CardCtx; today: DayKey
  onOpen: (l: CalItem) => void; onAdd: (day: DayKey, slot: { start: string; end: string; period: number | null }) => void
}) {
  const nowMin = useNowMin()
  const rows = dayRows(lessons, periods)
  const isToday = day === today
  const status = isToday ? dayStatus(lessons, nowMin) : null
  const homework = ctx.tasks.filter((t) => t.dueDate === day && t.kind !== 'todo')
  const exams = ctx.exams.filter((x) => x.date === day)
  const nextFree = periods.find((p) => !rows.some((r) => r.kind === 'lesson' && r.start < toMin(p.end) && toMin(p.start) < r.end))

  return (
    <div className="flex flex-col gap-4">
      {status && (status.current || status.next) && (
        <div className="rounded-lg border border-accent/30 bg-accent-soft px-3.5 py-3 text-sm" aria-live="polite">
          {status.current ? (
            <>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">Jetzt: {ctx.subjects.get(status.current.subjectId ?? '')?.name ?? status.current.title}{status.current.location && ` · ${status.current.location}`}</span><span className="tabular text-fg-muted">noch {status.minutesLeft} Min.</span></div>
              <ProgressBar value={status.progress} label="Fortschritt der aktuellen Stunde" className="mt-2" />
            </>
          ) : (
            <div className="font-semibold">Nächste Stunde: {ctx.subjects.get(status.next!.subjectId ?? '')?.name ?? status.next!.title} um {status.next!.start} <span className="font-normal text-fg-muted">(in {status.minutesLeft} Min.)</span></div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
          <CalendarCheck className="size-6 text-fg-subtle" aria-hidden />
          <div className="font-semibold">Kein Unterricht am {WEEKDAYS_SHORT[weekday(day)]}, {parseDay(day).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}</div>
          <button type="button" onClick={() => onAdd(day, nextFree ? { start: nextFree.start, end: nextFree.end, period: nextFree.n } : { start: '08:00', end: '08:45', period: null })} className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <Plus className="size-4" aria-hidden />Stunde eintragen
          </button>
        </div>
      ) : (
        <ol className="stagger flex flex-col gap-2" aria-label="Stunden des Tages">
          {rows.map((r, i) => {
            const prev = rows[i - 1]
            const gap = prev ? r.start - prev.end : 0
            return (
              <li key={r.kind === 'lesson' ? r.lesson.key : `free-${r.period.n}`} className="flex flex-col gap-2">
                {gap >= 15 && (
                  <div className="flex items-center gap-2 px-1 text-xs text-fg-subtle" aria-label={`Pause, ${gap} Minuten`}>
                    <Coffee className="size-3.5" aria-hidden /><span>Pause · {gap} Min.</span><span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-end pt-2 text-right">
                    <span className="text-sm font-semibold tabular">{fromMin(r.start)}</span>
                    <span className="text-xs text-fg-subtle tabular">{fromMin(r.end)}</span>
                  </div>
                  {r.kind === 'lesson' ? (
                    <div className="min-w-0 flex-1">
                      <LessonCard lesson={r.lesson} ctx={ctx} density="full" onOpen={onOpen} current={isToday && r.start <= nowMin && nowMin < r.end} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => onAdd(day, { start: r.period.start, end: r.period.end, period: r.period.n })} className="tt-free flex min-h-12 flex-1 cursor-pointer items-center justify-between rounded-md border border-dashed border-border px-3 text-sm text-fg-subtle hover:text-fg" aria-label={`${r.period.n}. Stunde frei – Stunde hinzufügen`}>
                      <span>{r.period.n}. Stunde · frei</span><Plus className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {(homework.length > 0 || exams.length > 0) && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
          <div className="text-sm font-semibold">Fällig am {WEEKDAYS_SHORT[weekday(day)]}</div>
          {exams.map((x) => (
            <Link key={x.id} to={`/pruefungen/${x.id}`} className="flex items-center gap-2 text-sm hover:underline">
              <GraduationCap className="size-4 shrink-0 text-danger" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{x.title}</span>
              <Badge tone="danger">{x.type}</Badge>
            </Link>
          ))}
          {homework.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={t.status === 'done'} onChange={(e) => { if (e.target.checked) success(e.currentTarget); void setTaskDone(t.id, e.target.checked) }} className="size-4 accent-[var(--accent-solid)]" />
              <NotebookPen className="size-4 shrink-0 text-warn" aria-hidden />
              <span className={cn('min-w-0 flex-1 truncate', t.status === 'done' && 'text-fg-muted line-through')}>{t.title}</span>
              {t.subjectId && <span className="shrink-0 text-xs text-fg-muted">{ctx.subjects.get(t.subjectId)?.name}</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
