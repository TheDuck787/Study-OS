import { useEffect, useId, useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import type { DayKey, Subject, TimetablePeriod, TimetableSettings } from '@/db/types'
import { replaceLessonText, saveTimetableSettings, setWeekAMonday } from '@/db/timetable'
import { createSubject, updateSubject, ValidationError } from '@/db/repo'
import { Button, cn, Dialog, Field, IconButton, Input, Notice, Segmented, Switch, Tabs, useToast } from '@/components/ui'
import { SUBJECT_COLOR_COUNT, subjectColorVar } from '@/lib/colors'
import { uid } from '@/lib/id'
import { startOfWeek, addDays } from '@/lib/dates'
import { generatePeriods, isoWeek, subjectShort, validatePeriods, weekTypeOf } from '@/lib/timetable/core'

export type MasterTab = 'periods' | 'subjects' | 'teachers' | 'rooms' | 'weeks'

/** Stammdaten: bell schedule, subjects (code + colour), teachers, rooms, A/B weeks and school days. */
export function MasterData({ open, initialTab = 'periods', onClose, settings, subjects, today }: { open: boolean; initialTab?: MasterTab; onClose: () => void; settings: TimetableSettings; subjects: Subject[]; today: DayKey }) {
  const [tab, setTab] = useState<MasterTab>(initialTab)
  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])
  return (
    <Dialog open={open} onClose={onClose} title="Stammdaten" description="Alles, was dein Stundenplan braucht – nur von dir eingetragen." size="lg">
      <div className="flex flex-col gap-4">
        <Tabs<MasterTab> label="Stammdaten" value={tab} onChange={setTab} tabs={[{ id: 'periods', label: 'Stundenraster' }, { id: 'subjects', label: 'Fächer' }, { id: 'teachers', label: 'Lehrkräfte' }, { id: 'rooms', label: 'Räume' }, { id: 'weeks', label: 'Wochen & Tage' }]} />
        {tab === 'periods' && <PeriodsTab settings={settings} />}
        {tab === 'subjects' && <SubjectsTab subjects={subjects} />}
        {tab === 'teachers' && <TeachersTab settings={settings} />}
        {tab === 'rooms' && <RoomsTab settings={settings} />}
        {tab === 'weeks' && <WeeksTab settings={settings} today={today} />}
      </div>
    </Dialog>
  )
}

function useSaver() {
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      toast({ title: ok, tone: 'success' })
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }
  return { error, busy, save }
}

function PeriodsTab({ settings }: { settings: TimetableSettings }) {
  const uidBase = useId()
  const [rows, setRows] = useState<TimetablePeriod[]>(settings.periods)
  const [gen, setGen] = useState({ firstStart: '', minutes: 45, count: 8, gap: 5, bigAfter: '2, 4', bigMinutes: 20 })
  const { error, busy, save } = useSaver()
  const problem = validatePeriods(rows)
  const make = () => {
    if (!gen.firstStart) return
    const breaks: Record<number, number> = {}
    for (const n of gen.bigAfter.split(/[,; ]+/).map(Number).filter((n) => n > 0)) breaks[n] = gen.bigMinutes
    setRows(generatePeriods({ firstStart: gen.firstStart, minutes: gen.minutes, count: Math.min(20, Math.max(1, gen.count)), gap: gen.gap, breaks }))
  }
  const update = (i: number, patch: Partial<TimetablePeriod>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="flex flex-col gap-4">
      <details className="rounded-lg border border-border px-3.5 py-3" open={rows.length === 0}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><Wand2 className="size-4 text-accent" aria-hidden />Raster aus deinen Schulzeiten erzeugen</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="1. Stunde beginnt" htmlFor={`${uidBase}-g1`}><Input id={`${uidBase}-g1`} type="time" value={gen.firstStart} onChange={(e) => setGen({ ...gen, firstStart: e.target.value })} /></Field>
          <Field label="Länge (Min.)" htmlFor={`${uidBase}-g2`}><Input id={`${uidBase}-g2`} type="number" min={20} max={120} value={gen.minutes} onChange={(e) => setGen({ ...gen, minutes: Number(e.target.value) })} /></Field>
          <Field label="Stunden pro Tag" htmlFor={`${uidBase}-g3`}><Input id={`${uidBase}-g3`} type="number" min={1} max={20} value={gen.count} onChange={(e) => setGen({ ...gen, count: Number(e.target.value) })} /></Field>
          <Field label="Kleine Pause (Min.)" htmlFor={`${uidBase}-g4`}><Input id={`${uidBase}-g4`} type="number" min={0} max={60} value={gen.gap} onChange={(e) => setGen({ ...gen, gap: Number(e.target.value) })} /></Field>
          <Field label="Große Pause nach Stunde" htmlFor={`${uidBase}-g5`} hint="z. B. 2, 4"><Input id={`${uidBase}-g5`} value={gen.bigAfter} onChange={(e) => setGen({ ...gen, bigAfter: e.target.value })} /></Field>
          <Field label="Große Pause (Min.)" htmlFor={`${uidBase}-g6`}><Input id={`${uidBase}-g6`} type="number" min={0} max={90} value={gen.bigMinutes} onChange={(e) => setGen({ ...gen, bigMinutes: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-3 flex justify-end"><Button icon={Wand2} onClick={make} disabled={!gen.firstStart}>Raster erzeugen</Button></div>
        <p className="mt-2 text-xs text-fg-subtle">Trag die Zeiten deiner Schule ein (stehen meist im Schulplaner oder auf der Schul-Website). Danach kannst du jede Stunde einzeln anpassen.</p>
      </details>
      {rows.length > 0 ? (
        <ul className="stagger flex flex-col gap-2" aria-label="Stunden">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[3.5rem_1fr_1fr_auto] items-center gap-2">
              <Input type="number" min={0} max={20} value={r.n} onChange={(e) => update(i, { n: Number(e.target.value) })} aria-label="Nummer der Stunde" />
              <Input type="time" value={r.start} onChange={(e) => update(i, { start: e.target.value })} aria-label={`Beginn ${r.n}. Stunde`} />
              <Input type="time" value={r.end} onChange={(e) => update(i, { end: e.target.value })} aria-label={`Ende ${r.n}. Stunde`} />
              <IconButton label={`${r.n}. Stunde entfernen`} icon={Trash2} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-fg-muted">Noch kein Stundenraster. Ohne Raster trägst du Stunden einfach mit Uhrzeit ein.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button icon={Plus} onClick={() => { const last = rows[rows.length - 1]; setRows([...rows, { n: (last?.n ?? 0) + 1, start: last?.end ?? '08:00', end: last?.end ? addMinutes(last.end, 45) : '08:45' }]) }}>Stunde hinzufügen</Button>
        <Button variant="primary" loading={busy} disabled={!!problem && rows.length > 0} onClick={() => save(() => saveTimetableSettings({ ...settings, periods: rows }), 'Stundenraster gespeichert')}>Raster speichern</Button>
      </div>
      {rows.length > 0 && problem && <Notice tone="warn">{problem}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

const addMinutes = (t: string, m: number) => {
  const [h, mm] = t.split(':').map(Number)
  const total = Math.min(23 * 60 + 59, h * 60 + mm + m)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function SubjectsTab({ subjects }: { subjects: Subject[] }) {
  const [name, setName] = useState('')
  const { error, busy, save } = useSaver()
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {subjects.map((s) => <SubjectRow key={s.id} subject={s} onSave={save} />)}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void save(async () => { await createSubject(name); setName('') }, 'Fach angelegt') }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Neues Fach, z. B. Informatik" aria-label="Neues Fach" maxLength={60} />
        <Button type="submit" icon={Plus} loading={busy} disabled={!name.trim()}>Anlegen</Button>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

function SubjectRow({ subject: s, onSave }: { subject: Subject; onSave: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [name, setName] = useState(s.name)
  const [short, setShort] = useState(s.short ?? '')
  useEffect(() => {
    setName(s.name)
    setShort(s.short ?? '')
  }, [s.name, s.short])
  const dirty = name !== s.name || short !== (s.short ?? '')
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Fachname" maxLength={60} />
        <Input value={short} onChange={(e) => setShort(e.target.value)} aria-label={`Kürzel für ${s.name}`} placeholder={subjectShort({ name: s.name })} maxLength={8} />
        <Button disabled={!dirty} onClick={() => onSave(() => updateSubject(s.id, { name, short: short.trim() || null }), 'Fach gespeichert')}>Speichern</Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Farbe für ${s.name}`}>
        {Array.from({ length: SUBJECT_COLOR_COUNT }, (_, c) => (
          <button key={c} type="button" role="radio" aria-checked={s.color === c} aria-label={`Farbe ${c + 1}`} onClick={() => onSave(() => updateSubject(s.id, { color: c }), 'Farbe geändert')}
            className={cn('size-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110', s.color === c ? 'border-fg' : 'border-transparent')} style={{ background: subjectColorVar(c) }} />
        ))}
      </div>
    </li>
  )
}

function TeachersTab({ settings }: { settings: TimetableSettings }) {
  const [rows, setRows] = useState(settings.teachers)
  const { error, busy, save } = useSaver()
  const persist = () => save(async () => {
    // a changed code is changed in every lesson too
    for (const r of rows) {
      const old = settings.teachers.find((t) => t.id === r.id)
      if (old && old.short !== r.short && r.short.trim()) await replaceLessonText('teacher', old.short, r.short)
    }
    await saveTimetableSettings({ ...settings, teachers: rows.filter((r) => r.short.trim()) })
  }, 'Lehrkräfte gespeichert')
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && <p className="text-sm text-fg-muted">Lehrkräfte werden automatisch gemerkt, wenn du sie bei einer Stunde einträgst. Hier kannst du Kürzel und Namen pflegen.</p>}
      <ul className="stagger flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[6rem_1fr_auto] gap-2">
            <Input value={r.short} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, short: e.target.value } : x)))} aria-label="Kürzel" placeholder="Kürzel" maxLength={12} />
            <Input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Name zu ${r.short}`} placeholder="Name (optional)" maxLength={80} />
            <IconButton label={`${r.short || 'Lehrkraft'} entfernen`} icon={Trash2} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        <Button icon={Plus} onClick={() => setRows([...rows, { id: uid('tch'), short: '', name: '' }])}>Lehrkraft</Button>
        <Button variant="primary" loading={busy} onClick={persist}>Speichern</Button>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

function RoomsTab({ settings }: { settings: TimetableSettings }) {
  const [rows, setRows] = useState(settings.rooms)
  const { error, busy, save } = useSaver()
  const persist = () => save(async () => {
    for (const r of rows) {
      const old = settings.rooms.find((x) => x.id === r.id)
      if (old && old.name !== r.name && r.name.trim()) await replaceLessonText('location', old.name, r.name)
    }
    await saveTimetableSettings({ ...settings, rooms: rows.filter((r) => r.name.trim()) })
  }, 'Räume gespeichert')
  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && <p className="text-sm text-fg-muted">Räume werden automatisch gemerkt, wenn du sie bei einer Stunde einträgst.</p>}
      <ul className="stagger flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[1fr_auto] gap-2">
            <Input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Raum" maxLength={40} />
            <IconButton label={`Raum ${r.name} entfernen`} icon={Trash2} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-2">
        <Button icon={Plus} onClick={() => setRows([...rows, { id: uid('room'), name: '' }])}>Raum</Button>
        <Button variant="primary" loading={busy} onClick={persist}>Speichern</Button>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

function WeeksTab({ settings, today }: { settings: TimetableSettings; today: DayKey }) {
  const { error, save } = useSaver()
  const current = weekTypeOf(today, settings.weekAMonday)
  const setAB = (type: 'A' | 'B' | null) => save(() => setWeekAMonday(type === null ? null : type === 'A' ? startOfWeek(today) : addDays(startOfWeek(today), -7)), type ? `KW ${isoWeek(today)} ist jetzt eine ${type}-Woche` : 'A/B-Wochen ausgeschaltet')
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-medium">Samstagsunterricht</div><div className="text-xs text-fg-subtle">Zeigt den Samstag im Stundenplan.</div></div>
        <Switch label="Samstagsunterricht" checked={settings.days.includes(6)} onChange={(v) => save(() => saveTimetableSettings({ ...settings, days: v ? [...settings.days, 6] : settings.days.filter((d) => d !== 6) }), v ? 'Samstag eingeblendet' : 'Samstag ausgeblendet')} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium">A/B-Wochen</div>
        <p className="text-xs text-fg-subtle">Wenn manche Stunden nur jede zweite Woche stattfinden. Sag Study OS einmal, welche Woche gerade ist – danach geht es automatisch weiter.</p>
        <Segmented<'off' | 'A' | 'B'> label={`Die angezeigte Woche (KW ${isoWeek(today)}) ist`} value={current ?? 'off'} onChange={(v) => setAB(v === 'off' ? null : v)} options={[{ value: 'off', label: 'Keine A/B-Wochen' }, { value: 'A', label: `KW ${isoWeek(today)} = A-Woche` }, { value: 'B', label: `KW ${isoWeek(today)} = B-Woche` }]} />
        {current && <p className="text-xs text-fg-muted">Nächste Woche (KW {isoWeek(addDays(today, 7))}) ist dann eine {current === 'A' ? 'B' : 'A'}-Woche.</p>}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
