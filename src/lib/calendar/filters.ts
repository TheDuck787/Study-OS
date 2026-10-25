import type { Priority } from '@/db/types'
import type { CalItem } from './items'
import { KIND_META, type ItemKind } from './meta'

export type QuickFilter = 'exams' | 'study' | 'personal' | 'deadlines'
export type StatusFilter = 'all' | 'open' | 'done'

export interface CalFilters {
  /** Empty = all subjects. "none" = entries without subject. */
  subjects: string[]
  /** Empty = all kinds. */
  kinds: ItemKind[]
  priorities: Priority[]
  status: StatusFilter
  quick: QuickFilter | null
  search: string
}

export const EMPTY_FILTERS: CalFilters = { subjects: [], kinds: [], priorities: [], status: 'all', quick: null, search: '' }

export const QUICK_FILTERS: Record<QuickFilter, { label: string; match: (i: CalItem) => boolean }> = {
  exams: { label: 'Prüfungen', match: (i) => i.kind === 'exam' },
  deadlines: { label: 'Fristen', match: (i) => i.deadline || i.kind === 'exam' },
  study: { label: 'Lernen', match: (i) => KIND_META[i.kind].study },
  personal: { label: 'Privat', match: (i) => ['appointment', 'break', 'internship', 'custom'].includes(i.kind) && !i.subjectId },
}

export const activeFilterCount = (f: CalFilters) => f.subjects.length + f.kinds.length + f.priorities.length + (f.status !== 'all' ? 1 : 0) + (f.quick ? 1 : 0) + (f.search.trim() ? 1 : 0)

const norm = (s: string) => s.toLocaleLowerCase('de').normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function matchesSearch(i: CalItem, q: string, subjectName?: (id: string) => string | undefined): boolean {
  const needle = norm(q.trim())
  if (!needle) return true
  const hay = norm([i.title, i.description, i.location, i.teacher, i.subjectId ? subjectName?.(i.subjectId) ?? '' : '', KIND_META[i.kind].label].join(' '))
  return needle.split(/\s+/).every((w) => hay.includes(w))
}

export function filterItems(items: CalItem[], f: CalFilters, subjectName?: (id: string) => string | undefined): CalItem[] {
  return items.filter((i) => {
    if (f.subjects.length && !f.subjects.includes(i.subjectId ?? 'none')) return false
    if (f.kinds.length && !f.kinds.includes(i.kind)) return false
    if (f.priorities.length && !f.priorities.includes(i.priority)) return false
    if (f.status === 'open' && (i.done || i.cancelled)) return false
    if (f.status === 'done' && !i.done) return false
    if (f.quick && !QUICK_FILTERS[f.quick].match(i)) return false
    return matchesSearch(i, f.search, subjectName)
  })
}

export function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

