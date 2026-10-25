import { GraduationCap, NotebookPen } from 'lucide-react'
import type { Exam, Subject, Task } from '@/db/types'
import { cn } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { parseDay } from '@/lib/dates'
import { CHANGE_LABELS, formatPeriods, subjectShort } from '@/lib/timetable/core'
import { examsFor, homeworkFor, lessonColor } from './data'

export interface CardCtx {
  subjects: Map<string, Subject>
  tasks: Task[]
  exams: Exam[]
}

/** Screen-reader description of a lesson including its change. */
export function lessonLabel(l: CalItem, ctx: CardCtx): string {
  const s = l.subjectId ? ctx.subjects.get(l.subjectId) : undefined
  const parts = [
    s?.name ?? l.title,
    parseDay(l.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    formatPeriods(l.period, l.periodEnd), `${l.start}–${l.end}`,
    l.location && `Raum ${l.location}`, l.teacher && `Lehrkraft ${l.teacher}`,
    l.lessonChange && CHANGE_LABELS[l.lessonChange.type],
  ]
  const hw = homeworkFor(ctx.tasks, l.subjectId, l.date).filter((t) => t.status === 'open').length
  const ex = examsFor(ctx.exams, l.subjectId, l.date).length
  if (hw) parts.push(`${hw} Hausaufgabe${hw === 1 ? '' : 'n'} fällig`)
  if (ex) parts.push('Prüfung')
  return parts.filter(Boolean).join(', ')
}

/** Changed field: new value highlighted, old value struck through. */
function Changed({ now, before, className }: { now: string; before?: string | null; className?: string }) {
  if (before == null || before === now) return <span className={className}>{now}</span>
  return (
    <span className={className}>
      <span className="font-semibold text-[var(--s3)]">{now || '—'}</span>
      {before && <s className="ml-1 opacity-60">{before}</s>}
    </span>
  )
}

/**
 * One lesson as a coloured card. `density`: "tiny" for narrow week columns on phones,
 * "compact" for the week grid, "full" for the day view.
 */
export function LessonCard({ lesson: l, ctx, density, onOpen, current, className, style }: {
  lesson: CalItem; ctx: CardCtx; density: 'tiny' | 'compact' | 'full'; onOpen: (l: CalItem) => void; current?: boolean; className?: string; style?: React.CSSProperties
}) {
  const s = l.subjectId ? ctx.subjects.get(l.subjectId) : undefined
  const ch = l.lessonChange
  const before = ch?.before
  const beforeSubject = before && before.subjectId !== l.subjectId ? ctx.subjects.get(before.subjectId ?? '') : undefined
  const hw = homeworkFor(ctx.tasks, l.subjectId, l.date)
  const openHw = hw.filter((t) => t.status === 'open').length
  const ex = examsFor(ctx.exams, l.subjectId, l.date).length
  const name = density === 'tiny' ? subjectShort(s ?? { name: l.title }) : (s?.name ?? l.title)
  return (
    <button
      type="button"
      onClick={() => onOpen(l)}
      aria-label={lessonLabel(l, ctx)}
      title={density !== 'full' ? lessonLabel(l, ctx) : undefined}
      className={cn(
        'tt-card group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-md text-left',
        l.cancelled && 'tt-cancelled', ch && !l.cancelled && 'tt-changed', current && 'ring-2 ring-accent',
        density === 'tiny' ? 'px-1 py-0.5' : density === 'compact' ? 'px-1.5 py-1' : 'px-3 py-2.5',
        className,
      )}
      style={{ ['--c' as string]: lessonColor(l.subjectId, ctx.subjects), ...style }}
    >
      <div className="flex min-w-0 items-start gap-1">
        <span className={cn('min-w-0 flex-1 truncate font-semibold leading-tight', density === 'full' ? 'text-base' : density === 'compact' ? 'text-sm' : 'text-xs', l.cancelled && 'line-through decoration-2')}>
          {name}
          {beforeSubject && density === 'full' && <s className="ml-1.5 text-sm font-normal opacity-60">{beforeSubject.name}</s>}
        </span>
        {(openHw > 0 || ex > 0) && (
          <span className="flex shrink-0 items-center gap-0.5">
            {ex > 0 && <GraduationCap className={cn('text-danger', density === 'tiny' ? 'size-3' : 'size-3.5')} aria-hidden />}
            {openHw > 0 && <NotebookPen className={cn('text-warn', density === 'tiny' ? 'size-3' : 'size-3.5')} aria-hidden />}
          </span>
        )}
      </div>
      {density !== 'tiny' ? (
        <div className={cn('min-w-0 leading-tight text-fg-muted', density === 'full' ? 'mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm' : 'mt-0.5 flex flex-col text-xs')}>
          {density === 'full' && <span className="tabular">{l.start}–{l.end}{l.period != null && ` · ${formatPeriods(l.period, l.periodEnd)}`}</span>}
          {(l.location || before?.location) && <Changed className="truncate" now={l.location} before={before?.location} />}
          {(l.teacher || before?.teacher) && <Changed className="truncate" now={l.teacher} before={before?.teacher} />}
        </div>
      ) : (
        l.location && <div className="truncate text-[0.65rem] leading-tight text-fg-muted">{l.location}</div>
      )}
      {ch && density !== 'tiny' && (
        <span className={cn('mt-1 inline-flex w-fit items-center rounded px-1 text-[0.65rem] font-semibold uppercase tracking-wide', l.cancelled ? 'bg-danger text-[var(--bg)]' : 'bg-[var(--s3)] text-[var(--bg)]')}>
          {CHANGE_LABELS[ch.type]}
        </span>
      )}
      {ch && density === 'full' && ch.note && <span className="mt-1 text-sm text-fg-muted">{ch.note}</span>}
      {density === 'full' && hw.length > 0 && (
        <span className="mt-1.5 flex flex-wrap gap-1">
          {hw.map((t) => (
            <span key={t.id} className={cn('inline-flex max-w-full items-center gap-1 truncate rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn', t.status === 'done' && 'line-through opacity-60')}>
              <NotebookPen className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{t.title}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  )
}
