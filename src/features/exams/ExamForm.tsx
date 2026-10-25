import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import type { Exam, ExamType } from '@/db/types'
import { saveExam, ValidationError } from '@/db/repo'
import { updateExamSchedule } from '@/db/calendar'
import { addDays, dayKey, WEEKDAYS_SHORT } from '@/lib/dates'
import { Button, Checkbox, cn, Dialog, Field, Input, Notice, Segmented, Select, Textarea } from '@/components/ui'
import { useScales, useSubjects } from '@/hooks/data'
import { regeneratePlan } from './plan'

const TYPES: ExamType[] = ['Klassenarbeit', 'Test', 'Vokabeltest', 'Präsentation', 'Sonstiges']

export function ExamForm({ open, onClose, exam, subjectId: presetSubject }: { open: boolean; onClose: () => void; exam?: Exam; subjectId?: string }) {
  const navigate = useNavigate()
  const subjects = useSubjects()
  const scales = useScales()
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ExamType>('Klassenarbeit')
  const [date, setDate] = useState('')
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2)
  const [minutes, setMinutes] = useState(30)
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [notes, setNotes] = useState('')
  const [scaleId, setScaleId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [confidence, setConfidence] = useState<Record<string, number>>({})
  const [prepMinutes, setPrepMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])
  const materials = useLiveQuery(() => (subjectId ? db.materials.where('subjectId').equals(subjectId).toArray() : db.materials.limit(0).toArray()), [subjectId])

  useEffect(() => {
    if (!open) return
    setSubjectId(exam?.subjectId ?? presetSubject ?? subjects?.[0]?.id ?? '')
    setTitle(exam?.title ?? '')
    setType(exam?.type ?? 'Klassenarbeit')
    setDate(exam?.date ?? addDays(dayKey(), 14))
    setTopicIds(exam?.topicIds ?? [])
    setMaterialIds(exam?.materialIds ?? [])
    setDifficulty(exam?.difficulty ?? 2)
    setMinutes(exam?.minutesPerDay ?? 30)
    setWeekdays(exam?.availableWeekdays ?? [1, 2, 3, 4, 5, 6])
    setNotes(exam?.notes ?? '')
    setScaleId(exam?.gradingScaleId ?? '')
    setStartTime(exam?.startTime ?? '')
    setEndTime(exam?.endTime ?? '')
    setLocation(exam?.location ?? '')
    setConfidence(exam?.topicConfidence ?? {})
    setPrepMinutes(exam?.estimatedPrepMinutes ? String(exam.estimatedPrepMinutes) : '')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // the form can open before subjects have loaded (direct link) – pick the first subject once they are there
  useEffect(() => {
    if (open && !subjectId && subjects && subjects.length > 0) setSubjectId(presetSubject ?? subjects[0].id)
  }, [open, subjectId, subjects, presetSubject])

  const save = async () => {
    setBusy(true)
    try {
      if (Boolean(startTime) !== Boolean(endTime)) throw new ValidationError('Bitte gib Beginn und Ende an – oder lass beide leer.')
      const id = await saveExam({ id: exam?.id, subjectId, title, type, date, topicIds, materialIds, difficulty, minutesPerDay: minutes, availableWeekdays: weekdays, notes, gradingScaleId: scaleId || null })
      await updateExamSchedule(id, {
        startTime: startTime || null, endTime: endTime || null, location: location.trim(), estimatedPrepMinutes: prepMinutes ? Math.round(Number(prepMinutes)) : null,
        topicConfidence: Object.fromEntries(Object.entries(confidence).filter(([t]) => topicIds.includes(t))),
      })
      const saved = await db.exams.get(id)
      if (saved && (!exam || saved.plan.length === 0)) await regeneratePlan(saved)
      onClose()
      if (!exam) navigate(`/pruefungen/${id}`)
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onClose={onClose} size="lg" title={exam ? 'Prüfung bearbeiten' : 'Prüfung eintragen'} description="Study OS erstellt daraus einen Lernplan bis zum Termin." footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save} loading={busy}>{exam ? 'Speichern' : 'Lernplan erstellen'}</Button></>}>
      <div className="flex flex-col gap-5">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fach" htmlFor="ex-subject">
            <Select id="ex-subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicIds([]); setMaterialIds([]) }}>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Art" htmlFor="ex-type">
            <Select id="ex-type" value={type} onChange={(e) => setType(e.target.value as ExamType)}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Bezeichnung" htmlFor="ex-title">
            <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Klassenarbeit Pythagoras" />
          </Field>
          <Field label="Datum" htmlFor="ex-date">
            <Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Beginn" htmlFor="ex-start" optional><Input id="ex-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
            <Field label="Ende" htmlFor="ex-end" optional><Input id="ex-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field>
          </div>
          <Field label="Raum" htmlFor="ex-room" optional><Input id="ex-room" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} /></Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Welche Themen kommen dran?</legend>
          {topics && topics.length > 0 ? (
            <div className="grid max-h-48 gap-x-4 overflow-y-auto rounded-md border border-border px-3 py-1 sm:grid-cols-2">
              {topics.map((t) => <Checkbox key={t.id} checked={topicIds.includes(t.id)} onChange={(v) => setTopicIds((ids) => (v ? [...ids, t.id] : ids.filter((x) => x !== t.id)))} label={t.name} />)}
            </div>
          ) : (
            <p className="text-sm text-fg-muted">Dieses Fach hat noch keine Themen. Ohne Themen wird der Plan allgemein.</p>
          )}
        </fieldset>
        {topicIds.length > 0 && topics && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Wie sicher fühlst du dich? <span className="font-normal text-fg-subtle">(1 = unsicher, 5 = sehr sicher – optional)</span></legend>
            <div className="flex flex-col gap-1.5">
              {topics.filter((t) => topicIds.includes(t.id)).map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="truncate">{t.name}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`Gefühl bei ${t.name}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={confidence[t.id] === n} onClick={() => setConfidence((c) => ({ ...c, [t.id]: n }))} className={cn('size-7 cursor-pointer rounded-md border text-xs tabular', confidence[t.id] === n ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-border text-fg-muted')}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}
        {materials && materials.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Lernmaterial <span className="font-normal text-fg-subtle">(optional)</span></legend>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {materials.map((m) => <Checkbox key={m.id} checked={materialIds.includes(m.id)} onChange={(v) => setMaterialIds((ids) => (v ? [...ids, m.id] : ids.filter((x) => x !== m.id)))} label={m.title} />)}
            </div>
          </fieldset>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wie schwer schätzt du die Prüfung ein?" htmlFor="ex-diff">
            <Segmented label="Schwierigkeit" value={difficulty} onChange={setDifficulty} options={[{ value: 1, label: 'Eher leicht' }, { value: 2, label: 'Mittel' }, { value: 3, label: 'Schwer' }]} />
          </Field>
          <Field label="Lernzeit pro Tag (Minuten)" htmlFor="ex-min">
            <Input id="ex-min" type="number" min={10} max={240} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </Field>
          <Field label="Geschätzte Vorbereitungszeit gesamt (Minuten)" htmlFor="ex-prep" optional>
            <Input id="ex-prep" type="number" min={0} max={6000} step={15} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">An welchen Tagen kannst du lernen?</legend>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} type="button" aria-pressed={weekdays.includes(d)} onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))} className={cn('h-9 w-11 rounded-md border text-sm font-medium cursor-pointer', weekdays.includes(d) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>
                {WEEKDAYS_SHORT[d]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notenschlüssel der Lehrkraft" htmlFor="ex-scale" optional>
            <Select id="ex-scale" value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
              <option value="">Standard aus den Einstellungen</option>
              {scales?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Notizen" htmlFor="ex-notes" optional>
            <Textarea id="ex-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="z. B. Taschenrechner erlaubt" />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}
