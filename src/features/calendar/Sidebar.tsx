import { useState } from 'react'
import { ChevronLeft, ChevronRight, HardDrive, Inbox, Plus, Trash2 } from 'lucide-react'
import type { DayKey, EventCustomCategory, Exam, Priority, Subject, Task } from '@/db/types'
import { deleteCustomCategory, saveCustomCategory } from '@/db/calendar'
import { ValidationError } from '@/db/repo'
import { cn, Input, useConfirm, useToast } from '@/components/ui'
import { addDays, parseDay, relativeDay, WEEKDAYS_SHORT } from '@/lib/dates'
import { activeFilterCount, EMPTY_FILTERS, QUICK_FILTERS, toggle, type CalFilters, type QuickFilter } from '@/lib/calendar/filters'
import { KIND_META, PRIORITY_META, subjectIcon, type ItemKind } from '@/lib/calendar/meta'
import { subjectColorVar, SUBJECT_COLOR_COUNT } from '@/lib/colors'
import { monthGrid, DRAG_MIME } from './MonthView'

const LEGEND_KINDS: ItemKind[] = ['lesson', 'exam', 'homework', 'project', 'study', 'flashcards', 'appointment', 'internship', 'break', 'todo']

export function MiniMonth({ value, today, onPick, marks }: { value: DayKey; today: DayKey; onPick: (d: DayKey) => void; marks: Set<DayKey> }) {
  const [anchor, setAnchor] = useState(value)
  const days = monthGrid(anchor)
  const month = parseDay(anchor).getMonth()
  const shift = (n: number) => {
    const d = parseDay(anchor)
    const nd = new Date(d.getFullYear(), d.getMonth() + n, 1)
    setAnchor(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-01`)
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">{parseDay(anchor).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
        <div className="flex">
          <button type="button" aria-label="Vorheriger Monat" onClick={() => shift(-1)} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-2"><ChevronLeft className="size-4" /></button>
          <button type="button" aria-label="Nächster Monat" onClick={() => shift(1)} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-fg-muted hover:bg-surface-2"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.65rem] text-fg-subtle">{[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="py-0.5">{WEEKDAYS_SHORT[d].slice(0, 2)}</span>)}</div>
      <div className="grid grid-cols-7 text-center text-xs">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => onPick(d)} aria-label={parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} aria-current={d === value ? 'date' : undefined}
            className={cn('relative mx-auto flex size-7 cursor-pointer items-center justify-center rounded-full tabular hover:bg-surface-2', parseDay(d).getMonth() !== month && 'text-fg-subtle/60', d === today && 'font-bold text-accent', d === value && 'bg-accent-solid text-accent-fg hover:bg-accent-solid-hover')}>
            {parseDay(d).getDate()}
            {marks.has(d) && d !== value && <span className="absolute bottom-0.5 size-1 rounded-full bg-danger" />}
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1"><h3 className="eyebrow">{title}</h3>{action}</div>
      {children}
    </section>
  )
}

function ToggleRow({ on, onClick, color, label, icon: Icon, count }: { on: boolean; onClick: () => void; color: string; label: string; icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; count?: number }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className={cn('flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left text-sm transition-colors hover:bg-surface-2', on ? 'text-fg' : 'text-fg-muted')}>
      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border', on ? 'border-transparent' : 'border-border-strong')} style={on ? { background: color } : undefined} aria-hidden />
      {Icon && <Icon className="size-3.5 shrink-0" style={{ color }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs tabular text-fg-subtle">{count}</span>}
    </button>
  )
}

export function FilterPanel({ filters, setFilters, subjects, categories, counts }: {
  filters: CalFilters; setFilters: (f: CalFilters) => void; subjects: Subject[]; categories: EventCustomCategory[]; counts: { bySubject: Map<string, number>; byKind: Map<string, number> }
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [newCat, setNewCat] = useState('')
  return (
    <div className="flex flex-col gap-5">
      <Section title="Schnellfilter" action={activeFilterCount(filters) > 0 && <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, search: filters.search })} className="cursor-pointer text-xs font-medium text-accent hover:underline">Zurücksetzen</button>}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(QUICK_FILTERS) as QuickFilter[]).map((q) => (
            <button key={q} type="button" aria-pressed={filters.quick === q} onClick={() => setFilters({ ...filters, quick: filters.quick === q ? null : q })}
              className={cn('h-7 cursor-pointer rounded-full border px-2.5 text-xs font-medium', filters.quick === q ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>
              {QUICK_FILTERS[q].label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {(['all', 'open', 'done'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filters.status === s} onClick={() => setFilters({ ...filters, status: s })} className={cn('h-7 flex-1 cursor-pointer rounded-md border text-xs', filters.status === s ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>
              {s === 'all' ? 'Alle' : s === 'open' ? 'Offen' : 'Erledigt'}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Fächer">
        {subjects.length === 0 && <p className="px-1 text-xs text-fg-muted">Noch keine Fächer.</p>}
        {subjects.map((s) => <ToggleRow key={s.id} on={filters.subjects.length === 0 || filters.subjects.includes(s.id)} onClick={() => setFilters({ ...filters, subjects: filters.subjects.length === 0 ? subjects.filter((x) => x.id !== s.id).map((x) => x.id).concat('none') : toggle(filters.subjects, s.id) })} color={subjectColorVar(s.color)} label={s.name} icon={subjectIcon(s)} count={counts.bySubject.get(s.id)} />)}
        <ToggleRow on={filters.subjects.length === 0 || filters.subjects.includes('none')} onClick={() => setFilters({ ...filters, subjects: filters.subjects.length === 0 ? subjects.map((x) => x.id) : toggle(filters.subjects, 'none') })} color="var(--fg-subtle)" label="Ohne Fach" count={counts.bySubject.get('none')} />
        {filters.subjects.length > 0 && <button type="button" onClick={() => setFilters({ ...filters, subjects: [] })} className="cursor-pointer self-start px-1 text-xs text-accent hover:underline">Alle Fächer zeigen</button>}
      </Section>
      <Section title="Typen">
        {LEGEND_KINDS.map((k) => <ToggleRow key={k} on={filters.kinds.length === 0 || filters.kinds.includes(k)} onClick={() => setFilters({ ...filters, kinds: filters.kinds.length === 0 ? [k] : toggle(filters.kinds, k) })} color={KIND_META[k].color} label={KIND_META[k].plural} icon={KIND_META[k].icon} count={counts.byKind.get(k)} />)}
        <ToggleRow on={filters.kinds.length === 0 || filters.kinds.includes('custom')} onClick={() => setFilters({ ...filters, kinds: filters.kinds.length === 0 ? ['custom'] : toggle(filters.kinds, 'custom') })} color={KIND_META.custom.color} label="Eigene Typen" icon={KIND_META.custom.icon} count={counts.byKind.get('custom')} />
        {filters.kinds.length > 0 && <button type="button" onClick={() => setFilters({ ...filters, kinds: [] })} className="cursor-pointer self-start px-1 text-xs text-accent hover:underline">Alle Typen zeigen</button>}
        <p className="px-1 text-[0.7rem] leading-snug text-fg-subtle">Einträge mit Fach haben die Farbe des Fachs, sonst die Farbe ihres Typs. Gestrichelt = vom Planer vorgeschlagen.</p>
      </Section>
      <Section title="Priorität">
        <div className="flex gap-1.5">
          {(['high', 'medium', 'low'] as Priority[]).map((p) => (
            <button key={p} type="button" aria-pressed={filters.priorities.includes(p)} onClick={() => setFilters({ ...filters, priorities: toggle(filters.priorities, p) })} className={cn('h-7 flex-1 cursor-pointer rounded-md border text-xs', filters.priorities.includes(p) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>{PRIORITY_META[p].label}</button>
          ))}
        </div>
      </Section>
      <Section title="Eigene Typen">
        {categories.map((c) => (
          <div key={c.id} className="group flex h-8 items-center gap-2 px-1.5 text-sm">
            <button type="button" aria-label={`Farbe von ${c.name} ändern`} onClick={() => saveCustomCategory({ ...c, color: (c.color + 1) % SUBJECT_COLOR_COUNT })} className="size-3.5 cursor-pointer rounded-full" style={{ background: subjectColorVar(c.color) }} />
            <span className="flex-1 truncate">{c.name}</span>
            <button type="button" aria-label={`Typ ${c.name} löschen`} onClick={async () => { if (await confirm({ title: `Typ „${c.name}“ löschen?`, message: 'Einträge dieses Typs werden zu „Termin“.' })) await deleteCustomCategory(c.id) }} className="cursor-pointer text-fg-subtle opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        <form className="flex gap-1.5" onSubmit={async (e) => {
          e.preventDefault()
          try {
            await saveCustomCategory({ name: newCat, color: categories.length % SUBJECT_COLOR_COUNT })
            setNewCat('')
          } catch (err) {
            toast({ title: err instanceof ValidationError ? err.message : String(err), tone: 'danger' })
          }
        }}>
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="z. B. Chor, Nachhilfe" aria-label="Neuer eigener Typ" className="h-8 text-sm" />
          <button type="submit" aria-label="Typ hinzufügen" disabled={!newCat.trim()} className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-fg-muted hover:bg-surface-2 disabled:opacity-40"><Plus className="size-4" /></button>
        </form>
      </Section>
    </div>
  )
}

export function Sidebar(p: {
  date: DayKey; today: DayKey; onPick: (d: DayKey) => void; exams: Exam[]; inbox: Task[]; subjects: Subject[]; onOpenExam: (x: Exam) => void; onOpenTask: (t: Task) => void
  filterPanel: React.ReactNode
}) {
  const upcoming = p.exams.filter((x) => x.date >= p.today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const marks = new Set(p.exams.map((x) => x.date))
  return (
    <div className="flex flex-col gap-6">
      <MiniMonth value={p.date} today={p.today} onPick={p.onPick} marks={marks} />
      <section className="flex flex-col gap-1">
        <h3 className="eyebrow px-1">Nächste Prüfungen</h3>
        {upcoming.length === 0 ? <p className="px-1 text-xs text-fg-muted">Keine eingetragen.</p> : upcoming.map((x) => {
          const s = p.subjects.find((y) => y.id === x.subjectId)
          return (
            <button key={x.id} type="button" onClick={() => p.onOpenExam(x)} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2">
              <span className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: s ? subjectColorVar(s.color) : 'var(--danger)' }} />
              <span className="min-w-0 flex-1 truncate">{x.title}</span>
              <span className={cn('shrink-0 text-xs tabular', x.date <= addDays(p.today, 3) ? 'font-semibold text-warn' : 'text-fg-subtle')}>{relativeDay(x.date, p.today)}</span>
            </button>
          )
        })}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="eyebrow flex items-center gap-1.5 px-1"><Inbox className="size-3.5" />Eingang ({p.inbox.length})</h3>
        {p.inbox.length === 0 ? <p className="px-1 text-xs text-fg-muted">Keine Aufgaben ohne Datum.</p> : (
          <>
            {p.inbox.slice(0, 8).map((t) => {
              const s = p.subjects.find((y) => y.id === t.subjectId)
              return (
                <button key={t.id} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, `inbox:${t.id}`); e.dataTransfer.effectAllowed = 'move' }} onClick={() => p.onOpenTask(t)}
                  className="flex cursor-grab items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-left text-sm hover:border-border-strong active:cursor-grabbing" title="In den Kalender ziehen, um Arbeitszeit einzuplanen">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: s ? subjectColorVar(s.color) : 'var(--fg-subtle)' }} />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                </button>
              )
            })}
            <p className="px-1 text-[0.7rem] text-fg-subtle">Ziehe eine Aufgabe in den Kalender, um Arbeitszeit einzuplanen.</p>
          </>
        )}
      </section>
      {p.filterPanel}
      <p className="flex gap-1.5 px-1 text-[0.7rem] leading-snug text-fg-subtle"><HardDrive className="mt-0.5 size-3 shrink-0" />Alles wird nur in diesem Browser gespeichert und nicht automatisch mit anderen Geräten abgeglichen. Übertragen: Einstellungen → Sicherung.</p>
    </div>
  )
}
