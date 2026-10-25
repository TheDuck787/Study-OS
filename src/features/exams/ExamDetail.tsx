import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Check, GraduationCap, MessagesSquare, MoreHorizontal, Pencil, Play, RefreshCcw, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import type { PlanSession } from '@/db/types'
import { deleteExam, markPlanSession } from '@/db/repo'
import { dayKey, diffDays, formatDayLong, formatDayShort, formatMinutes, relativeDay } from '@/lib/dates'
import { computeTopicStats, LEVEL_LABELS } from '@/lib/mastery'
import { SESSION_LABELS } from '@/lib/studyplan'
import { percentToGrade, BUILTIN_SCALES } from '@/lib/grading'
import { Badge, Button, ButtonLink, Card, cn, EmptyState, LoadingBlock, Menu, Notice, PageHeader, ProgressBar, SectionHeader, SubjectDot, useConfirm, useToast } from '@/components/ui'
import { ExamForm } from './ExamForm'
import { GradeDialog } from './ExamsPage'
import { regeneratePlan, sessionHref } from './plan'
import { PrepPanel } from './PrepPanel'

export default function ExamDetail() {
  const { examId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const exam = useLiveQuery(async () => (await db.exams.get(examId ?? '')) ?? null, [examId])
  const subject = useLiveQuery(() => (exam ? db.subjects.get(exam.subjectId) : undefined), [exam?.subjectId])
  const topics = useLiveQuery(() => (exam ? db.topics.bulkGet(exam.topicIds) : []), [exam?.topicIds.join(',')])
  const answers = useLiveQuery(() => db.answers.toArray(), [])
  const attempts = useLiveQuery(() => db.attempts.where('examId').equals(examId ?? '').toArray(), [examId])
  const grades = useLiveQuery(() => db.teacherGrades.filter((g) => g.examId === examId).toArray(), [examId])
  const [editing, setEditing] = useState(false)
  const [gradeOpen, setGradeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const autoPlanned = useRef(false)
  const today = dayKey()

  // Coming from onboarding: build the first plan once
  useEffect(() => {
    if (exam && params.get('neu') === 'plan' && exam.plan.length === 0 && !autoPlanned.current) {
      autoPlanned.current = true
      regeneratePlan(exam)
    }
  }, [exam, params])

  const byDay = useMemo(() => {
    const m = new Map<string, PlanSession[]>()
    for (const s of exam?.plan ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [exam])

  if (exam === undefined || !answers || !attempts) return <LoadingBlock />
  if (!exam) return <Notice tone="warn" title="Prüfung nicht gefunden" />
  const d = diffDays(today, exam.date)
  const done = exam.plan.filter((p) => p.done).length
  const openPast = exam.plan.filter((p) => !p.done && p.date < today).length
  const mocks = attempts.filter((a) => a.finishedAt && (a.kind === 'mock' || a.kind === 'diagnostic')).sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const replan = async () => {
    setBusy(true)
    const r = await regeneratePlan(exam)
    setBusy(false)
    toast({ title: 'Lernplan aktualisiert', description: `${r.sessions.filter((s) => !s.done).length} offene Einheiten auf Basis deines aktuellen Stands.`, tone: 'success' })
  }
  const remove = async () => {
    if (await confirm({ title: `„${exam.title}“ löschen?`, message: 'Der Lernplan wird mitgelöscht. Quiz-Ergebnisse bleiben erhalten.' })) {
      await deleteExam(exam.id)
      navigate('/pruefungen')
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link to="/pruefungen" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Prüfungen
      </Link>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-2">{subject && <SubjectDot color={subject.color} />}{subject?.name} · {exam.type}</span>}
        title={exam.title}
        description={`${formatDayLong(exam.date)}${exam.startTime ? `, ${exam.startTime}${exam.endTime ? `–${exam.endTime}` : ''} Uhr` : ''}${exam.location ? ` · Raum ${exam.location}` : ''} – ${relativeDay(exam.date, today)}.${exam.notes ? ` ${exam.notes}` : ''}`}
        actions={
          <>
            <Button icon={RefreshCcw} onClick={replan} loading={busy} disabled={d <= 0}>Plan neu berechnen</Button>
            <Menu label="Weitere Aktionen" icon={MoreHorizontal} items={[{ label: 'Bearbeiten', icon: Pencil, onSelect: () => setEditing(true) }, { label: 'Echte Note eintragen', icon: GraduationCap, onSelect: () => setGradeOpen(true) }, { label: 'Löschen', icon: Trash2, danger: true, onSelect: remove }]} />
          </>
        }
      />

      {d < 0 && (
        <Notice tone="accent" icon={GraduationCap} title="Die Prüfung ist vorbei">
          {grades && grades.length > 0 ? <>Eingetragene Note: <strong>{grades.map((g) => g.grade).join(', ')}</strong>.</> : <>Wie lief es? Trag die echte Note ein, sobald du sie hast. <Button size="sm" variant="ghost" onClick={() => setGradeOpen(true)}>Note eintragen</Button></>}
        </Notice>
      )}

      <PrepPanel exam={exam} />

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="plan">
          <SectionHeader id="plan" title="Lernplan" description={exam.plan.length ? `${done} von ${exam.plan.length} Einheiten erledigt · ${formatMinutes(exam.plan.filter((p) => !p.done).reduce((s, p) => s + p.minutes, 0))} offen` : undefined} />
          {exam.plan.length > 0 && <ProgressBar className="mb-4" value={done / exam.plan.length} label="Lernplan erledigt" showValue />}
          {exam.planWarnings.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {exam.planWarnings.map((w, i) => <Notice key={i} tone="warn" icon={AlertTriangle}>{w}</Notice>)}
            </div>
          )}
          {openPast > 0 && d > 0 && (
            <Notice tone="neutral" className="mb-4" title={`${openPast} Einheit${openPast === 1 ? '' : 'en'} aus den letzten Tagen offen`}>
              Kein Problem. Mit „Plan neu berechnen“ wird der Rest auf die verbleibenden Tage verteilt.
            </Notice>
          )}
          {exam.plan.length === 0 ? (
            <EmptyState title="Noch kein Plan" description={d > 0 ? 'Berechne einen Lernplan auf Basis deiner verfügbaren Zeit.' : 'Für vergangene Prüfungen wird kein Plan erstellt.'} action={d > 0 && <Button variant="primary" icon={RefreshCcw} onClick={replan} loading={busy}>Lernplan erstellen</Button>} />
          ) : (
            <ol className="flex flex-col gap-5">
              {byDay.map(([date, sessions]) => (
                <li key={date}>
                  <div className={cn('mb-2 flex items-baseline gap-2 text-sm', date === today ? 'font-semibold text-accent' : 'text-fg-muted')}>
                    <span>{formatDayShort(date)}</span>
                    <span className="text-xs text-fg-subtle">{relativeDay(date, today)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {sessions.map((s) => (
                      <Card key={s.id} className={cn('flex items-start gap-3 p-3.5', s.done && 'opacity-70')}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={s.done}
                          aria-label={`${s.title} als erledigt markieren`}
                          onClick={() => markPlanSession(exam.id, s.id, !s.done)}
                          className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border cursor-pointer', s.done ? 'border-success bg-success text-white' : 'border-border-strong')}
                        >
                          {s.done && <Check className="size-3.5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={s.type === 'mock' ? 'accent' : s.type === 'final' ? 'success' : 'neutral'}>{SESSION_LABELS[s.type]}</Badge>
                            <span className={cn('font-medium', s.done && 'line-through')}>{s.title}</span>
                            <span className="text-xs text-fg-subtle tabular">{s.start ? `${s.start} · ` : ''}{s.minutes} Min.</span>
                            {s.pinned && <span className="text-xs text-fg-subtle">· von dir festgelegt</span>}
                          </div>
                          <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
                          {!s.done && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <ButtonLink size="sm" variant={s.date <= today ? 'primary' : 'secondary'} icon={Play} to={sessionHref(s, exam.id, exam.subjectId)}>Starten</ButtonLink>
                              {s.type === 'learn' && s.topicIds[0] && <ButtonLink size="sm" variant="ghost" icon={MessagesSquare} to={`/tutor?topic=${s.topicIds[0]}&subject=${exam.subjectId}`}>Mit Tutor erklären lassen</ButtonLink>}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="flex flex-col gap-8 lg:col-span-2">
          <section aria-labelledby="ready">
            <SectionHeader id="ready" title="Stand je Thema" description="Aus deinen bisherigen Antworten." />
            {(topics ?? []).filter(Boolean).length === 0 ? (
              <p className="text-sm text-fg-muted">Keine Themen ausgewählt. <button type="button" className="text-accent underline cursor-pointer" onClick={() => setEditing(true)}>Themen hinzufügen</button></p>
            ) : (
              <Card className="divide-y divide-border">
                {(topics ?? []).filter((t): t is NonNullable<typeof t> => !!t).map((t) => {
                  const s = computeTopicStats(t.id, answers)
                  return (
                    <Link key={t.id} to={`/faecher/${t.subjectId}/themen/${t.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{t.name}</span>
                        <span className="shrink-0 text-xs text-fg-subtle">{LEVEL_LABELS[s.level]}</span>
                      </div>
                      <ProgressBar className="mt-1.5" value={s.mastery} label={`Stand ${t.name}`} tone={s.level === 'struggling' ? 'warn' : s.level === 'mastered' ? 'success' : 'accent'} />
                    </Link>
                  )
                })}
              </Card>
            )}
          </section>
          <section aria-labelledby="mocks">
            <SectionHeader id="mocks" title="Diagnose & Probeklausuren" />
            {mocks.length === 0 ? (
              <p className="text-sm text-fg-muted">Noch nicht geschrieben. Die Probeklausur zeigt eine geschätzte Note – eine Garantie für die echte Note ist sie nicht.</p>
            ) : (
              <Card className="divide-y divide-border">
                {mocks.map((a) => (
                  <Link key={a.id} to={`/quiz/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <span>{a.kind === 'mock' ? 'Probeklausur' : 'Diagnose'} · {formatDayShort(a.startedAt.slice(0, 10))}</span>
                    <span className="tabular">{Math.round(a.percent)} % · Note ≈ {percentToGrade(a.percent, BUILTIN_SCALES.find((s) => s.id === a.gradingScaleId) ?? BUILTIN_SCALES[0]).label}</span>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        </aside>
      </div>
      <ExamForm open={editing} onClose={() => setEditing(false)} exam={exam} />
      <GradeDialog open={gradeOpen} onClose={() => setGradeOpen(false)} subjectId={exam.subjectId} examId={exam.id} title={exam.title} />
    </div>
  )
}
