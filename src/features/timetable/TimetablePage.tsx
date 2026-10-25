import { useMemo, useRef, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, Download, FileDown, FileUp, ListTree, MoreHorizontal, Plus, Settings2, Sparkles, Upload, Wand2 } from 'lucide-react'
import type { DayKey, ID } from '@/db/types'
import { applySchoolTimesToPlanner, type LessonInput } from '@/db/timetable'
import { deleteEvent } from '@/db/calendar'
import { Button, Card, cn, EmptyState, IconButton, LoadingBlock, Menu, PageHeader, Segmented, useToast } from '@/components/ui'
import { saveFile } from '@/lib/download'
import { addDays, dayKey, parseDay, startOfWeek, weekday } from '@/lib/dates'
import { undoLast } from '@/lib/undo'
import { isoWeek, weekDays, weekTypeOf } from '@/lib/timetable/core'
import { exportTimetableCsv } from '@/lib/timetable/csv'
import { exportTimetableIcs } from '@/lib/timetable/ics'
import { useMediaQuery } from '@/features/calendar/data'
import { PlannerDialog, type PlannerMode } from '@/features/calendar/PlannerDialog'
import { initialCursor, readPref, useLessons, useTimetableData, writePref } from './data'
import { WeekGrid } from './WeekGrid'
import { DayView } from './DayView'
import { AgendaList } from './AgendaList'
import { LessonSheet } from './LessonSheet'
import { LessonEditor, type EditorState } from './LessonEditor'
import { MasterData, type MasterTab } from './MasterData'
import { ImportDialog } from './ImportDialog'
import { TodaySchool } from './TodaySchool'
import type { CalItem } from '@/lib/calendar/items'
import type { CardCtx } from './LessonCard'

type View = 'week' | 'day' | 'list'
const VIEW_KEY = 'studyos.timetable.view'

export default function TimetablePage() {
  const data = useTimetableData()
  const toast = useToast()
  const today = dayKey()
  const wide = useMediaQuery('(min-width: 768px)')
  const [view, setViewState] = useState<View>(() => (readPref(VIEW_KEY, '') as View) || (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches ? 'week' : 'day'))
  const setView = (v: View) => {
    setViewState(v)
    writePref(VIEW_KEY, v)
  }
  const [cursor, setCursor] = useState<DayKey | null>(null)
  const [dir, setDir] = useState<'left' | 'right' | null>(null)
  const [open, setOpen] = useState<CalItem | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [master, setMaster] = useState<MasterTab | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [planner, setPlanner] = useState<PlannerMode | null>(null)

  const days = useMemo(() => (data.ready ? data.settings.days : [1, 2, 3, 4, 5]), [data.ready, data.settings])
  const cur = cursor ?? initialCursor(days, today)
  const week = useMemo(() => weekDays(cur, days), [cur, days])
  const range = view === 'list' ? { from: startOfWeek(cur), to: addDays(startOfWeek(cur), 13) } : { from: week[0], to: week[week.length - 1] }
  const lessons = useLessons(data, range.from, range.to)
  const ctx: CardCtx = useMemo(() => ({ subjects: data.subjectMap, tasks: data.tasks, exams: data.exams }), [data.subjectMap, data.tasks, data.exams])

  // swipe left/right on phones: next/previous day (day view) or week
  const touch = useRef<{ x: number; y: number } | null>(null)
  const step = (n: number) => {
    setDir(n > 0 ? 'right' : 'left')
    if (view === 'day') {
      const sorted = [...days].sort()
      let d = cur
      for (let i = 0; i < 7; i++) {
        d = addDays(d, n)
        if (sorted.includes(weekday(d))) break
      }
      setCursor(d)
    } else setCursor(addDays(cur, n * 7))
  }

  if (!data.ready) return <LoadingBlock />
  const { settings, subjects } = data
  const hasLessons = data.events.length > 0
  const wt = weekTypeOf(cur, settings.weekAMonday)
  const weekLabel = `${parseDay(week[0]).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${parseDay(week[week.length - 1]).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const undo = { label: 'Rückgängig', onClick: () => void undoLast() }

  const add = (day: DayKey, slot: { start: string; end: string; period: number | null }) =>
    setEditor({ occurrence: day, initial: { weekday: weekday(day) || 1, start: slot.start, end: slot.end, period: slot.period, periodEnd: slot.period, validFrom: startOfWeek(day) } as Partial<LessonInput> })
  const addNew = () => {
    const day = view === 'day' ? cur : week.find((d) => d >= today) ?? week[0]
    const p = settings.periods[0]
    add(day, p ? { start: p.start, end: p.end, period: p.n } : { start: '08:00', end: '08:45', period: null })
  }
  const editLesson = (seriesId: ID, occurrence: DayKey) => {
    setOpen(null)
    setEditor({ seriesId, occurrence, initial: {} })
  }
  const deleteFromEditor = async (seriesId: ID, occurrence: DayKey) => {
    const ev = data.events.find((e) => e.id === seriesId)
    await deleteEvent(seriesId, ev?.recurrence && ev.date < startOfWeek(occurrence) ? { scope: 'following', occurrence: startOfWeek(occurrence) } : { scope: 'all' })
    setEditor(null)
    toast({ title: ev?.recurrence && ev.date < startOfWeek(occurrence) ? `Stunde ab KW ${isoWeek(occurrence)} gelöscht` : 'Stunde gelöscht', tone: 'success', action: undo })
  }
  const exportCsv = () => saveFile('stundenplan.csv', exportTimetableCsv(data.events, subjects), 'text/csv;charset=utf-8')
  const exportIcs = () => saveFile('stundenplan.ics', exportTimetableIcs(data.events, subjects), 'text/calendar;charset=utf-8')
  const schoolToPlanner = async () => {
    const w = await applySchoolTimesToPlanner(today)
    const n = w.filter(Boolean).length
    toast({ title: n ? `Schulzeiten für ${n} Tag${n === 1 ? '' : 'e'} an den Lernplaner übergeben` : 'Keine Stunden gefunden', description: n ? 'Der Planer legt Lernzeiten nie in deinen Unterricht – jetzt ist die Schulzeit auch in der Wochenansicht markiert.' : undefined, tone: n ? 'success' : 'neutral' })
  }

  const menu = [
    { label: 'Stammdaten (Raster, Fächer, Lehrkräfte …)', icon: Settings2, onSelect: () => setMaster('periods') },
    { label: 'Importieren (CSV / ICS)', icon: FileUp, onSelect: () => setImportOpen(true) },
    { label: 'Als CSV exportieren', icon: FileDown, onSelect: exportCsv, disabled: !hasLessons },
    { label: 'Als Kalender (ICS) exportieren', icon: Download, onSelect: exportIcs, disabled: !hasLessons },
    { label: 'Schulzeiten an den Lernplaner übergeben', icon: CalendarRange, onSelect: schoolToPlanner, disabled: !hasLessons },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={`KW ${isoWeek(cur)}${wt ? ` · ${wt}-Woche` : ''}`}
        title="Stundenplan"
        actions={<>
          <Button variant="primary" icon={Plus} onClick={addNew}>Stunde</Button>
          {hasLessons && <Button icon={Sparkles} onClick={() => setPlanner('create')}>Lernzeiten vorschlagen</Button>}
          <Menu label="Weitere Aktionen" icon={MoreHorizontal} items={menu} />
        </>}
      />

      {!hasLessons ? (
        <Setup hasPeriods={settings.periods.length > 0} onPeriods={() => setMaster('periods')} onAdd={addNew} onImport={() => setImportOpen(true)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <IconButton label={view === 'day' ? 'Vorheriger Tag' : 'Vorherige Woche'} icon={ChevronLeft} onClick={() => step(-1)} />
                <Button size="sm" onClick={() => { setDir(null); setCursor(initialCursor(days, today)) }}>Heute</Button>
                <IconButton label={view === 'day' ? 'Nächster Tag' : 'Nächste Woche'} icon={ChevronRight} onClick={() => step(1)} />
                <span className="ml-1 text-sm font-medium tabular" aria-live="polite">{view === 'day' ? parseDay(cur).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) : weekLabel}</span>
              </div>
              <Segmented<View> label="Ansicht" size="sm" value={view} onChange={setView} options={[{ value: 'week', label: 'Woche' }, { value: 'day', label: 'Tag' }, { value: 'list', label: 'Liste' }]} />
            </div>
            {view === 'day' && (
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Tag wählen">
                {week.map((d) => (
                  <button key={d} type="button" role="tab" aria-selected={d === cur} onClick={() => { setDir(d > cur ? 'right' : 'left'); setCursor(d) }}
                    className={cn('flex cursor-pointer flex-col items-center rounded-md py-1.5 text-xs transition-colors', d === cur ? 'bg-accent-solid text-accent-fg' : d === today ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg-muted hover:text-fg')}>
                    <span className="font-semibold">{parseDay(d).toLocaleDateString('de-DE', { weekday: 'short' })}</span>
                    <span className="tabular">{parseDay(d).getDate()}.</span>
                  </button>
                ))}
              </div>
            )}
            <div
              key={`${view}-${view === 'day' ? cur : week[0]}`}
              data-swipe
              className={cn(dir === 'right' ? 'tt-in-right' : dir === 'left' ? 'tt-in-left' : 'page-enter')}
              onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
              onTouchEnd={(e) => {
                const t = touch.current
                touch.current = null
                if (!t) return
                const dx = e.changedTouches[0].clientX - t.x
                const dy = e.changedTouches[0].clientY - t.y
                if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1)
              }}
            >
              {view === 'week' && <WeekGrid days={week} lessons={lessons} periods={settings.periods} ctx={ctx} today={today} compactCols={!wide} onOpen={setOpen} onAdd={add} />}
              {view === 'day' && <DayView day={cur} lessons={lessons.filter((l) => l.date === cur)} periods={settings.periods} ctx={ctx} today={today} onOpen={setOpen} onAdd={add} />}
              {view === 'list' && <AgendaList from={range.from < today && today <= range.to ? today : range.from} to={range.to} lessons={lessons} ctx={ctx} today={today} onOpen={setOpen} />}
            </div>
          </div>
          <aside className="flex flex-col gap-4">
            <TodaySchool />
            <Card className="flex flex-col gap-2 p-4 text-sm">
              <div className="font-semibold">Legende</div>
              <div className="flex items-center gap-2"><span className="tt-card tt-cancelled h-4 w-6 rounded-sm" />Entfall</div>
              <div className="flex items-center gap-2"><span className="tt-card tt-changed h-4 w-6 rounded-sm" style={{ ['--c' as string]: 'var(--s3)' }} />Vertretung / Raumänderung</div>
              <p className="text-xs text-fg-subtle">Änderungen trägst du selbst ein (Stunde antippen → „Entfall / Vertretung“). Study OS liest keine Vertretungspläne deiner Schule aus.</p>
            </Card>
          </aside>
        </div>
      )}

      {open && <LessonSheet lesson={open} ctx={ctx} settings={settings} subjects={subjects} onClose={() => setOpen(null)} onEdit={editLesson} />}
      <LessonEditor state={editor} onClose={() => setEditor(null)} settings={settings} subjects={subjects} onDelete={deleteFromEditor} />
      <MasterData open={master !== null} initialTab={master ?? 'periods'} onClose={() => setMaster(null)} settings={settings} subjects={subjects} today={week[0]} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} settings={settings} subjects={subjects} />
      <PlannerDialog mode={planner} onClose={() => setPlanner(null)} subjects={subjects} />
    </div>
  )
}

function Setup({ hasPeriods, onPeriods, onAdd, onImport }: { hasPeriods: boolean; onPeriods: () => void; onAdd: () => void; onImport: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState icon={ListTree} title="Dein Stundenplan ist noch leer" description="Trag deine Stunden einmal ein – danach wiederholen sie sich jede Woche. Study OS erfindet keine Stundenpläne: alles kommt von dir oder aus einer Datei deiner Schule." />
      <div className="grid gap-3 md:grid-cols-3">
        <SetupStep n={1} done={hasPeriods} title="Stundenraster anlegen" text="Wann beginnt die 1. Stunde, wie lang sind Stunden und Pausen? (optional)" action={<Button icon={Wand2} onClick={onPeriods}>{hasPeriods ? 'Raster ansehen' : 'Raster anlegen'}</Button>} />
        <SetupStep n={2} title="Stunden eintragen" text="Fach, Tag, Stunde, Raum und Lehrkraft – auch Doppelstunden und A/B-Wochen." action={<Button variant="primary" icon={Plus} onClick={onAdd}>Erste Stunde</Button>} />
        <SetupStep n={3} title="…oder importieren" text="CSV aus Excel oder eine ICS-Datei (z. B. Kalender-Export aus WebUntis)." action={<Button icon={Upload} onClick={onImport}>Datei importieren</Button>} />
      </div>
    </div>
  )
}

function SetupStep({ n, title, text, action, done }: { n: number; title: string; text: string; action: React.ReactNode; done?: boolean }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2"><span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-bold', done ? 'bg-success text-[var(--bg)]' : 'bg-accent-soft text-accent')}>{done ? '✓' : n}</span><span className="font-semibold">{title}</span></div>
      <p className="flex-1 text-sm text-fg-muted">{text}</p>
      <div>{action}</div>
    </Card>
  )
}
