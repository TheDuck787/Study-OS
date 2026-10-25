import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { DayKey } from '@/db/types'
import { cn } from '@/components/ui'
import { addDays, parseDay, startOfWeek, WEEKDAYS_SHORT } from '@/lib/dates'
import { itemsOnDay, isOverdue, type CalItem } from '@/lib/calendar/items'
import { itemColor, type ColorCtx } from './data'
import { ItemChip, ItemRow } from './ItemCard'

export interface ViewProps {
  items: CalItem[]
  today: DayKey
  ctx: ColorCtx
  selectedKey: string | null
  onSelect: (i: CalItem) => void
  onToggle: (i: CalItem, done: boolean) => void
  onCreate: (date: DayKey, start?: string, end?: string) => void
  onMove: (i: CalItem, date: DayKey, start?: string | null) => void
  onResize?: (i: CalItem, end: string) => void
  /** A task from the inbox was dropped (time = schedule a work session, no time = set due date). */
  onDropTask?: (taskId: string, date: DayKey, start?: string) => void
  onOpenDay: (date: DayKey) => void
  subjectName: (id: string | null) => string | undefined
}

export function monthGrid(anchor: DayKey): DayKey[] {
  const d = parseDay(anchor)
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function isoWeek(day: DayKey): number {
  const d = parseDay(day)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86_400_000 - 3 + ((w1.getDay() + 6) % 7)) / 7)
}

export const DRAG_MIME = 'application/x-studyos-item'

export function MonthView(p: ViewProps & { anchor: DayKey; compact: boolean; selectedDate: DayKey; onSelectDate: (d: DayKey) => void }) {
  const days = useMemo(() => monthGrid(p.anchor), [p.anchor])
  const month = parseDay(p.anchor).getMonth()
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7))
  const byKey = useMemo(() => new Map(p.items.map((i) => [i.key, i])), [p.items])
  const drop = (date: DayKey) => (e: React.DragEvent) => {
    const key = e.dataTransfer.getData(DRAG_MIME)
    const item = byKey.get(key)
    e.preventDefault()
    e.currentTarget.classList.remove('ring-2')
    if (key.startsWith('inbox:')) p.onDropTask?.(key.slice(6), date)
    else if (item && item.date !== date) p.onMove(item, date)
  }
  const maxChips = 3

  return (
    <div className="flex min-h-0 flex-col">
      <div className={cn('grid border-b border-border text-xs text-fg-subtle', p.compact ? 'grid-cols-7' : 'grid-cols-[2rem_repeat(7,minmax(0,1fr))]')}>
        {!p.compact && <span className="py-2 text-center" title="Kalenderwoche">KW</span>}
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="py-2 text-center font-medium">{WEEKDAYS_SHORT[d]}</span>)}
      </div>
      <div className="grid flex-1 grid-rows-6" role="grid" aria-label="Monatsansicht">
        {weeks.map((week) => (
          <div key={week[0]} role="row" className={cn('grid border-b border-border last:border-b-0', p.compact ? 'grid-cols-7' : 'grid-cols-[2rem_repeat(7,minmax(0,1fr))]')}>
            {!p.compact && <span className="pt-2 text-center text-[0.7rem] tabular text-fg-subtle">{isoWeek(week[0])}</span>}
            {week.map((day) => {
              const list = itemsOnDay(p.items, day)
              const inMonth = parseDay(day).getMonth() === month
              const isToday = day === p.today
              const weekend = [0, 6].includes(parseDay(day).getDay())
              const label = parseDay(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
              if (p.compact) {
                const sel = day === p.selectedDate
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-selected={sel}
                    aria-label={`${label}, ${list.length} Einträge`}
                    onClick={() => p.onSelectDate(day)}
                    className={cn('flex min-h-14 cursor-pointer flex-col items-center gap-1 border-r border-border py-1.5 last:border-r-0', !inMonth && 'opacity-40', sel && 'bg-accent-soft')}
                  >
                    <span className={cn('flex size-6 items-center justify-center rounded-full text-xs tabular', isToday && 'bg-accent-solid font-semibold text-accent-fg', sel && !isToday && 'font-semibold text-accent')}>{parseDay(day).getDate()}</span>
                    <span className="flex flex-wrap justify-center gap-0.5 px-0.5">
                      {list.slice(0, 4).map((i) => <span key={i.key} className={cn('size-1.5 rounded-full', i.kind === 'exam' && 'size-2')} style={{ background: itemColor(i, p.ctx), opacity: i.done ? 0.4 : 1 }} />)}
                      {list.length > 4 && <span className="text-[0.6rem] leading-none text-fg-subtle">+{list.length - 4}</span>}
                    </span>
                  </button>
                )
              }
              // Lessons repeat every week – in the month they are one summary line, so exams and deadlines stay visible.
              const lessons = list.filter((i) => i.kind === 'lesson')
              const shown = lessons.length && list.length > lessons.length ? list.filter((i) => i.kind !== 'lesson') : lessons.length > 0 && list.length === lessons.length ? [] : list
              const hidden = shown.length - maxChips
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={label}
                  onClick={() => p.onCreate(day)}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(DRAG_MIME)) {
                      e.preventDefault()
                      e.currentTarget.classList.add('ring-2')
                    }
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('ring-2')}
                  onDrop={drop(day)}
                  className={cn('group/cell relative flex min-h-[7.25rem] min-w-0 cursor-pointer flex-col gap-1 border-l border-border p-1.5 ring-inset ring-accent transition-colors hover:bg-surface-2/50', weekend && 'bg-bg-subtle/60', !inMonth && 'opacity-45')}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        p.onOpenDay(day)
                      }}
                      className={cn('flex size-6 cursor-pointer items-center justify-center rounded-full text-xs tabular hover:bg-surface-3', isToday ? 'bg-accent-solid font-semibold text-accent-fg hover:bg-accent-solid-hover' : 'text-fg-muted')}
                      aria-label={`${label} in der Tagesansicht öffnen`}
                    >
                      {parseDay(day).getDate()}
                    </button>
                    <Plus className="size-3.5 text-fg-subtle opacity-0 transition-opacity group-hover/cell:opacity-100" aria-hidden />
                  </div>
                  {shown.slice(0, hidden > 0 ? maxChips - 1 : maxChips).map((i) => (
                    <ItemChip
                      key={i.key}
                      item={i}
                      ctx={p.ctx}
                      selected={p.selectedKey === i.key}
                      onClick={() => p.onSelect(i)}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_MIME, i.key)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                    />
                  ))}
                  {hidden > 0 && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); p.onOpenDay(day) }} className="cursor-pointer self-start rounded px-1 text-xs font-medium text-fg-muted hover:bg-surface-3 hover:text-fg">
                      +{hidden + 1} weitere
                    </button>
                  )}
                  {lessons.length > 0 && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); p.onOpenDay(day) }} className="mt-auto flex max-w-full cursor-pointer items-center gap-1 self-start truncate whitespace-nowrap rounded px-1 text-[0.7rem] text-fg-subtle hover:bg-surface-3 hover:text-fg" title={lessons.map((l) => `${l.start} ${l.title}`).join('\n')}>
                      <span className="flex gap-0.5">{lessons.slice(0, 6).map((l) => <span key={l.key} className="h-2.5 w-1 rounded-sm" style={{ background: itemColor(l, p.ctx) }} />)}</span>
                      <span className="truncate" aria-label={`${lessons.length} Unterrichtsstunden`}>{lessons.length} Std.</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {p.compact && <MobileDayList {...p} date={p.selectedDate} />}
    </div>
  )
}

export function MobileDayList(p: ViewProps & { date: DayKey }) {
  const list = itemsOnDay(p.items, p.date)
  const label = parseDay(p.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section aria-label={`Einträge am ${label}`} className="border-t border-border pt-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <button type="button" onClick={() => p.onCreate(p.date)} className="flex h-9 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium text-accent hover:bg-surface-2"><Plus className="size-4" />Eintrag</button>
      </div>
      {list.length === 0 ? (
        <p className="px-1 py-4 text-sm text-fg-muted">Keine Einträge. Tippe auf „Eintrag“, um etwas zu planen.</p>
      ) : (
        <div className="flex flex-col">
          {list.map((i) => <ItemRow key={i.key} item={i} ctx={p.ctx} onClick={() => p.onSelect(i)} onToggle={(d) => p.onToggle(i, d)} selected={p.selectedKey === i.key} subjectName={p.subjectName(i.subjectId)} overdue={isOverdue(i, p.today)} />)}
        </div>
      )}
    </section>
  )
}
