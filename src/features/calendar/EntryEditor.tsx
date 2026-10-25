import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '@/db/index'
import type { CalendarEvent, ChecklistItem, DayKey, EventCategory, ExamType, Priority, Recurrence, TaskKind } from '@/db/types'
import { saveExam, ValidationError } from '@/db/repo'
import { emptyEvent, emptyTask, saveEvent, saveOccurrence, savePlanSession, saveTask, updateExamSchedule, type SeriesScope } from '@/db/calendar'
import { regeneratePlan } from '@/features/exams/plan'
import { Button, Checkbox, cn, Dialog, Field, Input, Notice, Segmented, Select, Switch, Tabs, Textarea } from '@/components/ui'
import { addDays, WEEKDAYS_SHORT, weekday } from '@/lib/dates'
import type { CalItem } from '@/lib/calendar/items'
import { EDITOR_KINDS, EVENT_CATEGORIES, KIND_META, PRIORITY_META, REMINDER_OPTIONS, type ItemKind } from '@/lib/calendar/meta'
import { describeRecurrence } from '@/lib/calendar/recurrence'
import { fromMin, isTime, toMin } from '@/lib/calendar/time'
import { uid } from '@/lib/id'
import { useScopeAsk } from './ScopeDialog'

export type EditorTarget =
  | { mode: 'create'; kind?: ItemKind; date: DayKey; start?: string; end?: string; allDay?: boolean; subjectId?: string | null; examId?: string | null }
  | { mode: 'edit'; item: CalItem }

type Tab = 'general' | 'time' | 'details' | 'learn' | 'checklist'

interface Form {
  kind: ItemKind
  title: string
  subjectId: string
  customCategoryId: string
  priority: Priority
  status: 'planned' | 'done' | 'cancelled'
  date: DayKey
  endDate: DayKey
  allDay: boolean
  start: string
  end: string
  recurrence: Recurrence | null
  description: string
  location: string
  teacher: string
  topicIds: string[]
  materialIds: string[]
  deckId: string
  examId: string
  workload: string
  estimate: string
  dueTime: string
  reminder: number | null
  checklist: ChecklistItem[]
  blocksStudy: boolean
  examType: ExamType
  difficulty: 1 | 2 | 3
  minutesPerDay: number
  weekdays: number[]
  confidence: Record<string, number>
  prepMinutes: string
  /** plan session length */
  minutes: number
}

const isEventKind = (k: ItemKind): k is EventCategory => (EVENT_CATEGORIES as string[]).includes(k)
const isTaskKind = (k: ItemKind): k is TaskKind => k === 'homework' || k === 'project' || k === 'todo'
const EXAM_TYPES: ExamType[] = ['Klassenarbeit', 'Test', 'Vokabeltest', 'Präsentation', 'Sonstiges']
const DEFAULT_TITLES: Partial<Record<ItemKind, string>> = { flashcards: 'Karteikarten wiederholen', break: 'Pause' }

function blankForm(t: Extract<EditorTarget, { mode: 'create' }>): Form {
  const kind = t.kind ?? 'appointment'
  const start = t.start ?? '15:00'
  return {
    kind, title: DEFAULT_TITLES[kind] ?? '', subjectId: t.subjectId ?? '', customCategoryId: '', priority: 'medium', status: 'planned', date: t.date, endDate: t.date,
    allDay: t.allDay ?? false, start, end: t.end ?? fromMin(Math.min(toMin(start) + (kind === 'lesson' ? 45 : 60), 24 * 60 - 1)), recurrence: null, description: '', location: '', teacher: '',
    topicIds: [], materialIds: [], deckId: '', examId: t.examId ?? '', workload: '', estimate: '', dueTime: '', reminder: null, checklist: [], blocksStudy: kind === 'internship',
    examType: 'Klassenarbeit', difficulty: 2, minutesPerDay: 30, weekdays: [1, 2, 3, 4, 5, 6], confidence: {}, prepMinutes: '', minutes: 30,
  }
}

async function loadForm(item: CalItem): Promise<Form> {
  const base = blankForm({ mode: 'create', date: item.date })
  if (item.source === 'event') {
    const e = (await db.events.get(item.refId))!
    return {
      ...base, kind: e.category, title: e.title, subjectId: e.subjectId ?? '', customCategoryId: e.customCategoryId ?? '', priority: e.priority,
      status: e.recurrence ? (e.completedDates.includes(item.date) ? 'done' : 'planned') : e.status, date: item.date, endDate: item.endDate, allDay: e.allDay,
      start: e.start ?? '15:00', end: e.end ?? '16:00', recurrence: e.recurrence, description: e.description, location: e.location, teacher: e.teacher,
      topicIds: e.topicIds, materialIds: e.materialIds, deckId: e.deckId ?? '', examId: e.examId ?? '', workload: e.workloadMinutes ? String(e.workloadMinutes) : '',
      reminder: e.reminderMinutes, checklist: e.checklist, blocksStudy: e.blocksStudy,
    }
  }
  if (item.source === 'task') {
    const t = (await db.tasks.get(item.refId))!
    return {
      ...base, kind: t.kind, title: t.title, subjectId: t.subjectId ?? '', priority: t.priority, status: t.status === 'done' ? 'done' : 'planned', date: t.dueDate ?? '',
      dueTime: t.dueTime ?? '', description: t.description, topicIds: t.topicIds, materialIds: t.materialId ? [t.materialId] : [], estimate: t.estimateMinutes ? String(t.estimateMinutes) : '',
      reminder: t.reminderMinutes, checklist: t.subtasks,
    }
  }
  const x = (await db.exams.get(item.refId))!
  if (item.source === 'plan') {
    const s = x.plan.find((p) => p.id === item.sessionId)!
    return { ...base, kind: 'study', title: s.title, subjectId: x.subjectId, date: s.date, allDay: !s.start, start: s.start ?? '15:00', end: fromMin(toMin(s.start ?? '15:00') + s.minutes), description: s.description, topicIds: s.topicIds, examId: x.id, minutes: s.minutes, status: s.done ? 'done' : 'planned' }
  }
  return {
    ...base, kind: 'exam', title: x.title, subjectId: x.subjectId, date: x.date, allDay: !x.startTime, start: x.startTime ?? '08:00', end: x.endTime ?? '09:30', description: x.notes,
    location: x.location ?? '', topicIds: x.topicIds, materialIds: x.materialIds, examType: x.type, difficulty: x.difficulty, minutesPerDay: x.minutesPerDay, weekdays: x.availableWeekdays,
    confidence: x.topicConfidence ?? {}, prepMinutes: x.estimatedPrepMinutes ? String(x.estimatedPrepMinutes) : '',
  }
}

const num = (s: string) => (s.trim() === '' ? null : Math.round(Number(s.replace(',', '.'))))

export function EntryEditor({ target, onClose, onSaved }: { target: EditorTarget | null; onClose: () => void; onSaved?: (msg: string) => void }) {
  const [form, setForm] = useState<Form | null>(null)
  const [tab, setTab] = useState<Tab>('general')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [scopeEl, askScope] = useScopeAsk()
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
  const categories = useLiveQuery(() => db.eventCategories.toArray(), [])
  const topics = useLiveQuery(() => (form?.subjectId ? db.topics.where('subjectId').equals(form.subjectId).sortBy('order') : db.topics.limit(0).toArray()), [form?.subjectId])
  const materials = useLiveQuery(() => (form?.subjectId ? db.materials.where('subjectId').equals(form.subjectId).toArray() : db.materials.limit(0).toArray()), [form?.subjectId])
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const exams = useLiveQuery(() => db.exams.orderBy('date').toArray(), [])
  const editing = target?.mode === 'edit' ? target.item : null
  const series = useLiveQuery(async () => (editing?.source === 'event' && editing.recurring ? ((await db.events.get(editing.refId)) ?? null) : null), [editing?.refId])

  useEffect(() => {
    setError(null)
    setTab('general')
    if (!target) return setForm(null)
    if (target.mode === 'create') setForm(blankForm(target))
    else loadForm(target.item).then(setForm, (e) => setError(String(e)))
  }, [target])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const kind = form?.kind ?? 'appointment'
  const tabs = useMemo(() => {
    const t: { id: Tab; label: string; count?: number }[] = [{ id: 'general', label: 'Allgemein' }, { id: 'time', label: kind === 'exam' ? 'Termin' : isTaskKind(kind) ? 'Frist & Aufwand' : 'Zeit' }, { id: 'details', label: 'Details' }]
    if (['exam', 'study', 'flashcards', 'homework', 'project', 'lesson'].includes(kind) && form?.subjectId) t.push({ id: 'learn', label: kind === 'exam' ? 'Themen & Vorbereitung' : 'Lernen' })
    if (kind !== 'exam' && kind !== 'lesson' && kind !== 'break' && editing?.source !== 'plan') t.push({ id: 'checklist', label: isTaskKind(kind) ? 'Teilaufgaben' : 'Checkliste', count: form?.checklist.length || undefined })
    return t
  }, [kind, form?.subjectId, form?.checklist.length, editing?.source])

  if (!target) return null
  // Which kinds may be picked: creating → all; editing → only within the same store.
  const pickable: ItemKind[] = !editing ? EDITOR_KINDS : editing.source === 'event' ? EVENT_CATEGORIES : editing.source === 'task' ? ['homework', 'project', 'todo'] : [editing.kind]

  const save = async () => {
    if (!form) return
    setBusy(true)
    setError(null)
    try {
      const subjectId = form.subjectId || null
      if (form.kind === 'exam') {
        if (!subjectId) throw new ValidationError('Eine Prüfung braucht ein Fach.')
        const prev = editing ? await db.exams.get(editing.refId) : undefined
        const id = await saveExam({
          id: prev?.id, subjectId, title: form.title, type: form.examType, date: form.date, topicIds: form.topicIds, materialIds: form.materialIds, difficulty: form.difficulty,
          minutesPerDay: form.minutesPerDay, availableWeekdays: form.weekdays, notes: form.description, gradingScaleId: prev?.gradingScaleId ?? null,
        })
        if (!form.allDay && (!isTime(form.start) || !isTime(form.end))) throw new ValidationError('Bitte gib Start- und Endzeit an oder wähle „ganztägig“.')
        await updateExamSchedule(id, {
          startTime: form.allDay ? null : form.start, endTime: form.allDay ? null : form.end, location: form.location.trim(),
          topicConfidence: Object.fromEntries(Object.entries(form.confidence).filter(([t]) => form.topicIds.includes(t))), estimatedPrepMinutes: num(form.prepMinutes),
        })
        const saved = (await db.exams.get(id))!
        if (!prev || saved.plan.length === 0 || prev.date !== saved.date || prev.topicIds.join() !== saved.topicIds.join()) await regeneratePlan(saved)
        onSaved?.(prev ? 'Prüfung gespeichert' : 'Prüfung eingetragen – Lernplan erstellt')
      } else if (isTaskKind(form.kind)) {
        const prev = editing ? await db.tasks.get(editing.refId) : undefined
        await saveTask({
          ...(prev ?? emptyTask()), id: prev?.id, title: form.title, kind: form.kind, subjectId, topicIds: form.topicIds, materialId: form.materialIds[0] ?? null, dueDate: form.date || null,
          dueTime: form.dueTime || null, priority: form.priority, estimateMinutes: num(form.estimate), status: form.status === 'done' ? 'done' : 'open', subtasks: form.checklist,
          reminderMinutes: form.reminder, description: form.description,
        })
        onSaved?.(prev ? 'Aufgabe gespeichert' : 'Aufgabe angelegt')
      } else if (editing?.source === 'plan') {
        await savePlanSession(editing.refId, editing.sessionId!, { date: form.date, start: form.allDay ? null : form.start, minutes: form.allDay ? form.minutes : toMin(form.end) - toMin(form.start), title: form.title, description: form.description })
        onSaved?.('Lerneinheit gespeichert')
      } else if (isEventKind(form.kind)) {
        const prev = editing?.source === 'event' ? await db.events.get(editing.refId) : undefined
        const input = {
          ...(prev ?? emptyEvent(form.date)), title: form.title, category: form.kind, customCategoryId: form.kind === 'custom' ? form.customCategoryId || null : null, subjectId,
          date: form.date, endDate: form.allDay && form.endDate > form.date ? form.endDate : null, allDay: form.allDay, start: form.allDay ? null : form.start, end: form.allDay ? null : form.end,
          priority: form.priority, status: form.recurrence ? 'planned' : form.status, description: form.description, location: form.location, teacher: form.teacher,
          topicIds: form.topicIds, materialIds: form.materialIds, deckId: form.deckId || null, examId: form.examId || null, workloadMinutes: num(form.workload),
          reminderMinutes: form.reminder, checklist: form.checklist, recurrence: form.recurrence, blocksStudy: form.allDay && form.blocksStudy,
        } satisfies Partial<CalendarEvent>
        if (prev?.recurrence && editing) {
          const scope: SeriesScope | null = await askScope('Wiederkehrenden Eintrag speichern')
          if (!scope) return
          await saveOccurrence(prev.id, editing.date, input, scope)
        } else await saveEvent({ ...input, id: prev?.id })
        onSaved?.(prev ? 'Eintrag gespeichert' : 'Eintrag erstellt')
      }
      onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const titleText = editing ? `${KIND_META[editing.kind].label} bearbeiten` : 'Neuer Eintrag'
  return (
    <>
      <Dialog
        open={!!target}
        onClose={onClose}
        size="lg"
        title={titleText}
        description={series?.recurrence ? `Wiederholt sich: ${describeRecurrence(series.recurrence, series.date)}` : undefined}
        footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save} loading={busy} disabled={!form}>Speichern</Button></>}
      >
        {!form ? (
          <div className="h-40 animate-pulse rounded-lg bg-surface-2" />
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            {error && <Notice tone="danger">{error}</Notice>}
            {pickable.length > 1 && (
              <div role="radiogroup" aria-label="Art des Eintrags" className="flex flex-wrap gap-1.5">
                {pickable.map((k) => {
                  const M = KIND_META[k]
                  const on = form.kind === k
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setForm({ ...form, kind: k, title: form.title || DEFAULT_TITLES[k] || '', blocksStudy: k === 'internship' ? true : form.blocksStudy, end: k === 'lesson' && !editing ? fromMin(Math.min(toMin(form.start) + 45, 1439)) : form.end })}
                      className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors', on ? 'border-transparent bg-[var(--c)] text-[var(--bg)]' : 'border-border text-fg-muted hover:border-border-strong hover:text-fg')}
                      style={{ ['--c' as string]: M.color }}
                    >
                      <M.icon className="size-3.5" aria-hidden />
                      {M.label}
                    </button>
                  )
                })}
              </div>
            )}
            <Tabs label="Bereiche" tabs={tabs} value={tabs.some((t) => t.id === tab) ? tab : 'general'} onChange={setTab} />

            {tab === 'general' && (
              <div className="flex flex-col gap-4">
                <Field label="Titel" htmlFor="ed-title">
                  <Input id="ed-title" autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder={kind === 'homework' ? 'z. B. Mathe S. 42 Nr. 3–5' : kind === 'exam' ? 'z. B. Klassenarbeit Pythagoras' : kind === 'lesson' ? 'z. B. Mathematik' : 'Titel'} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fach" htmlFor="ed-subject" optional={kind !== 'exam'}>
                    <Select id="ed-subject" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value, topicIds: [], materialIds: [], title: !form.title && kind === 'lesson' ? (subjects?.find((s) => s.id === e.target.value)?.name ?? '') : form.title })}>
                      <option value="">{kind === 'exam' ? 'Bitte wählen' : 'Ohne Fach'}</option>
                      {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </Field>
                  {kind === 'custom' ? (
                    <Field label="Eigener Typ" htmlFor="ed-cat" hint={categories?.length ? undefined : 'Lege eigene Typen in der Kalender-Seitenleiste an.'}>
                      <Select id="ed-cat" value={form.customCategoryId} onChange={(e) => set('customCategoryId', e.target.value)}>
                        <option value="">Bitte wählen</option>
                        {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                    </Field>
                  ) : kind === 'exam' ? (
                    <Field label="Art der Prüfung" htmlFor="ed-etype">
                      <Select id="ed-etype" value={form.examType} onChange={(e) => set('examType', e.target.value as ExamType)}>{EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
                    </Field>
                  ) : (
                    <Field label="Priorität" htmlFor="ed-prio">
                      <Segmented label="Priorität" size="sm" value={form.priority} onChange={(v) => set('priority', v)} options={(['low', 'medium', 'high'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
                    </Field>
                  )}
                </div>
                {kind === 'exam' && (
                  <Field label="Wie schwer schätzt du die Prüfung ein?" htmlFor="ed-diff">
                    <Segmented label="Schwierigkeit" value={form.difficulty} onChange={(v) => set('difficulty', v)} options={[{ value: 1, label: 'Eher leicht' }, { value: 2, label: 'Mittel' }, { value: 3, label: 'Schwer' }]} />
                  </Field>
                )}
                {kind !== 'exam' && kind !== 'lesson' && (editing || isTaskKind(kind)) && !form.recurrence && (
                  <Field label="Status" htmlFor="ed-status">
                    <Segmented label="Status" size="sm" value={form.status} onChange={(v) => set('status', v)} options={isTaskKind(kind) || editing?.source === 'plan' ? [{ value: 'planned', label: 'Offen' }, { value: 'done', label: 'Erledigt' }] : [{ value: 'planned', label: 'Geplant' }, { value: 'done', label: 'Erledigt' }, { value: 'cancelled', label: 'Abgesagt' }]} />
                  </Field>
                )}
                {editing?.source === 'plan' && <Notice tone="neutral">Diese Lerneinheit gehört zum Lernplan einer Prüfung. Wenn du sie änderst, lässt der Planer sie künftig an ihrem Platz.</Notice>}
              </div>
            )}

            {tab === 'time' && (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={isTaskKind(kind) ? 'Fällig am' : kind === 'exam' ? 'Datum der Prüfung' : 'Datum'} htmlFor="ed-date" optional={isTaskKind(kind)}>
                    <Input id="ed-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })} />
                  </Field>
                  {isTaskKind(kind) ? (
                    <Field label="Uhrzeit" htmlFor="ed-duetime" optional hint="z. B. Beginn der Stunde, in der abgegeben wird">
                      <Input id="ed-duetime" type="time" value={form.dueTime} onChange={(e) => set('dueTime', e.target.value)} />
                    </Field>
                  ) : (
                    <div className="flex items-end pb-2"><Switch label="Ganztägig" checked={form.allDay} onChange={(v) => set('allDay', v)} /></div>
                  )}
                </div>
                {!isTaskKind(kind) && !form.allDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Beginn" htmlFor="ed-start">
                      <Input id="ed-start" type="time" value={form.start} onChange={(e) => {
                        const d = toMin(form.end) - toMin(form.start)
                        setForm({ ...form, start: e.target.value, end: isTime(e.target.value) ? fromMin(Math.min(toMin(e.target.value) + Math.max(15, d), 1439)) : form.end })
                      }} />
                    </Field>
                    <Field label="Ende" htmlFor="ed-end"><Input id="ed-end" type="time" value={form.end} onChange={(e) => set('end', e.target.value)} /></Field>
                  </div>
                )}
                {editing?.source === 'plan' && form.allDay && (
                  <Field label="Dauer (Minuten)" htmlFor="ed-min"><Input id="ed-min" type="number" min={5} max={600} step={5} value={form.minutes} onChange={(e) => set('minutes', Number(e.target.value))} /></Field>
                )}
                {isEventKind(kind) && form.allDay && editing?.source !== 'plan' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Bis einschließlich" htmlFor="ed-enddate" optional hint="Für mehrtägige Einträge, z. B. Praktikum">
                      <Input id="ed-enddate" type="date" min={form.date} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
                    </Field>
                    <div className="flex items-end pb-2"><Switch label="An diesen Tagen nicht lernen" checked={form.blocksStudy} onChange={(v) => set('blocksStudy', v)} /></div>
                  </div>
                )}
                {isTaskKind(kind) && (
                  <Field label="Geschätzter Aufwand (Minuten)" htmlFor="ed-est" optional hint="Der Planer verteilt so viel Arbeitszeit vor die Frist.">
                    <Input id="ed-est" type="number" min={5} max={6000} step={5} value={form.estimate} onChange={(e) => set('estimate', e.target.value)} placeholder={kind === 'project' ? '120' : '30'} />
                  </Field>
                )}
                {isEventKind(kind) && form.allDay && kind !== 'internship' && editing?.source !== 'plan' && (
                  <Field label="Aufwand (Minuten)" htmlFor="ed-work" optional><Input id="ed-work" type="number" min={1} max={1440} value={form.workload} onChange={(e) => set('workload', e.target.value)} /></Field>
                )}
                {isEventKind(kind) && editing?.source !== 'plan' && <RecurrenceFields value={form.recurrence} date={form.date} onChange={(r) => set('recurrence', r)} />}
                {kind !== 'exam' && editing?.source !== 'plan' && (
                  <Field label="Erinnerung" htmlFor="ed-rem" hint="Erscheint, solange Study OS geöffnet ist (mit Benachrichtigung, wenn erlaubt).">
                    <Select id="ed-rem" value={form.reminder === null ? '' : String(form.reminder)} onChange={(e) => set('reminder', e.target.value === '' ? null : Number(e.target.value))}>
                      {REMINDER_OPTIONS.map((o) => <option key={String(o.value)} value={o.value === null ? '' : o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                )}
              </div>
            )}

            {tab === 'details' && (
              <div className="flex flex-col gap-4">
                {!isTaskKind(kind) && editing?.source !== 'plan' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={kind === 'lesson' || kind === 'exam' ? 'Raum' : 'Ort'} htmlFor="ed-loc" optional><Input id="ed-loc" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder={kind === 'lesson' ? 'z. B. A 2.14' : ''} /></Field>
                    {(kind === 'lesson' || kind === 'study' || kind === 'appointment') && (
                      <Field label={kind === 'appointment' ? 'Mit wem' : 'Lehrkraft'} htmlFor="ed-teacher" optional><Input id="ed-teacher" value={form.teacher} onChange={(e) => set('teacher', e.target.value)} maxLength={120} /></Field>
                    )}
                  </div>
                )}
                <Field label={kind === 'exam' ? 'Notizen (z. B. Hilfsmittel)' : 'Beschreibung & Notizen'} htmlFor="ed-desc" optional>
                  <Textarea id="ed-desc" rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
                </Field>
              </div>
            )}

            {tab === 'learn' && (
              <div className="flex flex-col gap-4">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">{kind === 'exam' ? 'Welche Themen kommen dran?' : 'Themen'}</legend>
                  {topics && topics.length > 0 ? (
                    <div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
                      {topics.map((t) => {
                        const on = form.topicIds.includes(t.id)
                        return (
                          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1">
                            <Checkbox checked={on} onChange={(v) => set('topicIds', v ? [...form.topicIds, t.id] : form.topicIds.filter((x) => x !== t.id))} label={t.name} />
                            {kind === 'exam' && on && (
                              <div className="flex items-center gap-1" role="radiogroup" aria-label={`Wie sicher fühlst du dich bei ${t.name}?`}>
                                <span className="mr-1 text-xs text-fg-subtle">Gefühl</span>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button key={n} type="button" role="radio" aria-checked={form.confidence[t.id] === n} title={['', 'sehr unsicher', 'unsicher', 'geht so', 'sicher', 'sehr sicher'][n]} onClick={() => set('confidence', { ...form.confidence, [t.id]: n })}
                                    className={cn('size-7 cursor-pointer rounded-md border text-xs tabular', form.confidence[t.id] === n ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-border text-fg-muted hover:border-border-strong')}>{n}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-fg-muted">Dieses Fach hat noch keine Themen. Lege sie unter „Fächer“ an.</p>
                  )}
                  {kind === 'exam' && <p className="mt-1.5 text-xs text-fg-subtle">Dein Gefühl wird neben dem gemessenen Stand angezeigt – der Fortschritt berechnet sich nur aus deinen echten Antworten.</p>}
                </fieldset>
                {materials && materials.length > 0 && (
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">Lernmaterial <span className="font-normal text-fg-subtle">(optional)</span></legend>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      {materials.map((m) => <Checkbox key={m.id} checked={form.materialIds.includes(m.id)} onChange={(v) => set('materialIds', v ? (isTaskKind(kind) ? [m.id] : [...form.materialIds, m.id]) : form.materialIds.filter((x) => x !== m.id))} label={m.title} />)}
                    </div>
                  </fieldset>
                )}
                {kind === 'flashcards' && (
                  <Field label="Kartenstapel" htmlFor="ed-deck" optional>
                    <Select id="ed-deck" value={form.deckId} onChange={(e) => set('deckId', e.target.value)}>
                      <option value="">Alle fälligen Karten</option>
                      {decks?.filter((d) => !form.subjectId || d.subjectId === form.subjectId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  </Field>
                )}
                {kind === 'study' && editing?.source !== 'plan' && (
                  <Field label="Gehört zur Prüfung" htmlFor="ed-exam" optional hint="Zählt dann zur Vorbereitung dieser Prüfung.">
                    <Select id="ed-exam" value={form.examId} onChange={(e) => set('examId', e.target.value)}>
                      <option value="">Keine</option>
                      {exams?.filter((x) => x.date >= form.date && (!form.subjectId || x.subjectId === form.subjectId)).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                    </Select>
                  </Field>
                )}
                {kind === 'exam' && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Geschätzte Vorbereitungszeit gesamt (Min.)" htmlFor="ed-prep" optional><Input id="ed-prep" type="number" min={0} max={6000} step={15} value={form.prepMinutes} onChange={(e) => set('prepMinutes', e.target.value)} /></Field>
                      <Field label="Höchstens pro Tag (Min.)" htmlFor="ed-mpd"><Input id="ed-mpd" type="number" min={10} max={240} step={5} value={form.minutesPerDay} onChange={(e) => set('minutesPerDay', Number(e.target.value))} /></Field>
                    </div>
                    <fieldset>
                      <legend className="mb-1.5 text-sm font-medium">An welchen Tagen kannst du lernen?</legend>
                      <WeekdayPicker value={form.weekdays} onChange={(v) => set('weekdays', v)} />
                    </fieldset>
                  </>
                )}
              </div>
            )}

            {tab === 'checklist' && <ChecklistEditor items={form.checklist} onChange={(c) => set('checklist', c)} label={isTaskKind(kind) ? 'Teilaufgabe' : 'Punkt'} />}
            <button type="submit" hidden />
          </form>
        )}
      </Dialog>
      {scopeEl}
    </>
  )
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
        <button key={d} type="button" aria-pressed={value.includes(d)} onClick={() => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d])}
          className={cn('h-9 w-11 cursor-pointer rounded-md border text-sm font-medium', value.includes(d) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>
          {WEEKDAYS_SHORT[d]}
        </button>
      ))}
    </div>
  )
}

function RecurrenceFields({ value, date, onChange }: { value: Recurrence | null; date: DayKey; onChange: (r: Recurrence | null) => void }) {
  const freq = value?.freq ?? 'none'
  const endMode = !value ? 'never' : value.until ? 'until' : value.count ? 'count' : 'never'
  const base: Recurrence = value ?? { freq: 'weekly', interval: 1, byWeekday: [weekday(date)], until: null, count: null, exceptions: [] }
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Wiederholung</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select aria-label="Wiederholung" value={freq} onChange={(e) => onChange(e.target.value === 'none' ? null : { ...base, freq: e.target.value as Recurrence['freq'], byWeekday: e.target.value === 'weekly' ? (base.byWeekday.length ? base.byWeekday : [weekday(date)]) : [] })}>
          <option value="none">Einmalig</option>
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
        </Select>
        {value && (
          <label className="flex items-center gap-2 text-sm text-fg-muted">
            alle
            <Input type="number" min={1} max={52} value={value.interval} onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })} className="w-20" aria-label="Abstand" />
            {value.freq === 'daily' ? 'Tage' : value.freq === 'weekly' ? 'Wochen' : 'Monate'}
          </label>
        )}
      </div>
      {value?.freq === 'weekly' && <WeekdayPicker value={value.byWeekday} onChange={(v) => onChange({ ...value, byWeekday: v })} />}
      {value && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Segmented label="Ende der Wiederholung" size="sm" value={endMode} onChange={(m) => onChange({ ...value, until: m === 'until' ? (value.until ?? addDays(date, 90)) : null, count: m === 'count' ? (value.count ?? 10) : null })}
            options={[{ value: 'never', label: 'Kein Ende' }, { value: 'until', label: 'Bis' }, { value: 'count', label: 'Anzahl' }]} />
          {endMode === 'until' && <Input type="date" aria-label="Wiederholen bis" min={date} value={value.until ?? ''} onChange={(e) => onChange({ ...value, until: e.target.value || null })} className="w-44" />}
          {endMode === 'count' && <Input type="number" aria-label="Anzahl der Termine" min={1} max={500} value={value.count ?? 10} onChange={(e) => onChange({ ...value, count: Math.max(1, Number(e.target.value) || 1) })} className="w-24" />}
        </div>
      )}
      {value && <p className="text-xs text-fg-subtle">{describeRecurrence(value, date)}</p>}
    </fieldset>
  )
}

export function ChecklistEditor({ items, onChange, label }: { items: ChecklistItem[]; onChange: (c: ChecklistItem[]) => void; label: string }) {
  const [text, setText] = useState('')
  const add = () => {
    if (!text.trim()) return
    onChange([...items, { id: uid('chk'), text: text.trim(), done: false }])
    setText('')
  }
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && <p className="text-sm text-fg-muted">Noch keine Einträge. Teile größere Aufgaben in kleine Schritte.</p>}
      {items.map((c, idx) => (
        <div key={c.id} className="flex items-center gap-2">
          <Checkbox checked={c.done} onChange={(v) => onChange(items.map((x) => (x.id === c.id ? { ...x, done: v } : x)))} label={<span className="sr-only">{c.text} erledigt</span>} />
          <Input value={c.text} aria-label={`${label} ${idx + 1}`} onChange={(e) => onChange(items.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} className={cn(c.done && 'text-fg-muted line-through')} />
          <button type="button" aria-label={`${label} entfernen`} onClick={() => onChange(items.filter((x) => x.id !== c.id))} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-danger"><X className="size-4" /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Neue ${label} …`} aria-label={`Neue ${label}`} onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }} />
        <Button icon={Plus} onClick={add} disabled={!text.trim()}>Hinzufügen</Button>
      </div>
    </div>
  )
}

