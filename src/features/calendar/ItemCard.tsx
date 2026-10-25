import type { CSSProperties, ReactNode } from 'react'
import { Check, CheckSquare, MapPin, Pin, Repeat, Sparkles } from 'lucide-react'
import { cn } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { KIND_META } from '@/lib/calendar/meta'
import { itemColor, kindLabel, type ColorCtx } from './data'

export const cardStyle = (color: string): CSSProperties => ({
  ['--c' as string]: color,
  background: 'color-mix(in oklab, var(--c) 15%, var(--surface))',
  borderColor: 'color-mix(in oklab, var(--c) 45%, transparent)',
})

function timeLabel(i: CalItem): string {
  if (i.deadline) return i.start ? `fällig ${i.start}` : 'fällig'
  if (i.untimed) return `${i.minutes} Min.`
  if (i.allDay) return i.endDate !== i.date ? 'mehrtägig' : 'ganztägig'
  return i.start ?? ''
}

/** Small status icons shown on every card type. */
function Flags({ i }: { i: CalItem }) {
  return (
    <>
      {i.recurring && <Repeat className="size-3 shrink-0 opacity-70" aria-label="wiederholt sich" />}
      {i.planner && !i.pinned && <Sparkles className="size-3 shrink-0 opacity-70" aria-label="vom Planer" />}
      {i.pinned && <Pin className="size-3 shrink-0 opacity-70" aria-label="von dir festgelegt" />}
    </>
  )
}

/** Only things you actually work through get a checkbox (not lessons, appointments, exams). */
export const canComplete = (i: CalItem) => ['study', 'flashcards', 'homework', 'project', 'todo'].includes(i.kind)

export function DoneBox({ item, onToggle, className }: { item: CalItem; onToggle: (done: boolean) => void; className?: string }) {
  if (!canComplete(item)) return null
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.done}
      aria-label={item.done ? `„${item.title}“ als offen markieren` : `„${item.title}“ als erledigt markieren`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(!item.done)
      }}
      className={cn('flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border transition-colors', item.done ? 'border-transparent bg-[var(--c)] text-[var(--bg)]' : 'border-[color-mix(in_oklab,var(--c)_70%,var(--fg-subtle))] hover:bg-[color-mix(in_oklab,var(--c)_25%,transparent)]', className)}
    >
      {item.done && <Check className="size-3" strokeWidth={3} />}
    </button>
  )
}

/** One-line chip (month cells, all-day lane). */
export function ItemChip({ item, ctx, onClick, onToggle, selected, draggable, onDragStart, compact }: {
  item: CalItem; ctx: ColorCtx; onClick: () => void; onToggle?: (done: boolean) => void; selected?: boolean; draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; compact?: boolean
}) {
  const color = itemColor(item, ctx)
  const Icon = KIND_META[item.kind].icon
  const strong = item.kind === 'exam'
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      title={`${kindLabel(item, ctx)}: ${item.title}`}
      style={strong ? { ['--c' as string]: color, background: 'var(--c)', borderColor: 'var(--c)' } : cardStyle(color)}
      className={cn(
        'group flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-[5px] border px-1.5 text-xs leading-none transition-[box-shadow,transform] hover:shadow-[0_0_0_1px_var(--c)]',
        strong ? 'font-semibold text-[var(--bg)]' : 'text-fg',
        item.done && 'opacity-55',
        item.cancelled && 'line-through opacity-50',
        selected && 'shadow-[0_0_0_2px_var(--c)]',
        item.planner && !item.pinned && !strong && 'border-dashed',
      )}
    >
      {onToggle && !compact ? <DoneBox item={item} onToggle={onToggle} className="size-3.5" /> : <Icon className="size-3 shrink-0" style={{ color: strong ? undefined : 'var(--c)' }} aria-hidden />}
      {!compact && !item.allDay && item.start && <span className="tabular shrink-0 text-fg-muted" style={strong ? { color: 'inherit', opacity: 0.8 } : undefined}>{item.start}</span>}
      <span className={cn('min-w-0 truncate', item.done && 'line-through')}>{item.title}</span>
      {item.deadline && !compact && <span className="ml-auto shrink-0 text-[0.65rem] uppercase tracking-wide opacity-70">fällig</span>}
    </div>
  )
}

/** Timed block in the week/day grid. Positioned by the parent. */
export function ItemBlock({ item, ctx, style, selected, onToggle, children, height }: {
  item: CalItem; ctx: ColorCtx; style: CSSProperties; selected?: boolean; onToggle?: (done: boolean) => void; children?: ReactNode; height: number
}) {
  const color = itemColor(item, ctx)
  const Icon = KIND_META[item.kind].icon
  const tiny = height < 34
  const roomy = height >= 70
  const strong = item.kind === 'exam'
  return (
    <div
      style={{ ...(strong ? { ['--c' as string]: color, background: 'color-mix(in oklab, var(--c) 32%, var(--surface))', borderColor: 'var(--c)' } : cardStyle(color)), ...style }}
      className={cn(
        'absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 text-xs leading-tight text-fg transition-shadow',
        tiny ? 'py-0' : 'py-1',
        item.done && 'opacity-60',
        item.cancelled && 'opacity-45',
        selected && 'z-10 shadow-[0_0_0_2px_var(--c),var(--shadow)]',
        item.planner && !item.pinned && !strong && 'border-dashed',
      )}
      data-item-key={item.key}
    >
      <div className={cn('flex min-w-0 items-center gap-1', !tiny && 'items-start')}>
        {onToggle && !tiny ? <DoneBox item={item} onToggle={onToggle} className="mt-px size-3.5" /> : <Icon className="size-3 shrink-0" style={{ color: 'var(--c)' }} aria-hidden />}
        <span className={cn('min-w-0 font-medium', tiny ? 'truncate' : 'line-clamp-2', item.done && 'line-through', item.cancelled && 'line-through')}>{item.title}</span>
        {tiny && <span className="ml-auto shrink-0 tabular text-fg-muted">{item.start}</span>}
      </div>
      {!tiny && (
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[0.7rem] text-fg-muted">
          <span className="tabular shrink-0">{item.start}–{item.end}</span>
          <Flags i={item} />
          {item.location && roomy && <span className="flex min-w-0 items-center gap-0.5 truncate"><MapPin className="size-3 shrink-0" />{item.location}</span>}
        </div>
      )}
      {roomy && item.checklist.total > 0 && (
        <div className="mt-0.5 flex items-center gap-1 text-[0.7rem] text-fg-muted"><CheckSquare className="size-3" />{item.checklist.done}/{item.checklist.total}</div>
      )}
      {children}
    </div>
  )
}

/** Row for agenda, lists and "Mein Tag". */
export function ItemRow({ item, ctx, onClick, onToggle, selected, right, showDate, subjectName, overdue }: {
  item: CalItem; ctx: ColorCtx; onClick: () => void; onToggle?: (done: boolean) => void; selected?: boolean; right?: ReactNode; showDate?: string; subjectName?: string; overdue?: boolean
}) {
  const color = itemColor(item, ctx)
  const Icon = KIND_META[item.kind].icon
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      style={{ ['--c' as string]: color }}
      className={cn('group flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-surface-2', selected && 'border-[color-mix(in_oklab,var(--c)_55%,transparent)] bg-surface-2')}
    >
      <div className="w-14 shrink-0 text-right text-xs tabular text-fg-muted">
        {showDate && <div className="font-medium text-fg">{showDate}</div>}
        <div>{timeLabel(item)}</div>
        {item.end && !item.allDay && <div className="text-fg-subtle">{item.end}</div>}
      </div>
      <span className={cn('h-9 w-[3px] shrink-0 rounded-full bg-[var(--c)]', item.planner && !item.pinned && 'opacity-60')} aria-hidden />
      {onToggle && <DoneBox item={item} onToggle={onToggle} />}
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium', item.done && 'text-fg-muted line-through', item.cancelled && 'line-through')}>{item.title}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
          <span className="inline-flex items-center gap-1"><Icon className="size-3" style={{ color: 'var(--c)' }} aria-hidden />{kindLabel(item, ctx)}</span>
          {subjectName && <span className="truncate">{subjectName}</span>}
          {item.location && <span className="inline-flex items-center gap-0.5 truncate"><MapPin className="size-3" />{item.location}</span>}
          {item.checklist.total > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="size-3" />{item.checklist.done}/{item.checklist.total}</span>}
          {overdue && <span className="font-medium text-warn">überfällig</span>}
          <Flags i={item} />
        </div>
      </div>
      {right}
    </div>
  )
}
