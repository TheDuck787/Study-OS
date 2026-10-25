import { useEffect, useId, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { DayKey, ID, Subject, TimetableSettings, WeekType } from '@/db/types'
import { createLesson, emptyLesson, lessonToInput, updateLesson, type LessonInput, type LessonScope } from '@/db/timetable'
import { createSubject, ValidationError } from '@/db/repo'
import { db } from '@/db/index'
import { Button, Dialog, Field, Input, LoadingBlock, Notice, Segmented, Select, Textarea, useToast } from '@/components/ui'
import { isoWeek, matchPeriods, periodTimes, weekTypeOf } from '@/lib/timetable/core'
import { startOfWeek, WEEKDAYS_LONG, WEEKDAYS_SHORT } from '@/lib/dates'
import { undoLast } from '@/lib/undo'

export interface EditorState {
  /** Series being edited (undefined = new lesson). */
  seriesId?: ID
  /** Day of the occurrence the student tapped (for "ab dieser Woche"). */
  occurrence: DayKey
  initial: Partial<LessonInput>
}

const NEW_SUBJECT = '__new__'

export function LessonEditor({ state, onClose, settings, subjects, onDelete }: { state: EditorState | null; onClose: () => void; settings: TimetableSettings; subjects: Subject[]; onDelete?: (seriesId: ID, occurrence: DayKey) => void }) {
  const toast = useToast()
  const uidBase = useId()
  const [f, setF] = useState<LessonInput>(emptyLesson())
  const [newSubject, setNewSubject] = useState('')
  const [customTime, setCustomTime] = useState(false)
  const [scope, setScope] = useState<LessonScope>('all')
  const [startedBefore, setStartedBefore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The form is shown only once the lesson is loaded – otherwise fast typing could be overwritten. */
  const [loadedFor, setLoadedFor] = useState<EditorState | null>(null)
  const hasPeriods = settings.periods.length > 0

  useEffect(() => {
    if (!state) return
    setError(null)
    setNewSubject('')
    let cancelled = false
    ;(async () => {
      const ev = state.seriesId ? await db.events.get(state.seriesId) : undefined
      const base = ev ? lessonToInput(ev) : emptyLesson({ validFrom: startOfWeek(state.occurrence), subjectId: subjects[0]?.id ?? null })
      const next = { ...base, ...state.initial }
      if (cancelled) return
      setF(next)
      setCustomTime(!hasPeriods || (next.period == null && !matchPeriods(settings.periods, next.start, next.end)))
      setStartedBefore(!!ev?.recurrence && ev.date < startOfWeek(state.occurrence))
      setScope('all')
      setLoadedFor(state)
    })()
    return () => {
      cancelled = true
    }
    // only when another lesson is opened – live updates of subjects/settings must not reset what the student typed
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof LessonInput>(k: K, v: LessonInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const setPeriods = (from: number, to: number) => {
    const t = periodTimes(settings.periods, from, Math.max(from, to))
    if (t) setF((x) => ({ ...x, period: from, periodEnd: Math.max(from, to), start: t.start, end: t.end }))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      let subjectId = f.subjectId
      if (subjectId === NEW_SUBJECT) {
        if (!newSubject.trim()) throw new ValidationError('Bitte gib einen Namen für das neue Fach ein.')
        subjectId = await createSubject(newSubject)
      }
      const m = customTime ? matchPeriods(settings.periods, f.start, f.end) : null
      const input: LessonInput = { ...f, subjectId, ...(customTime ? { period: m?.period ?? null, periodEnd: m?.periodEnd ?? null } : {}) }
      if (state?.seriesId) await updateLesson(state.seriesId, input, scope, state.occurrence)
      else await createLesson(input)
      toast({ title: state?.seriesId ? 'Stunde gespeichert' : 'Stunde eingetragen', tone: 'success', action: { label: 'Rückgängig', onClick: () => void undoLast() } })
      onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  const days = [...settings.days].sort()
  const id = (s: string) => `${uidBase}-${s}`
  const thisWeek = state ? weekTypeOf(state.occurrence, settings.weekAMonday) : null

  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={state?.seriesId ? 'Stunde bearbeiten' : 'Stunde eintragen'}
      description={state?.seriesId ? undefined : 'Die Stunde wiederholt sich jede Woche (oder in jeder A- bzw. B-Woche).'}
      size="md"
      footer={
        <>
          {state?.seriesId && onDelete && <Button variant="danger" icon={Trash2} onClick={() => onDelete(state.seriesId!, state.occurrence)} className="mr-auto">Löschen</Button>}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={loadedFor !== state}>Speichern</Button>
        </>
      }
    >
      {loadedFor !== state ? <LoadingBlock /> : <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Fach" htmlFor={id('subject')}>
          <Select id={id('subject')} value={f.subjectId ?? ''} onChange={(e) => set('subjectId', e.target.value || null)}>
            <option value="">– ohne Fach –</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value={NEW_SUBJECT}>+ Neues Fach …</option>
          </Select>
        </Field>
        {f.subjectId === NEW_SUBJECT && (
          <Field label="Name des neuen Fachs" htmlFor={id('newsub')}>
            <Input id={id('newsub')} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="z. B. Informatik" autoFocus maxLength={60} />
          </Field>
        )}
        <Field label="Tag">
          <Segmented label="Wochentag" value={f.weekday} onChange={(v) => set('weekday', v)} options={days.map((d) => ({ value: d, label: WEEKDAYS_SHORT[d], title: WEEKDAYS_LONG[d] }))} />
        </Field>
        {hasPeriods && !customTime ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Von Stunde" htmlFor={id('pfrom')}>
              <Select id={id('pfrom')} value={f.period ?? ''} onChange={(e) => setPeriods(Number(e.target.value), Math.max(Number(e.target.value), f.periodEnd ?? 0))}>
                <option value="" disabled>wählen</option>
                {settings.periods.map((p) => <option key={p.n} value={p.n}>{p.n}. ({p.start})</option>)}
              </Select>
            </Field>
            <Field label="Bis Stunde" htmlFor={id('pto')}>
              <Select id={id('pto')} value={f.periodEnd ?? f.period ?? ''} onChange={(e) => setPeriods(f.period ?? Number(e.target.value), Number(e.target.value))}>
                {settings.periods.filter((p) => p.n >= (f.period ?? 0)).map((p) => <option key={p.n} value={p.n}>{p.n}. (bis {p.end})</option>)}
              </Select>
            </Field>
            <p className="col-span-2 -mt-2 text-xs text-fg-subtle">{f.start}–{f.end} Uhr · <button type="button" className="cursor-pointer text-accent underline" onClick={() => setCustomTime(true)}>eigene Uhrzeit</button></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Beginn" htmlFor={id('start')}><Input id={id('start')} type="time" value={f.start} onChange={(e) => set('start', e.target.value)} required /></Field>
            <Field label="Ende" htmlFor={id('end')}><Input id={id('end')} type="time" value={f.end} onChange={(e) => set('end', e.target.value)} required /></Field>
            {hasPeriods && <p className="col-span-2 -mt-2 text-xs text-fg-subtle"><button type="button" className="cursor-pointer text-accent underline" onClick={() => { setCustomTime(false); setPeriods(f.period ?? settings.periods[0].n, f.periodEnd ?? f.period ?? settings.periods[0].n) }}>Stunden aus dem Raster wählen</button></p>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lehrkraft" htmlFor={id('teacher')} optional>
            <Input id={id('teacher')} list={id('teachers')} value={f.teacher} onChange={(e) => set('teacher', e.target.value)} placeholder="Kürzel" maxLength={120} autoComplete="off" />
            <datalist id={id('teachers')}>{settings.teachers.map((t) => <option key={t.id} value={t.short}>{t.name}</option>)}</datalist>
          </Field>
          <Field label="Raum" htmlFor={id('room')} optional>
            <Input id={id('room')} list={id('rooms')} value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="z. B. 104" maxLength={120} autoComplete="off" />
            <datalist id={id('rooms')}>{settings.rooms.map((r) => <option key={r.id} value={r.name} />)}</datalist>
          </Field>
        </div>
        <Field label="Woche" hint={settings.weekAMonday ? `Diese Woche (KW ${state ? isoWeek(state.occurrence) : ''}) ist eine ${thisWeek}-Woche.` : 'A/B-Wochen kannst du unter „Stammdaten → Wochen & Tage“ einrichten.'}>
          <Segmented<'all' | WeekType> label="Woche" value={f.weekType ?? 'all'} onChange={(v) => set('weekType', v === 'all' ? null : v)} options={[{ value: 'all', label: 'Jede Woche' }, ...(settings.weekAMonday || f.weekType ? [{ value: 'A' as const, label: 'A-Woche' }, { value: 'B' as const, label: 'B-Woche' }] : [])]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gültig ab" htmlFor={id('from')}><Input id={id('from')} type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} disabled={scope === 'following'} /></Field>
          <Field label="Gültig bis" htmlFor={id('until')} optional><Input id={id('until')} type="date" value={f.validUntil ?? ''} min={f.validFrom} onChange={(e) => set('validUntil', e.target.value || null)} /></Field>
        </div>
        <Field label="Notiz" htmlFor={id('note')} optional>
          <Textarea id={id('note')} value={f.note} onChange={(e) => set('note', e.target.value)} className="min-h-16" maxLength={5000} placeholder="z. B. Sportzeug mitbringen" />
        </Field>
        {state?.seriesId && startedBefore && (
          <Field label="Änderung gilt für">
            <Segmented<LessonScope> label="Änderung gilt für" value={scope} onChange={setScope} options={[{ value: 'all', label: 'Alle Wochen' }, { value: 'following', label: `Ab dieser Woche (KW ${isoWeek(state.occurrence)})` }]} />
          </Field>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>}
    </Dialog>
  )
}
