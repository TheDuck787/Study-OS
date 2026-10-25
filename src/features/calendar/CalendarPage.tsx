import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Filter, ListChecks, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, RefreshCcw, Search, Sparkles, Sun, Undo2, Wand2, X,
} from 'lucide-react'
import type { DayKey } from '@/db/types'
import { moveItem, saveTask, scheduleTask, setItemDone } from '@/db/calendar'
import { ValidationError } from '@/db/repo'
import { Badge, Button, cn, Dialog, IconButton, Input, Kbd, LoadingBlock, Menu, Segmented, useToast } from '@/components/ui'
import { addDays, dayKey, parseDay, startOfWeek } from '@/lib/dates'
import { activeFilterCount, EMPTY_FILTERS, filterItems, type CalFilters } from '@/lib/calendar/filters'
import { isOverdue, type CalItem } from '@/lib/calendar/items'
import { peekUndo, subscribeUndo, undoLast, type UndoEntry } from '@/lib/undo'
import { useCalendarSources, useColorCtx, useItems, useMediaQuery } from './data'
import { MonthView, monthGrid, isoWeek } from './MonthView'
import { DayView, TimeGrid } from './TimeGrid'
import { AgendaView, SemesterView } from './AgendaView'
import { DetailPanel } from './DetailPanel'
import { EntryEditor, type EditorTarget } from './EntryEditor'
import { FilterPanel, Sidebar } from './Sidebar'
import { PlannerDialog, type PlannerMode } from './PlannerDialog'

export type CalView = 'month' | 'week' | 'day' | 'agenda' | 'semester'
const VIEWS: { value: CalView; label: string; short: string; key: string }[] = [
  { value: 'month', label: 'Monat', short: 'Monat', key: 'M' },
  { value: 'week', label: 'Woche', short: 'Woche', key: 'W' },
  { value: 'day', label: 'Tag', short: 'Tag', key: 'D' },
  { value: 'agenda', label: 'Agenda', short: 'Liste', key: 'A' },
  { value: 'semester', label: 'Halbjahr', short: 'Halbjahr', key: 'H' },
]

const FILTER_KEY = 'studyos.calendar.filters'
function loadFilters(): CalFilters {
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}'), search: '' }
  } catch {
    return EMPTY_FILTERS
  }
}

export default function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const today = dayKey()
  const wide = useMediaQuery('(min-width: 1024px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const small = useMediaQuery('(max-width: 639px)')
  const view = (VIEWS.some((v) => v.value === params.get('ansicht')) ? params.get('ansicht') : small ? 'agenda' : 'week') as CalView
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('datum') ?? '') ? params.get('datum')! : today
  const [filters, setFiltersState] = useState<CalFilters>(loadFilters)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filterSheet, setFilterSheet] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [planner, setPlanner] = useState<PlannerMode | null>(null)
  const [agendaDays, setAgendaDays] = useState(30)
  const [undoTop, setUndoTop] = useState<UndoEntry | null>(peekUndo())
  useEffect(() => subscribeUndo(setUndoTop), [])

  const setFilters = (f: CalFilters) => {
    setFiltersState(f)
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({ ...f, search: '' }))
    } catch {
      /* per-device convenience only */
    }
  }
  const go = useCallback((v: CalView, d: DayKey) => setParams({ ansicht: v, datum: d }, { replace: true }), [setParams])

  const src = useCalendarSources()
  const ctx = useColorCtx(src)
  const threeDay = small && view === 'week'
  const range = useMemo((): [DayKey, DayKey] => {
    if (filters.search.trim()) return [addDays(today, -365), addDays(today, 365)]
    switch (view) {
      case 'month': {
        const g = monthGrid(anchor)
        return [g[0], g[41]]
      }
      case 'week':
        return threeDay ? [anchor, addDays(anchor, 2)] : [startOfWeek(anchor), addDays(startOfWeek(anchor), 6)]
      case 'day':
        return [anchor, anchor]
      case 'agenda':
        return [anchor, addDays(anchor, agendaDays)]
      case 'semester':
        return [startOfWeek(anchor), addDays(startOfWeek(anchor), 26 * 7 - 1)]
    }
  }, [view, anchor, threeDay, agendaDays, filters.search, today])
  const rawItems = useItems(src, range[0], range[1])
  const subjectName = useCallback((id: string | null) => (id ? ctx.subjects.get(id)?.name : undefined), [ctx])
  const items = useMemo(() => filterItems(rawItems, filters, (id) => ctx.subjects.get(id)?.name), [rawItems, filters, ctx])
  const pastItems = useItems(src, addDays(today, -30), addDays(today, -1))
  const overdue = useMemo(() => filterItems(pastItems, { ...filters, status: 'all' }, (id) => ctx.subjects.get(id)?.name).filter((i) => isOverdue(i, today)), [pastItems, filters, ctx, today])
  const counts = useMemo(() => {
    const bySubject = new Map<string, number>()
    const byKind = new Map<string, number>()
    for (const i of rawItems) {
      bySubject.set(i.subjectId ?? 'none', (bySubject.get(i.subjectId ?? 'none') ?? 0) + 1)
      byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1)
    }
    return { bySubject, byKind }
  }, [rawItems])
  const selected = useMemo(() => [...items, ...overdue].find((i) => i.key === selectedKey) ?? null, [items, overdue, selectedKey])
  const inbox = useMemo(() => src.tasks.filter((t) => t.status === 'open' && !t.dueDate && !src.events.some((e) => e.taskId === t.id)), [src.tasks, src.events])

  const step = (dir: 1 | -1) => {
    const d = parseDay(anchor)
    if (view === 'month') go(view, dayKey(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
    else if (view === 'week') go(view, addDays(anchor, dir * (threeDay ? 3 : 7)))
    else if (view === 'day') go(view, addDays(anchor, dir))
    else if (view === 'agenda') go(view, addDays(anchor, dir * 30))
    else go(view, addDays(anchor, dir * 28))
  }

  const fail = (e: unknown) => toast({ title: e instanceof ValidationError ? e.message : 'Das hat nicht geklappt', tone: 'danger' })
  const undoAction = { label: 'Rückgängig', onClick: () => undoLast().then((l) => l && toast({ title: `Rückgängig: ${l}` })) }
  const onToggle = (i: CalItem, done: boolean) => setItemDone(i, done).then(() => toast({ title: done ? 'Erledigt' : 'Wieder offen', tone: done ? 'success' : 'neutral', action: undoAction }), fail)
  const onMove = (i: CalItem, date: DayKey, start?: string | null) => moveItem(i, date, start).then(() => toast({ title: 'Verschoben', description: `„${i.title}“ → ${parseDay(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}${start ? ` ${start}` : ''}`, action: undoAction }), fail)
  const onResize = (i: CalItem, end: string) => import('@/db/calendar').then((m) => m.resizeItem(i, end)).then(() => toast({ title: 'Dauer geändert', action: undoAction }), fail)
  const onCreate = (date: DayKey, start?: string, end?: string) => setEditor({ mode: 'create', date, start, end, allDay: false })
  const onOpenDay = (d: DayKey) => go('day', d)
  const onDropTask = async (taskId: string, date: DayKey, start?: string) => {
    const t = src.tasks.find((x) => x.id === taskId)
    if (!t) return
    try {
      if (start) await scheduleTask(taskId, date, start, Math.min(90, t.estimateMinutes ?? 30))
      else await saveTask({ ...t, dueDate: date })
      toast({ title: start ? 'Arbeitszeit eingeplant' : 'Fälligkeitsdatum gesetzt', description: t.title, action: undoAction })
    } catch (e) {
      fail(e)
    }
  }

  // Keyboard shortcuts (only when no dialog/input is focused)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || document.querySelector('dialog[open]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undoAction.onClick()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      const v = VIEWS.find((x) => x.key.toLowerCase() === k)
      if (v) go(v.value, anchor)
      else if (k === 't') go(view, today)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else if (k === 'n' || k === 'c') onCreate(view === 'day' ? anchor : today)
      else if (k === 'f') setSearchOpen(true)
      else if (k === 'e' && selected) setEditor({ mode: 'edit', item: selected })
      else if (e.key === 'Escape') setSelectedKey(null)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!src.ready) return <LoadingBlock label="Kalender wird geladen …" />

  const title = (() => {
    const d = parseDay(anchor)
    if (filters.search.trim()) return 'Suche'
    if (view === 'month') return d.toLocaleDateString('de-DE', { month: small ? 'short' : 'long', year: 'numeric' })
    if (view === 'week') {
      const a = parseDay(range[0])
      const b = parseDay(range[1])
      return `${a.getDate()}.${a.getMonth() !== b.getMonth() ? ` ${a.toLocaleDateString('de-DE', { month: 'short' })}` : ''}–${b.getDate()}. ${b.toLocaleDateString('de-DE', small ? { month: 'short' } : { month: 'short', year: 'numeric' })}`
    }
    if (view === 'day') return d.toLocaleDateString('de-DE', small ? { weekday: 'short', day: 'numeric', month: 'long' } : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (view === 'agenda') return `Ab ${d.toLocaleDateString('de-DE', { day: 'numeric', month: small ? 'short' : 'long' })}`
    return small ? 'Halbjahr' : 'Halbjahr & Prüfungen'
  })()

  const viewProps = { items, today, ctx, selectedKey, onSelect: (i: CalItem) => setSelectedKey(i.key), onToggle, onCreate, onMove, onResize, onOpenDay, subjectName, onDropTask }
  const filterPanel = <FilterPanel filters={filters} setFilters={setFilters} subjects={src.subjects} categories={src.categories} counts={counts} />
  const plannerMenu = [
    { label: 'Lernplan automatisch erstellen', icon: Wand2, onSelect: () => setPlanner('create') },
    { label: 'Plan neu berechnen', icon: RefreshCcw, onSelect: () => setPlanner('recalc') },
    { label: 'Plan für heute optimieren', icon: Sun, onSelect: () => setPlanner('today') },
    { label: 'Wochenplanung & Rückblick', icon: ClipboardList, onSelect: () => navigate('/wochenplanung') },
    { label: 'Mein Tag', icon: CalendarDays, onSelect: () => navigate('/mein-tag') },
    { label: 'Aufgaben', icon: ListChecks, onSelect: () => navigate('/aufgaben') },
  ]
  const nFilters = activeFilterCount({ ...filters, search: '' })

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 lg:px-4" style={{ paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))' }}>
        {wide && <IconButton label={sidebarOpen ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden'} icon={sidebarOpen ? PanelLeftClose : PanelLeftOpen} onClick={() => setSidebarOpen((o) => !o)} />}
        <Button size="sm" onClick={() => go(view, today)} title="Heute (T)">Heute</Button>
        <div className="flex">
          <IconButton label="Zurück (←)" icon={ChevronLeft} onClick={() => step(-1)} />
          <IconButton label="Weiter (→)" icon={ChevronRight} onClick={() => step(1)} />
        </div>
        <h1 className="min-w-0 flex-1 truncate whitespace-nowrap font-display text-base font-semibold sm:text-lg" aria-live="polite">
          {title}
          {view === 'week' && !small && !filters.search && <span className="ml-2 text-sm font-normal text-fg-subtle">KW {isoWeek(range[0])}</span>}
        </h1>
        <label className="sr-only" htmlFor="cal-date">Datum wählen</label>
        <input id="cal-date" type="date" value={anchor} onChange={(e) => e.target.value && go(view, e.target.value)} className="hidden h-9 rounded-md border border-border bg-surface px-2 text-sm text-fg 2xl:block" />
        {searchOpen || filters.search ? (
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 size-4 text-fg-subtle" />
            <Input autoFocus value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Einträge suchen …" aria-label="Einträge und Aufgaben suchen" className="h-9 w-44 pl-8 sm:w-56" onKeyDown={(e) => { if (e.key === 'Escape') { setFilters({ ...filters, search: '' }); setSearchOpen(false) } }} />
            <button type="button" aria-label="Suche schließen" onClick={() => { setFilters({ ...filters, search: '' }); setSearchOpen(false) }} className="absolute right-1.5 cursor-pointer p-1 text-fg-subtle hover:text-fg"><X className="size-3.5" /></button>
          </div>
        ) : (
          <IconButton label="Suchen (F)" icon={Search} onClick={() => setSearchOpen(true)} />
        )}
        {!wide && (
          <button type="button" onClick={() => setFilterSheet(true)} className="relative flex size-9 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-2" aria-label={`Filter${nFilters ? ` (${nFilters} aktiv)` : ''}`}>
            <Filter className="size-4" />
            {nFilters > 0 && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent-solid text-[0.6rem] font-semibold text-accent-fg">{nFilters}</span>}
          </button>
        )}
        <IconButton label={undoTop ? `Rückgängig: ${undoTop.label} (Strg+Z)` : 'Nichts rückgängig zu machen'} icon={Undo2} onClick={undoAction.onClick} disabled={!undoTop} />
        {wide && <Button size="sm" icon={Sparkles} onClick={() => setPlanner('create')}>Lernplan automatisch erstellen</Button>}
        <Menu label="Planer und weitere Aktionen" icon={MoreHorizontal} items={plannerMenu} />
        {wide && <Button size="sm" variant="primary" icon={Plus} onClick={() => onCreate(view === 'day' ? anchor : today)} title="Neuer Eintrag (N)">Neu</Button>}
        <div className="w-full sm:w-auto sm:order-none">
          <Segmented label="Ansicht" size="sm" value={view} onChange={(v) => go(v, v === 'semester' && view !== 'semester' ? today : anchor)} options={VIEWS.map((v) => ({ value: v.value, label: small ? v.short : v.label, title: `${v.label} (${v.key})` }))} />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {wide && sidebarOpen && (
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-border px-3 py-4" aria-label="Kalender-Seitenleiste">
            <Sidebar date={anchor} today={today} onPick={(d) => go(view === 'semester' || view === 'agenda' ? 'day' : view, d)} exams={src.exams} inbox={inbox} subjects={src.subjects}
              onOpenExam={(x) => go('day', x.date)} onOpenTask={(t) => navigate(`/aufgaben?aufgabe=${t.id}`)} filterPanel={filterPanel} />
          </aside>
        )}

        <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col', (view === 'agenda' || view === 'semester' || filters.search) && 'overflow-y-auto px-3 pt-3 lg:px-5')} aria-label={`Kalender: ${VIEWS.find((v) => v.value === view)?.label}`}>
          {nFilters > 0 && (
            <div className="flex items-center gap-2 border-b border-border bg-accent-soft/40 px-3 py-1.5 text-xs">
              <Filter className="size-3.5 text-accent" /><span>{nFilters} Filter aktiv – {items.length} von {rawItems.length} Einträgen sichtbar</span>
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="ml-auto cursor-pointer font-medium text-accent hover:underline">Alle zeigen</button>
            </div>
          )}
          {filters.search.trim() ? (
            <AgendaView {...viewProps} from={range[0]} to={range[1]} overdue={[]} title="Keine Treffer" emptyText="Suche nach Titel, Fach, Ort, Lehrkraft oder Beschreibung – im Zeitraum ein Jahr zurück bis ein Jahr voraus." />
          ) : view === 'month' ? (
            <div className={cn('flex min-h-0 flex-1 flex-col', small ? 'overflow-y-auto px-2 pb-24' : 'overflow-y-auto')}>
              <MonthView {...viewProps} anchor={anchor} compact={small} selectedDate={anchor} onSelectDate={(d) => go('month', d)} />
            </div>
          ) : view === 'week' ? (
            <TimeGrid {...viewProps} days={threeDay ? [anchor, addDays(anchor, 1), addDays(anchor, 2)] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))} settings={src.settings} />
          ) : view === 'day' ? (
            <DayView {...viewProps} date={anchor} settings={src.settings} wide={wide} />
          ) : view === 'agenda' ? (
            <AgendaView {...viewProps} from={range[0]} to={range[1]} overdue={anchor <= today ? overdue : []} onMore={() => setAgendaDays((n) => n + 30)} />
          ) : (
            <SemesterView {...viewProps} from={range[0]} weeks={26} exams={src.exams} />
          )}
        </section>

        {xl && selected && (
          <aside className="drawer-in absolute inset-y-0 right-0 z-20 w-[23rem] overflow-y-auto border-l border-border bg-surface p-4 shadow-[var(--shadow)]" aria-label="Details">
            <DetailPanel item={selected} ctx={ctx} today={today} onClose={() => setSelectedKey(null)} onEdit={() => setEditor({ mode: 'edit', item: selected })} onDeleted={() => setSelectedKey(null)} />
          </aside>
        )}
      </div>

      {!xl && (
        <Dialog open={!!selected} onClose={() => setSelectedKey(null)} title="Details" size="md">
          {selected && <DetailPanel item={selected} ctx={ctx} today={today} onEdit={() => { const it = selected; setSelectedKey(null); setEditor({ mode: 'edit', item: it }) }} onDeleted={() => setSelectedKey(null)} />}
        </Dialog>
      )}

      {!wide && (
        <Dialog open={filterSheet} onClose={() => setFilterSheet(false)} title="Filter & Legende" size="md">
          <div className="flex flex-col gap-4">
            {filterPanel}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="eyebrow">Planer</span>
              {plannerMenu.slice(0, 3).map((m) => <Button key={m.label} icon={m.icon} onClick={() => { setFilterSheet(false); m.onSelect() }} className="justify-start">{m.label}</Button>)}
            </div>
          </div>
        </Dialog>
      )}

      {/* Mobile quick add */}
      {!wide && (
        <button type="button" onClick={() => onCreate(view === 'day' || view === 'month' ? anchor : today)} aria-label="Neuer Eintrag"
          className="fixed right-4 z-20 flex size-14 cursor-pointer items-center justify-center rounded-full bg-accent-solid text-accent-fg shadow-[var(--shadow)] transition-transform active:scale-95"
          style={{ bottom: 'calc(16px + var(--mobile-nav-h, 0px) + env(safe-area-inset-bottom, 0px))' }}>
          <Plus className="size-6" />
        </button>
      )}

      <EntryEditor target={editor} onClose={() => setEditor(null)} onSaved={(msg) => toast({ title: msg, tone: 'success', action: undoAction })} />
      <PlannerDialog mode={planner} onClose={() => setPlanner(null)} subjects={src.subjects} />
      {wide && (
        <div className="hidden border-t border-border px-4 py-1.5 text-[0.7rem] text-fg-subtle xl:flex xl:gap-4">
          <span><Kbd>T</Kbd> Heute</span><span><Kbd>←</Kbd><Kbd>→</Kbd> Blättern</span><span><Kbd>M</Kbd><Kbd>W</Kbd><Kbd>D</Kbd><Kbd>A</Kbd><Kbd>H</Kbd> Ansicht</span><span><Kbd>N</Kbd> Neu</span><span><Kbd>E</Kbd> Bearbeiten</span><span><Kbd>F</Kbd> Suchen</span><span><Kbd>Strg Z</Kbd> Rückgängig</span>
          <span className="ml-auto flex items-center gap-1.5"><Badge>Ziehen</Badge> verschiebt · untere Kante ändert die Dauer · in freie Zeit ziehen legt an</span>
        </div>
      )}
    </div>
  )
}

