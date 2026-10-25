import { GraduationCap, NotebookPen } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DayKey } from '@/db/types'
import { cn } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { parseDay, rangeDays, relativeDay } from '@/lib/dates'
import { CHANGE_LABELS, lessonsOn, subjectShort } from '@/lib/timetable/core'
import { lessonColor } from './data'
import { lessonLabel, type CardCtx } from './LessonCard'

/** Agenda: the coming school days with lessons, changes, homework and exams. */
export function AgendaList({ from, to, lessons, ctx, today, onOpen }: { from: DayKey; to: DayKey; lessons: CalItem[]; ctx: CardCtx; today: DayKey; onOpen: (l: CalItem) => void }) {
  const days = rangeDays(from, to)
    .map((d) => ({ d, ls: lessonsOn(lessons, d), hw: ctx.tasks.filter((t) => t.dueDate === d && t.kind !== 'todo'), ex: ctx.exams.filter((x) => x.date === d) }))
    .filter((x) => x.ls.length || x.hw.length || x.ex.length)
  if (!days.length) return <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">In diesem Zeitraum ist nichts eingetragen.</p>
  return (
    <div className="flex flex-col gap-3">
      {days.map(({ d, ls, hw, ex }) => (
        <section key={d} className={cn('rounded-lg border border-border bg-surface', d === today && 'border-accent/40')} aria-label={parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}>
          <header className="flex items-baseline justify-between gap-2 border-b border-border px-3.5 py-2">
            <h3 className="text-sm font-semibold">{parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <span className={cn('text-xs', d === today ? 'font-semibold text-accent' : 'text-fg-subtle')}>{relativeDay(d, today)}</span>
          </header>
          <ul className="divide-y divide-border">
            {ex.map((x) => (
              <li key={x.id}>
                <Link to={`/pruefungen/${x.id}`} className="flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-surface-2">
                  <GraduationCap className="size-4 shrink-0 text-danger" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{x.title}</span>
                  <span className="shrink-0 text-xs text-danger">{x.type}{x.startTime ? ` · ${x.startTime}` : ''}</span>
                </Link>
              </li>
            ))}
            {ls.map((l) => {
              const s = l.subjectId ? ctx.subjects.get(l.subjectId) : undefined
              return (
                <li key={l.key}>
                  <button type="button" onClick={() => onOpen(l)} aria-label={lessonLabel(l, ctx)} className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-surface-2">
                    <span className="w-24 shrink-0 text-xs text-fg-muted tabular">{l.start}–{l.end}</span>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-bold" style={{ background: `color-mix(in oklab, ${lessonColor(l.subjectId, ctx.subjects)} 22%, transparent)`, color: lessonColor(l.subjectId, ctx.subjects) }}>{subjectShort(s ?? { name: l.title }).slice(0, 3)}</span>
                    <span className={cn('min-w-0 flex-1 truncate', l.cancelled && 'text-fg-muted line-through')}>{s?.name ?? l.title}{l.location && <span className="text-fg-muted"> · {l.location}</span>}</span>
                    {l.lessonChange && <span className={cn('shrink-0 rounded px-1.5 text-[0.65rem] font-semibold uppercase', l.cancelled ? 'bg-danger-soft text-danger' : 'bg-[color-mix(in_oklab,var(--s3)_18%,transparent)] text-[var(--s3)]')}>{CHANGE_LABELS[l.lessonChange.type]}</span>}
                  </button>
                </li>
              )
            })}
            {hw.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 px-3.5 py-2 text-sm">
                <NotebookPen className="size-4 shrink-0 text-warn" aria-hidden />
                <span className={cn('min-w-0 flex-1 truncate', t.status === 'done' && 'text-fg-muted line-through')}>{t.title}</span>
                {t.subjectId && <span className="shrink-0 text-xs text-fg-muted">{ctx.subjects.get(t.subjectId)?.name}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
