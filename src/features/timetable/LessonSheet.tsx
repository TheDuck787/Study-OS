import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, CalendarClock, Copy, GraduationCap, MapPin, NotebookPen, Pencil, Repeat, RotateCcw, Trash2, User } from 'lucide-react'
import type { DayKey, ExamType, ID, LessonChangeType, Subject, TimetableSettings } from '@/db/types'
import { success } from '@/lib/motion'
import { deleteEvent, setTaskDone } from '@/db/calendar'
import { addExamForLesson, addHomework, clearLessonChange, duplicateLesson, findNextLessonDate, setLessonChange } from '@/db/timetable'
import { ValidationError } from '@/db/repo'
import { Badge, Button, cn, Dialog, Field, Input, Notice, Segmented, Select, useToast } from '@/components/ui'
import type { CalItem } from '@/lib/calendar/items'
import { addDays, parseDay, WEEKDAYS_LONG, WEEKDAYS_SHORT, weekday } from '@/lib/dates'
import { CHANGE_LABELS, formatPeriods, isoWeek, periodTimes } from '@/lib/timetable/core'
import { undoLast } from '@/lib/undo'
import { examsFor, homeworkFor, lessonColor } from './data'
import type { CardCtx } from './LessonCard'

type Panel = 'homework' | 'exam' | 'change' | 'duplicate' | 'delete' | null
const EXAM_TYPES: ExamType[] = ['Klassenarbeit', 'Test', 'Vokabeltest', 'Präsentation', 'Sonstiges']

const fmtDay = (d: DayKey) => parseDay(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

export function LessonSheet({ lesson, ctx, settings, subjects, onClose, onEdit }: {
  lesson: CalItem | null; ctx: CardCtx; settings: TimetableSettings; subjects: Subject[]; onClose: () => void; onEdit: (seriesId: ID, occurrence: DayKey) => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const uidBase = useId()
  const id = (s: string) => `${uidBase}-${s}`
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // homework
  const [hw, setHw] = useState({ title: '', due: '', minutes: 30 })
  const [nextDate, setNextDate] = useState<DayKey | null>(null)
  // exam
  const [ex, setEx] = useState({ title: '', type: 'Klassenarbeit' as ExamType })
  // change
  const [ch, setCh] = useState<{ type: LessonChangeType; note: string; subjectId: string; teacher: string; location: string }>({ type: 'cancelled', note: '', subjectId: '', teacher: '', location: '' })
  // duplicate
  const [dup, setDup] = useState({ weekday: 1, period: 0, start: '', end: '' })

  useEffect(() => {
    setPanel(null)
    setError(null)
    if (!lesson) return
    setHw({ title: '', due: '', minutes: 30 })
    setNextDate(null)
    if (lesson.subjectId) findNextLessonDate(lesson.subjectId, lesson.date).then((d) => { setNextDate(d); setHw((x) => (x.due ? x : { ...x, due: d ?? addDays(lesson.date, 1) })) })
    else setHw((x) => ({ ...x, due: addDays(lesson.date, 1) }))
    const subj = lesson.subjectId ? ctx.subjects.get(lesson.subjectId)?.name : ''
    setEx({ title: subj ? `Klassenarbeit ${subj}` : 'Klassenarbeit', type: 'Klassenarbeit' })
    setCh({ type: lesson.lessonChange?.type ?? 'cancelled', note: lesson.lessonChange?.note ?? '', subjectId: lesson.subjectId ?? '', teacher: lesson.teacher, location: lesson.location })
    setDup({ weekday: Math.min(6, (weekday(lesson.date) % 7) + 1) || 1, period: lesson.period ?? 0, start: lesson.start ?? '08:00', end: lesson.end ?? '08:45' })
  }, [lesson?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson) return <Dialog open={false} onClose={onClose} title="" />
  const l = lesson
  const s = l.subjectId ? ctx.subjects.get(l.subjectId) : undefined
  const color = lessonColor(l.subjectId, ctx.subjects)
  const change = l.lessonChange
  const before = change?.before
  const homework = homeworkFor(ctx.tasks, l.subjectId, l.date)
  const exams = examsFor(ctx.exams, l.subjectId, l.date)
  /** The regular lesson this occurrence belongs to (for edit/duplicate/delete). */
  const seriesRef = l.seriesId ?? l.refId
  const occurrence = l.date

  const run = async (fn: () => Promise<unknown>, ok: string, close = true) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      toast({ title: ok, tone: 'success', action: { label: 'Rückgängig', onClick: () => void undoLast() } })
      if (close) onClose()
      else setPanel(null)
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  const saveHomework = () => run(async () => {
    if (!hw.title.trim()) throw new ValidationError('Was ist die Hausaufgabe? Bitte gib einen Titel ein.')
    await addHomework({ subjectId: l.subjectId, title: hw.title, dueDate: hw.due || null, estimateMinutes: hw.minutes, description: '' })
  }, 'Hausaufgabe eingetragen', false)

  const saveExam = () => run(async () => {
    if (!l.subjectId) throw new ValidationError('Für eine Prüfung braucht die Stunde ein Fach.')
    const examId = await addExamForLesson({ subjectId: l.subjectId, title: ex.title, type: ex.type, date: l.date, startTime: l.start, endTime: l.end, location: l.location, notes: '' })
    navigate(`/pruefungen/${examId}`)
  }, 'Prüfung eingetragen – wähle jetzt die Themen für den Lernplan')

  const saveChange = () => run(() => setLessonChange(l, {
    type: ch.type, note: ch.note,
    ...(ch.type === 'substitute' ? { subjectId: ch.subjectId || null, teacher: ch.teacher, location: ch.location } : ch.type === 'room' ? { location: ch.location } : {}),
  }), `${CHANGE_LABELS[ch.type]} gespeichert`)

  const saveDuplicate = () => run(async () => {
    const t = dup.period ? periodTimes(settings.periods, dup.period, dup.period + ((l.periodEnd ?? l.period ?? 0) - (l.period ?? 0))) : null
    await duplicateLesson(seriesRef, { weekday: dup.weekday, start: t?.start ?? dup.start, end: t?.end ?? dup.end, period: t ? dup.period : null, periodEnd: t ? dup.period + ((l.periodEnd ?? l.period ?? 0) - (l.period ?? 0)) : null })
  }, 'Stunde dupliziert')

  const remove = (scope: 'following' | 'all') => run(() => deleteEvent(seriesRef, { scope, occurrence }), scope === 'all' ? 'Stunde gelöscht' : `Stunde ab KW ${isoWeek(occurrence)} gelöscht`)

  const actions: { key: Panel | 'edit'; label: string; icon: typeof Pencil; tone?: 'danger' }[] = [
    { key: 'homework', label: 'Hausaufgabe', icon: NotebookPen },
    { key: 'exam', label: 'Prüfung', icon: GraduationCap },
    { key: 'change', label: change ? 'Änderung' : 'Entfall / Vertretung', icon: ArrowRightLeft },
    { key: 'edit', label: 'Bearbeiten', icon: Pencil },
    { key: 'duplicate', label: 'Duplizieren', icon: Copy },
    { key: 'delete', label: 'Löschen', icon: Trash2, tone: 'danger' },
  ]

  return (
    <Dialog open onClose={onClose} title={<span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: color }} aria-hidden />{s?.name ?? l.title}</span>} description={`${parseDay(l.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · ${l.start}–${l.end}${l.period != null ? ` · ${formatPeriods(l.period, l.periodEnd)}` : ''}`} size="md">
      <div className="flex flex-col gap-4" style={{ ['--c' as string]: color }}>
        {change && (
          <Notice tone={l.cancelled ? 'danger' : 'accent'} title={CHANGE_LABELS[change.type]}>
            {change.note && <div>{change.note}</div>}
            {before && (before.subjectId !== l.subjectId || before.teacher !== l.teacher || before.location !== l.location) && (
              <div className="mt-1 text-xs">Regulär: {[before.subjectId ? ctx.subjects.get(before.subjectId)?.name : null, before.teacher, before.location].filter(Boolean).join(' · ')}</div>
            )}
          </Notice>
        )}
        <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-2 text-sm">
          {l.location && (<><MapPin className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>Raum {l.location}</dd></>)}
          {l.teacher && (<><User className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>{l.teacher}{settings.teachers.find((t) => t.short === l.teacher)?.name ? ` – ${settings.teachers.find((t) => t.short === l.teacher)!.name}` : ''}</dd></>)}
          {l.recurring && (<><Repeat className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>{l.weekType ? `Jede ${l.weekType}-Woche` : 'Jede Woche'} am {WEEKDAYS_LONG[weekday(l.date)]}</dd></>)}
          {!l.recurring && (<><CalendarClock className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>Einzelne Stunde</dd></>)}
        </dl>
        {l.description && <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-muted">{l.description}</p>}

        {(homework.length > 0 || exams.length > 0) && (
          <div className="flex flex-col gap-1.5">
            {exams.map((x) => (
              <button key={x.id} type="button" onClick={() => navigate(`/pruefungen/${x.id}`)} className="flex cursor-pointer items-center gap-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-left text-sm text-danger">
                <GraduationCap className="size-4 shrink-0" aria-hidden /><span className="min-w-0 flex-1 truncate font-medium">{x.title}</span><Badge tone="danger">{x.type}</Badge>
              </button>
            ))}
            {homework.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md bg-warn-soft px-2.5 py-1.5 text-sm">
                <input type="checkbox" checked={t.status === 'done'} onChange={(e) => { if (e.target.checked) success(e.currentTarget); void setTaskDone(t.id, e.target.checked) }} className="size-4 accent-[var(--accent-solid)]" />
                <span className={cn('min-w-0 flex-1 truncate', t.status === 'done' && 'text-fg-muted line-through')}>{t.title}</span>
                <span className="text-xs text-fg-muted">Hausaufgabe</span>
              </label>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2" role="toolbar" aria-label="Aktionen">
          {actions.map((a) => (
            <button key={a.key} type="button" aria-pressed={panel === a.key} onClick={() => (a.key === 'edit' ? onEdit(seriesRef, l.date) : setPanel(panel === a.key ? null : a.key))}
              className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors', panel === a.key ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface-2 text-fg hover:border-border-strong', a.tone === 'danger' && panel !== a.key && 'text-danger')}>
              <a.icon className="size-4" aria-hidden />{a.label}
            </button>
          ))}
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        {panel === 'homework' && (
          <form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); void saveHomework() }}>
            <Field label="Hausaufgabe" htmlFor={id('hw')}><Input id={id('hw')} value={hw.title} onChange={(e) => setHw({ ...hw, title: e.target.value })} placeholder="z. B. Buch S. 42 Nr. 3" autoFocus maxLength={160} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fällig am" htmlFor={id('hwdue')} hint={nextDate ? `Nächste ${s?.name ?? ''}-Stunde: ${fmtDay(nextDate)}` : undefined}><Input id={id('hwdue')} type="date" value={hw.due} onChange={(e) => setHw({ ...hw, due: e.target.value })} /></Field>
              <Field label="Aufwand" htmlFor={id('hwmin')}>
                <Select id={id('hwmin')} value={hw.minutes} onChange={(e) => setHw({ ...hw, minutes: Number(e.target.value) })}>
                  {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} Min.</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={busy}>Hausaufgabe speichern</Button></div>
          </form>
        )}

        {panel === 'exam' && (
          <form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); void saveExam() }}>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Titel" htmlFor={id('ex')}><Input id={id('ex')} value={ex.title} onChange={(e) => setEx({ ...ex, title: e.target.value })} maxLength={120} /></Field>
              <Field label="Art" htmlFor={id('extype')}>
                <Select id={id('extype')} value={ex.type} onChange={(e) => setEx({ ...ex, type: e.target.value as ExamType })} className="w-40">
                  {EXAM_TYPES.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <p className="text-xs text-fg-muted">Am {fmtDay(l.date)} in dieser Stunde ({l.start}–{l.end}). Danach wählst du die Themen, und der Lernplaner verteilt die Vorbereitung auf deine freie Zeit.</p>
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={busy}>Prüfung eintragen</Button></div>
          </form>
        )}

        {panel === 'change' && (
          <form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); void saveChange() }}>
            <p className="text-xs text-fg-muted">Gilt nur für {fmtDay(l.date)} – die regelmäßige Stunde bleibt unverändert. Study OS kennt keine Vertretungspläne deiner Schule – trag Änderungen selbst ein.</p>
            <Segmented<LessonChangeType> label="Art der Änderung" value={ch.type} onChange={(v) => setCh({ ...ch, type: v })} size="sm" options={[{ value: 'cancelled', label: 'Entfall' }, { value: 'substitute', label: 'Vertretung' }, { value: 'room', label: 'Raum' }, { value: 'info', label: 'Hinweis' }]} />
            {ch.type === 'substitute' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Fach" htmlFor={id('chsub')}>
                  <Select id={id('chsub')} value={ch.subjectId} onChange={(e) => setCh({ ...ch, subjectId: e.target.value })}>
                    <option value="">– ohne Fach –</option>
                    {subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </Select>
                </Field>
                <Field label="Lehrkraft" htmlFor={id('chteach')}><Input id={id('chteach')} value={ch.teacher} onChange={(e) => setCh({ ...ch, teacher: e.target.value })} maxLength={120} /></Field>
                <Field label="Raum" htmlFor={id('chroom')}><Input id={id('chroom')} value={ch.location} onChange={(e) => setCh({ ...ch, location: e.target.value })} maxLength={120} /></Field>
              </div>
            )}
            {ch.type === 'room' && <Field label="Neuer Raum" htmlFor={id('chroom2')}><Input id={id('chroom2')} value={ch.location} onChange={(e) => setCh({ ...ch, location: e.target.value })} maxLength={120} /></Field>}
            <Field label="Notiz" htmlFor={id('chnote')} optional><Input id={id('chnote')} value={ch.note} onChange={(e) => setCh({ ...ch, note: e.target.value })} maxLength={500} placeholder={ch.type === 'cancelled' ? 'z. B. Aufgaben im Buch S. 40' : ''} /></Field>
            <div className="flex flex-wrap justify-end gap-2">
              {change && <Button icon={RotateCcw} onClick={() => run(() => clearLessonChange(l), 'Änderung aufgehoben')} disabled={busy}>Änderung aufheben</Button>}
              <Button type="submit" variant="primary" loading={busy}>Speichern</Button>
            </div>
          </form>
        )}

        {panel === 'duplicate' && (
          <form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={(e) => { e.preventDefault(); void saveDuplicate() }}>
            <Field label="Kopieren nach"><Segmented label="Wochentag" value={dup.weekday} onChange={(v) => setDup({ ...dup, weekday: v })} options={[...settings.days].sort().map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }))} /></Field>
            {settings.periods.length > 0 ? (
              <Field label="Ab Stunde" htmlFor={id('dupp')}>
                <Select id={id('dupp')} value={dup.period} onChange={(e) => setDup({ ...dup, period: Number(e.target.value) })}>
                  <option value={0}>eigene Uhrzeit</option>
                  {settings.periods.map((p) => <option key={p.n} value={p.n}>{p.n}. Stunde ({p.start})</option>)}
                </Select>
              </Field>
            ) : null}
            {(!settings.periods.length || dup.period === 0) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Beginn" htmlFor={id('dups')}><Input id={id('dups')} type="time" value={dup.start} onChange={(e) => setDup({ ...dup, start: e.target.value })} /></Field>
                <Field label="Ende" htmlFor={id('dupe')}><Input id={id('dupe')} type="time" value={dup.end} onChange={(e) => setDup({ ...dup, end: e.target.value })} /></Field>
              </div>
            )}
            <div className="flex justify-end"><Button type="submit" variant="primary" loading={busy}>Duplizieren</Button></div>
          </form>
        )}

        {panel === 'delete' && (
          <div className="flex flex-col gap-2 rounded-lg border border-danger/35 p-3">
            {l.recurring ? (
              <>
                <p className="text-sm text-fg-muted">Fällt die Stunde nur einmal aus? Dann nimm besser „Entfall“ – so bleibt sie im Stundenplan.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button onClick={() => remove('following')} loading={busy}>Ab dieser Woche löschen</Button>
                  <Button variant="danger" onClick={() => remove('all')} loading={busy}>In allen Wochen löschen</Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-fg-muted">Diese einzelne Stunde löschen?</span>
                <Button variant="danger" onClick={() => run(() => deleteEvent(l.refId), 'Stunde gelöscht')} loading={busy}>Löschen</Button>
              </div>
            )}
            <p className="text-xs text-fg-subtle">Direkt danach kannst du es mit „Rückgängig“ wiederherstellen.</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
