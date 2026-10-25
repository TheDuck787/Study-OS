import { useEffect, useState } from 'react'
import type { DayKey, TimetablePeriod } from '@/db/types'
import { cn } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { layoutTimed } from '@/lib/calendar/layout'
import { fromMin, nowMinutes, toMin } from '@/lib/calendar/time'
import { parseDay, WEEKDAYS_SHORT, weekday } from '@/lib/dates'
import { gridRange } from '@/lib/timetable/core'
import { LessonCard, type CardCtx } from './LessonCard'

export function useNowMin() {
  const [now, setNow] = useState(() => nowMinutes())
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/**
 * Week timetable like WebUntis: periods on the left, one column per school day, lessons placed by time
 * (so double lessons, breaks and lessons outside the bell schedule all fit). Tap a free slot to add a lesson.
 */
export function WeekGrid({ days, lessons, periods, ctx, today, compactCols, onOpen, onAdd }: {
  days: DayKey[]; lessons: CalItem[]; periods: TimetablePeriod[]; ctx: CardCtx; today: DayKey; compactCols: boolean
  onOpen: (l: CalItem) => void; onAdd: (day: DayKey, slot: { start: string; end: string; period: number | null }) => void
}) {
  const nowMin = useNowMin()
  const { from, to } = gridRange(periods, lessons)
  const ppm = compactCols ? 1.05 : 1.25 // pixels per minute
  const height = (to - from) * ppm
  const hours = Array.from({ length: Math.floor((to - from) / 60) + 1 }, (_, i) => from + i * 60)
  const slots = periods.length
    ? periods.map((p) => ({ start: p.start, end: p.end, period: p.n as number | null, label: String(p.n) }))
    : hours.slice(0, -1).map((h) => ({ start: fromMin(h), end: fromMin(h + 45), period: null, label: fromMin(h) }))

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface" role="grid" aria-label="Wochenstundenplan">
      {/* day headers */}
      <div className="grid border-b border-border bg-surface-2/60" style={{ gridTemplateColumns: `${compactCols ? 2.25 : 3.5}rem repeat(${days.length}, minmax(0, 1fr))` }} role="row">
        <div role="columnheader" aria-label="Stunde" />
        {days.map((d) => {
          const isToday = d === today
          return (
            <div key={d} role="columnheader" className={cn('flex flex-col items-center py-2 text-center', isToday && 'text-accent')}>
              <span className="text-[0.7rem] font-semibold uppercase tracking-wide">{WEEKDAYS_SHORT[weekday(d)]}</span>
              <span className={cn('mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular', isToday && 'bg-accent-solid text-accent-fg')}>{parseDay(d).getDate()}</span>
            </div>
          )
        })}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `${compactCols ? 2.25 : 3.5}rem repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* period labels */}
        <div className="relative border-r border-border" style={{ height }} aria-hidden>
          {periods.length
            ? periods.map((p) => (
                <div key={p.n} className="absolute inset-x-0 flex flex-col items-center justify-center text-center" style={{ top: (toMin(p.start) - from) * ppm, height: (toMin(p.end) - toMin(p.start)) * ppm }}>
                  <span className={cn('font-semibold tabular', compactCols ? 'text-sm' : 'text-base')}>{p.n}</span>
                  {!compactCols && <span className="text-[0.65rem] leading-tight text-fg-subtle tabular">{p.start}<br />{p.end}</span>}
                </div>
              ))
            : hours.slice(0, -1).map((h) => (
                <div key={h} className="absolute inset-x-0 pr-1 text-right text-[0.65rem] text-fg-subtle tabular" style={{ top: (h - from) * ppm + 2 }}>{fromMin(h)}</div>
              ))}
        </div>
        {days.map((d) => {
          const placed = layoutTimed(lessons.filter((l) => l.date === d))
          const isToday = d === today
          return (
            <div key={d} role="gridcell" aria-label={parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} className={cn('relative border-r border-border last:border-r-0', isToday && 'bg-accent-soft/40')} style={{ height }}>
              {/* period bands (free slots are buttons) */}
              {slots.map((sl) => {
                const top = (toMin(sl.start) - from) * ppm
                const h = (toMin(sl.end) - toMin(sl.start)) * ppm
                const busy = placed.some((p) => p.startMin < toMin(sl.end) && toMin(sl.start) < p.endMin)
                return (
                  <div key={sl.start} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top, height: h }}>
                    {!busy && (
                      <button type="button" onClick={() => onAdd(d, sl)} className="group/slot flex size-full cursor-pointer items-center justify-center text-fg-subtle opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100" aria-label={`Stunde hinzufügen: ${WEEKDAYS_SHORT[weekday(d)]} ${sl.period != null ? `${sl.period}. Stunde` : sl.start}`}>
                        <span className="text-lg leading-none">+</span>
                      </button>
                    )}
                  </div>
                )
              })}
              {placed.map((p) => (
                <div key={p.item.key} className="absolute p-[2px]" style={{ top: (p.startMin - from) * ppm, height: Math.max(22, (p.endMin - p.startMin) * ppm), left: `${(p.col / p.cols) * 100}%`, width: `${100 / p.cols}%` }}>
                  <LessonCard lesson={p.item} ctx={ctx} density={compactCols || p.cols > 1 ? 'tiny' : 'compact'} onOpen={onOpen} className="h-full" current={isToday && p.startMin <= nowMin && nowMin < p.endMin} />
                </div>
              ))}
              {isToday && nowMin >= from && nowMin <= to && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin - from) * ppm }} aria-hidden>
                  <span className="-ml-1 size-2 rounded-full bg-danger" />
                  <span className="h-px flex-1 bg-danger" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
