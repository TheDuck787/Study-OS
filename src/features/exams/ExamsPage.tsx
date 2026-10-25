import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, CalendarPlus, GraduationCap, Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import { deleteTeacherGrade, saveTeacherGrade, ValidationError } from '@/db/repo'
import { dayKey, diffDays, formatDate, formatDayLong, relativeDay } from '@/lib/dates'
import { gradeLabelToNumber } from '@/lib/grading'
import { Badge, Button, Card, Dialog, EmptyState, Field, IconButton, Input, LoadingBlock, PageHeader, ProgressBar, SectionHeader, Select, SubjectDot, Textarea, useConfirm } from '@/components/ui'
import { useExams, useSubjects } from '@/hooks/data'
import { ExamForm } from './ExamForm'

export function ExamList({ subjectId }: { subjectId?: string }) {
  const exams = useExams()
  const subjects = useSubjects()
  const today = dayKey()
  if (!exams || !subjects) return <LoadingBlock />
  const list = exams.filter((e) => !subjectId || e.subjectId === subjectId)
  const upcoming = list.filter((e) => diffDays(today, e.date) >= 0)
  const past = list.filter((e) => diffDays(today, e.date) < 0).reverse()
  const row = (e: (typeof list)[number]) => {
    const s = subjects.find((x) => x.id === e.subjectId)
    const done = e.plan.filter((p) => p.done).length
    const d = diffDays(today, e.date)
    return (
      <Link key={e.id} to={`/pruefungen/${e.id}`} className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              {s && <SubjectDot color={s.color} />}
              {s?.name} · {e.type} · {formatDayLong(e.date)}
            </div>
            <div className="mt-0.5 font-medium group-hover:text-accent">{e.title}</div>
          </div>
          <Badge tone={d >= 0 && d <= 3 ? 'warn' : 'neutral'}>{relativeDay(e.date, today)}</Badge>
        </div>
        {e.plan.length > 0 && d >= 0 && <ProgressBar value={done / e.plan.length} label="Lernplan erledigt" showValue />}
      </Link>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {upcoming.length === 0 ? <EmptyState compact icon={CalendarClock} title="Keine anstehenden Prüfungen" description="Trag Klassenarbeiten und Tests ein, um einen Lernplan zu bekommen." /> : <div className="grid gap-2 sm:grid-cols-2">{upcoming.map(row)}</div>}
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-fg-muted">Vergangene Prüfungen ({past.length})</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">{past.map(row)}</div>
        </details>
      )}
    </div>
  )
}

export function TeacherGrades({ subjectId }: { subjectId?: string }) {
  const grades = useLiveQuery(() => (subjectId ? db.teacherGrades.where('subjectId').equals(subjectId).toArray() : db.teacherGrades.toArray()), [subjectId])
  const subjects = useSubjects()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  if (!grades || !subjects) return <LoadingBlock />
  const nums = grades.map((g) => gradeLabelToNumber(g.grade)).filter((n): n is number => n !== null)
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          Echte Noten deiner Lehrkräfte – getrennt von den geschätzten Noten aus Quizzen.{avg !== null && <> Durchschnitt: <strong className="text-fg tabular">{avg.toFixed(1).replace('.', ',')}</strong> (einfacher Mittelwert, ohne Gewichtung).</>}
        </p>
        <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Note eintragen</Button>
      </div>
      {grades.length === 0 ? (
        <EmptyState compact icon={GraduationCap} title="Noch keine Noten eingetragen" />
      ) : (
        <Card className="divide-y divide-border">
          {grades.sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 font-display font-semibold">{g.grade}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{g.title}</div>
                <div className="text-xs text-fg-subtle">{subjects.find((s) => s.id === g.subjectId)?.name} · {formatDate(g.date)}{g.note ? ` · ${g.note}` : ''}</div>
              </div>
              <IconButton label="Note löschen" icon={Trash2} size="sm" onClick={async () => { if (await confirm({ title: 'Note löschen?' })) await deleteTeacherGrade(g.id) }} />
            </div>
          ))}
        </Card>
      )}
      <GradeDialog open={open} onClose={() => setOpen(false)} subjectId={subjectId} />
    </div>
  )
}

export function GradeDialog({ open, onClose, subjectId, examId, title: presetTitle }: { open: boolean; onClose: () => void; subjectId?: string; examId?: string; title?: string }) {
  const subjects = useSubjects()
  const [sid, setSid] = useState('')
  const [title, setTitle] = useState('')
  const [grade, setGrade] = useState('')
  const [date, setDate] = useState(dayKey())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setSid(subjectId ?? subjects?.[0]?.id ?? '')
      setTitle(presetTitle ?? '')
      setGrade('')
      setNote('')
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const save = async () => {
    try {
      await saveTeacherGrade({ subjectId: sid, examId: examId ?? null, title, grade, date, note })
      onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Echte Note eintragen" footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save}>Speichern</Button></>}>
      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        {!subjectId && (
          <Field label="Fach" htmlFor="gr-subject">
            <Select id="gr-subject" value={sid} onChange={(e) => setSid(e.target.value)}>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Wofür?" htmlFor="gr-title">
          <Input id="gr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Klassenarbeit Nr. 2" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Note" htmlFor="gr-grade" hint="1 bis 6, z. B. 2- oder 3+">
            <Input id="gr-grade" value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={4} />
          </Field>
          <Field label="Datum" htmlFor="gr-date">
            <Input id="gr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Notiz" htmlFor="gr-note" optional>
          <Textarea id="gr-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </div>
    </Dialog>
  )
}

export default function ExamsPage() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(params.get('neu') === '1')
  const subjects = useSubjects()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Prüfungen"
        title="Prüfungen und Lernpläne"
        description="Trag Termin, Themen und deine verfügbare Zeit ein. Study OS teilt den Stoff in Einheiten auf: Diagnose, Lernen, Üben, Probeklausur, Fehleranalyse, Abschluss."
        actions={<Button variant="primary" icon={CalendarPlus} onClick={() => setOpen(true)} disabled={!subjects?.length}>Prüfung eintragen</Button>}
      />
      <ExamList />
      <section>
        <SectionHeader title="Echte Noten" />
        <TeacherGrades />
      </section>
      <ExamForm open={open} onClose={() => { setOpen(false); if (params.get('neu')) setParams({}) }} />
    </div>
  )
}
