import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import type { DayKey, EventCustomCategory, PlannerSettings, Subject } from '@/db/types'
import { getPlannerSettings } from '@/db/calendar'
import { buildItems, type CalItem } from '@/lib/calendar/items'
import { KIND_META } from '@/lib/calendar/meta'
import { subjectColorVar } from '@/lib/colors'

/** Everything the calendar needs, live from IndexedDB – every view reads the same sources. */
export function useCalendarSources() {
  const events = useLiveQuery(() => db.events.toArray(), [])
  const exams = useLiveQuery(() => db.exams.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
  const categories = useLiveQuery(() => db.eventCategories.toArray(), [])
  const settings = useLiveQuery(() => getPlannerSettings(), [])
  const profile = useLiveQuery(async () => (await db.profile.get('me')) ?? null, [])
  const ready = !!(events && exams && tasks && subjects && categories && settings && profile !== undefined)
  return { events: events ?? [], exams: exams ?? [], tasks: tasks ?? [], subjects: subjects ?? [], categories: categories ?? [], settings: settings as PlannerSettings, profile: profile ?? null, ready }
}

export type CalendarSources = ReturnType<typeof useCalendarSources>

export function useItems(src: CalendarSources, from: DayKey, to: DayKey): CalItem[] {
  return useMemo(() => (src.ready ? buildItems({ events: src.events, exams: src.exams, tasks: src.tasks, from, to }) : []), [src.ready, src.events, src.exams, src.tasks, from, to])
}

export interface ColorCtx {
  subjects: Map<string, Subject>
  categories: Map<string, EventCustomCategory>
}

export function useColorCtx(src: CalendarSources): ColorCtx {
  return useMemo(() => ({ subjects: new Map(src.subjects.map((s) => [s.id, s])), categories: new Map(src.categories.map((c) => [c.id, c])) }), [src.subjects, src.categories])
}

/** Subject colour first (consistent everywhere), then custom type colour, then the type's colour. */
export function itemColor(i: Pick<CalItem, 'subjectId' | 'customCategoryId' | 'kind'>, ctx: ColorCtx): string {
  const s = i.subjectId ? ctx.subjects.get(i.subjectId) : undefined
  if (s) return subjectColorVar(s.color)
  const c = i.customCategoryId ? ctx.categories.get(i.customCategoryId) : undefined
  if (c) return subjectColorVar(c.color)
  return KIND_META[i.kind].color
}

export function kindLabel(i: Pick<CalItem, 'kind' | 'customCategoryId'>, ctx: ColorCtx): string {
  if (i.kind === 'custom' && i.customCategoryId) return ctx.categories.get(i.customCategoryId)?.name ?? KIND_META.custom.label
  return KIND_META[i.kind].label
}

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    on()
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** Re-renders every minute (now-line, "next up"). */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
