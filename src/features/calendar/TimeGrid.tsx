import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Flag } from 'lucide-react'
import type { DayKey, PlannerSettings } from '@/db/types'
import { cn } from '@/components/ui'
import { parseDay, weekday, WEEKDAYS_SHORT } from '@/lib/dates'
import { itemsOnDay, isOverdue, type CalItem } from '@/lib/calendar/items'
import { layoutTimed } from '@/lib/calendar/layout'
import { PRIORITY_META } from '@/lib/calendar/meta'
import { fromMin, nowMinutes, snap, toMin } from '@/lib/calendar/time'
import { useNow } from './data'
import { ItemBlock, ItemChip, ItemRow } from './ItemCard'
import { DRAG_MIME, type ViewProps } from './MonthView'

const HOUR = 48
const MIN_PX = HOUR / 60

type Drag =
  | { type: 'move'; item: CalItem; offset: number; dayIdx: number; start: number; dur: number; moved: boolean; x: number; y: number }
  | { type: 'resize'; item: CalItem; dayIdx: number; start: number; end: number; moved: boolean; x: number; y: number }
  | { type: 'create'; dayIdx: number; a: number; b: number; moved: boolean; x: number; y: number }

const movable = (i: CalItem) => !i.deadline && !i.allDay && (i.source === 'event' || i.source === 'plan' || i.source === 'exam')

export function TimeGrid(p: ViewProps & { days: DayKey[]; settings: PlannerSettings; detailed?: boolean }) {
  const now = useNow()
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const lastPointer = useRef<string>('mouse')

  // Start the view at 7:00 (or the earliest entry), not at midnight.
  const firstMin = useMemo(() => {
    const starts = p.items.filter((i) => i.start && !i.allDay && p.days.includes(i.date)).map((i) => toMin(i.start!))
    return Math.min(7 * 60, ...starts)
  }, [p.items, p.days])
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (firstMin - 30) * MIN_PX)
    // only on first render of a range
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.days.join()])

  const placed = useMemo(
    () => p.days.map((d) => layoutTimed(itemsOnDay(p.items, d).filter((i) => !i.allDay && i.start && i.date === d))),
    [p.items, p.days],
  )
  const allDay = useMemo(() => p.days.map((d) => itemsOnDay(p.items, d).filter((i) => i.allDay || !i.start)), [p.items, p.days])
  const maxAllDay = Math.max(0, ...allDay.map((l) => l.length))
  const [allDayOpen, setAllDayOpen] = useState(false)
  const allDayLimit = allDayOpen ? Infinity : 3

  const pointerInfo = (clientX: number, clientY: number) => {
    let dayIdx = cols.current.findIndex((c) => {
      const r = c?.getBoundingClientRect()
      return r && clientX >= r.left && clientX < r.right
    })
    if (dayIdx < 0) dayIdx = clientX < (cols.current[0]?.getBoundingClientRect().left ?? 0) ? 0 : p.days.length - 1
    const r = cols.current[dayIdx]!.getBoundingClientRect()
    return { dayIdx, min: Math.max(0, Math.min(24 * 60, (clientY - r.top) / MIN_PX)) }
  }

  const begin = (d: Drag, e: React.PointerEvent) => {
    lastPointer.current = e.pointerType
    if (e.pointerType === 'touch' || e.button !== 0) return // touch: tap to open, editing via dialog
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = d
    setDrag(d)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const moved = d.moved || Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5
    const { dayIdx, min } = pointerInfo(e.clientX, e.clientY)
    let next: Drag
    if (d.type === 'move') next = { ...d, moved, dayIdx, start: Math.max(0, Math.min(24 * 60 - d.dur, snap(min - d.offset))) }
    else if (d.type === 'resize') next = { ...d, moved, end: Math.max(d.start + 15, Math.min(24 * 60 - 1, snap(min))) }
    else next = { ...d, moved, b: snap(min) }
    dragRef.current = next
    setDrag(next)
  }
  const end = () => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    if (d.moved) suppressClick.current = true
    if (d.type === 'move' && d.moved) {
      const day = p.days[d.dayIdx]
      if (day !== d.item.date || fromMin(d.start) !== d.item.start) p.onMove(d.item, day, fromMin(d.start))
    } else if (d.type === 'resize' && d.moved) {
      if (fromMin(d.end) !== d.item.end) p.onResize?.(d.item, fromMin(d.end))
    } else if (d.type === 'create') {
      const a = Math.min(d.a, d.b)
      const b = Math.max(d.a, d.b)
      const start = d.moved && b - a >= 15 ? a : d.a
      const stop = d.moved && b - a >= 15 ? b : d.a + 60
      p.onCreate(p.days[d.dayIdx], fromMin(start), fromMin(Math.min(stop, 24 * 60 - 1)))
      suppressClick.current = true
    }
  }

  const nowMin = nowMinutes(now)
  const gridCols = { gridTemplateColumns: `3.25rem repeat(${p.days.length}, minmax(0, 1fr))` }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers + all-day lane */}
      <div className="grid border-b border-border" style={gridCols}>
        <div />
        {p.days.map((d) => {
          const isToday = d === p.today
          const wd = weekday(d)
          return (
            <button key={d} type="button" onClick={() => p.onOpenDay(d)} className="flex cursor-pointer flex-col items-center gap-0.5 border-l border-border py-2 hover:bg-surface-2/60" aria-label={`${parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} öffnen`}>
              <span className={cn('text-[0.7rem] uppercase tracking-wide', isToday ? 'text-accent' : 'text-fg-subtle')}>{WEEKDAYS_SHORT[wd]}</span>
              <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular', isToday ? 'bg-accent-solid text-accent-fg' : 'text-fg')}>{parseDay(d).getDate()}</span>
            </button>
          )
        })}
      </div>
      {maxAllDay > 0 && (
        <div className="grid border-b border-border bg-bg-subtle/50" style={gridCols}>
          <div className="flex flex-col items-end justify-start gap-1 px-1.5 py-1.5 text-[0.65rem] leading-tight text-fg-subtle">
            <span>ganz&shy;tägig</span>
            {maxAllDay > 3 && (
              <button type="button" onClick={() => setAllDayOpen((o) => !o)} className="cursor-pointer text-accent hover:underline">{allDayOpen ? 'weniger' : 'alle'}</button>
            )}
          </div>
          {allDay.map((list, idx) => (
            <div key={p.days[idx]} className="flex min-w-0 flex-col gap-1 border-l border-border p-1">
              {list.slice(0, allDayLimit).map((i) => (
                <ItemChip key={i.key} item={i} ctx={p.ctx} selected={p.selectedKey === i.key} onClick={() => p.onSelect(i)} onToggle={(d) => p.onToggle(i, d)} compact={p.days.length > 3}
                  draggable onDragStart={(e) => e.dataTransfer.setData(DRAG_MIME, i.key)} />
              ))}
              {list.length > allDayLimit && <button type="button" onClick={() => setAllDayOpen(true)} className="cursor-pointer text-left text-[0.7rem] font-medium text-fg-muted hover:text-fg">+{list.length - allDayLimit} weitere</button>}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" onPointerMove={onMove} onPointerUp={end} onPointerCancel={() => { dragRef.current = null; setDrag(null) }}>
        <div className="grid" style={{ ...gridCols, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[0.68rem] tabular text-fg-subtle" style={{ top: h * HOUR }}>{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span>
            ))}
          </div>
          {p.days.map((d, idx) => {
            const wd = weekday(d)
            const school = p.settings.school[wd]
            const window = p.settings.windows[wd]
            return (
              <div
                key={d}
                ref={(el) => {
                  cols.current[idx] = el
                }}
                className={cn('relative border-l border-border', d === p.today && 'bg-accent-soft/30')}
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HOUR}px)` }}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.bg) return
                  const { min } = pointerInfo(e.clientX, e.clientY)
                  const at = Math.floor(min / 15) * 15
                  begin({ type: 'create', dayIdx: idx, a: at, b: at, moved: false, x: e.clientX, y: e.clientY }, e)
                }}
                onClick={(e) => {
                  if (suppressClick.current) {
                    suppressClick.current = false
                    return
                  }
                  if (lastPointer.current !== 'touch') return
                  if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.bg) return
                  const { min } = pointerInfo(e.clientX, e.clientY)
                  const s = Math.floor(min / 30) * 30
                  p.onCreate(d, fromMin(s), fromMin(s + 60))
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault()
                }}
                onDrop={(e) => {
                  const key = e.dataTransfer.getData(DRAG_MIME)
                  const { min } = pointerInfo(e.clientX, e.clientY)
                  if (key.startsWith('inbox:')) {
                    e.preventDefault()
                    p.onDropTask?.(key.slice(6), d, fromMin(snap(min)))
                    return
                  }
                  const item = p.items.find((i) => i.key === key)
                  if (!item) return
                  e.preventDefault()
                  p.onMove(item, d, item.deadline ? undefined : fromMin(snap(min)))
                }}
                aria-label={`Zeitraster ${parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              >
                {school && (
                  <div data-bg="1" className="absolute inset-x-0" title="Schulzeit" style={{ top: toMin(school.from) * MIN_PX, height: (toMin(school.to) - toMin(school.from)) * MIN_PX, background: 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--fg-subtle) 9%, transparent) 0 6px, transparent 6px 12px)' }} />
                )}
                {window && (
                  <div data-bg="1" className="absolute inset-x-0 border-y border-dashed border-accent/25" title="Lernzeit" style={{ top: toMin(window.from) * MIN_PX, height: (toMin(window.to) - toMin(window.from)) * MIN_PX, background: 'color-mix(in oklab, var(--accent) 5%, transparent)' }} />
                )}
                {placed[idx].map(({ item, startMin, endMin, col, cols: n }) => {
                  const ghost = drag && drag.type !== 'create' && drag.item.key === item.key && drag.moved
                  const top = startMin * MIN_PX
                  const height = Math.max(18, (endMin - startMin) * MIN_PX - 2)
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title}, ${item.start}–${item.end}`}
                      className={cn('absolute', movable(item) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer', ghost && 'opacity-30')}
                      style={{ top, height, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                      onPointerDown={(e) => {
                        if ((e.target as HTMLElement).closest('[role=checkbox]')) return
                        if (!movable(item)) return
                        const { min } = pointerInfo(e.clientX, e.clientY)
                        begin({ type: 'move', item, offset: min - startMin, dayIdx: idx, start: startMin, dur: endMin - startMin, moved: false, x: e.clientX, y: e.clientY }, e)
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (suppressClick.current) {
                          suppressClick.current = false
                          return
                        }
                        p.onSelect(item)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          p.onSelect(item)
                        }
                      }}
                    >
                      <ItemBlock item={item} ctx={p.ctx} style={{ inset: 0 }} height={height} selected={p.selectedKey === item.key} onToggle={(dn) => p.onToggle(item, dn)}>
                        {p.detailed && height >= 90 && item.description && <p className="mt-1 line-clamp-3 text-[0.7rem] text-fg-muted">{item.description}</p>}
                        {p.detailed && height >= 60 && item.priority === 'high' && item.kind !== 'lesson' && <span className="mt-0.5 inline-flex items-center gap-0.5 text-[0.7rem] font-medium text-warn"><Flag className="size-3" />Priorität {PRIORITY_META.high.short}</span>}
                      </ItemBlock>
                      {movable(item) && height >= 24 && (
                        <span
                          aria-hidden
                          className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            begin({ type: 'resize', item, dayIdx: idx, start: startMin, end: endMin, moved: false, x: e.clientX, y: e.clientY }, e)
                          }}
                        />
                      )}
                    </div>
                  )
                })}
                {/* drag previews */}
                {drag && drag.moved && drag.dayIdx === idx && drag.type === 'move' && (
                  <div className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-accent bg-accent-soft px-1.5 py-0.5 text-[0.7rem] font-medium tabular text-accent" style={{ top: drag.start * MIN_PX, height: drag.dur * MIN_PX - 2 }}>
                    {fromMin(drag.start)}–{fromMin(drag.start + drag.dur)}
                  </div>
                )}
                {drag && drag.moved && drag.dayIdx === idx && drag.type === 'resize' && (
                  <div className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-accent bg-accent-soft/60 px-1.5 text-[0.7rem] font-medium tabular text-accent" style={{ top: drag.start * MIN_PX, height: (drag.end - drag.start) * MIN_PX - 2 }}>
                    bis {fromMin(drag.end)}
                  </div>
                )}
                {drag && drag.type === 'create' && drag.moved && drag.dayIdx === idx && (
                  <div className="pointer-events-none absolute inset-x-1 z-20 rounded-md border-2 border-dashed border-accent bg-accent-soft px-1.5 text-[0.7rem] font-medium tabular text-accent" style={{ top: Math.min(drag.a, drag.b) * MIN_PX, height: Math.abs(drag.b - drag.a) * MIN_PX }}>
                    {fromMin(Math.min(drag.a, drag.b))}–{fromMin(Math.max(drag.a, drag.b))}
                  </div>
                )}
                {d === p.today && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowMin * MIN_PX }} aria-hidden>
                    <span className="-ml-1 size-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Day view: big time grid plus the day's deadlines, untimed sessions and notes. */
export function DayView(p: ViewProps & { date: DayKey; settings: PlannerSettings; wide: boolean }) {
  const list = itemsOnDay(p.items, p.date)
  const side = list.filter((i) => i.allDay || !i.start)
  const timed = list.filter((i) => !i.allDay && i.start)
  const open = list.filter((i) => !i.done && !i.cancelled && i.kind !== 'lesson' && i.source !== 'exam')
  const overdue = list.filter((i) => isOverdue(i, p.today))
  return (
    <div className="flex min-h-0 flex-1">
      <TimeGrid {...p} days={[p.date]} detailed items={p.wide ? timed : list} />
      {p.wide && (
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-3" aria-label="Fristen und Aufgaben des Tages">
          <div>
            <div className="eyebrow mb-1 px-1">Fristen & ohne Uhrzeit</div>
            {side.length === 0 ? <p className="px-1 text-sm text-fg-muted">Nichts.</p> : side.map((i) => <ItemRow key={i.key} item={i} ctx={p.ctx} onClick={() => p.onSelect(i)} onToggle={(d) => p.onToggle(i, d)} selected={p.selectedKey === i.key} subjectName={p.subjectName(i.subjectId)} />)}
          </div>
          <div className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-fg-muted">Erledigt</span><span className="tabular font-semibold">{list.filter((i) => i.done).length} / {list.filter((i) => i.kind !== 'lesson' && i.source !== 'exam').length}</span></div>
            <div className="flex items-center justify-between"><span className="text-fg-muted">Offen</span><span className="tabular">{open.length}</span></div>
            <div className="flex items-center justify-between"><span className="text-fg-muted">Geplante Lernzeit</span><span className="tabular">{list.filter((i) => i.kind === 'study' || i.kind === 'flashcards').reduce((s, i) => s + i.minutes, 0)} Min.</span></div>
            {overdue.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-warn"><AlertTriangle className="size-4" />{overdue.length} überfällig</div>}
          </div>
        </aside>
      )}
    </div>
  )
}
