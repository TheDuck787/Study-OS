import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Award, CheckCircle2, CircleDashed, Info, RefreshCcw, RotateCcw, Target, TrendingUp } from 'lucide-react'
import { db } from '@/db/index'
import type { Answer, QuizAttempt } from '@/db/types'
import { createAttempt, regradeAnswer } from '@/db/repo'
import { percentToGrade } from '@/lib/grading'
import { computeTopicStats, LEVEL_LABELS } from '@/lib/mastery'
import { formatDateTime } from '@/lib/dates'
import { expectedAnswerText } from '@/lib/answerCheck'
import { Badge, Button, ButtonLink, Card, cn, Notice, Ring, SectionHeader, Segmented, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { AnimatedNumber, Celebrate } from '@/components/motion'
import { TYPE_LABELS } from './QuestionView'

function givenText(a: Answer | undefined, q: QuizAttempt['questionSnapshots'][number]) {
  if (!a) return '— (nicht beantwortet)'
  if (q.type === 'mc') return q.options?.[Number(a.given)] ?? a.given
  if (q.type === 'tf') return a.given === 'true' ? 'Wahr' : 'Falsch'
  return a.given
}

export function QuizResult({ attempt, answers }: { attempt: QuizAttempt; answers: Answer[] }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [filter, setFilter] = useState<'all' | 'wrong'>('all')
  const scale = useLiveQuery(async () => (await db.gradingScales.get(attempt.gradingScaleId)) ?? null, [attempt.gradingScaleId])
  const topics = useLiveQuery(() => db.topics.bulkGet([...new Set(attempt.questionSnapshots.map((q) => q.topicId))]), [attempt.id])
  const allAnswers = useLiveQuery(() => db.answers.toArray(), [])
  const xp = useLiveQuery(() => db.xpEvents.filter((e) => e.at >= attempt.startedAt && e.at <= (attempt.finishedAt ?? '') + 'z').toArray(), [attempt.id])

  const latest = useMemo(() => {
    const m = new Map<string, Answer>()
    for (const a of [...answers].sort((x, y) => x.at.localeCompare(y.at))) m.set(a.questionId, a)
    return m
  }, [answers])
  const grade = scale ? percentToGrade(attempt.percent, scale) : null
  const wrongQs = attempt.questionSnapshots.filter((q) => !latest.get(q.id)?.correct)
  const needsSelf = attempt.mode === 'exam' ? attempt.questionSnapshots.filter((q) => q.type === 'text' && latest.get(q.id) && !latest.get(q.id)!.correct && !latest.get(q.id)!.selfAssessed) : []

  // Topic breakdown – the basis for "what next?"
  const breakdown = useMemo(() => {
    const m = new Map<string, { topicId: string; got: number; max: number }>()
    for (const q of attempt.questionSnapshots) {
      const e = m.get(q.topicId) ?? { topicId: q.topicId, got: 0, max: 0 }
      e.got += (latest.get(q.id)?.score ?? 0) * q.points
      e.max += q.points
      m.set(q.topicId, e)
    }
    return [...m.values()].sort((a, b) => a.got / a.max - b.got / b.max)
  }, [attempt, latest])
  const topicName = (id: string) => topics?.find((t) => t?.id === id)?.name ?? (id.startsWith('deck:') ? 'Vokabeln' : 'Thema')
  const weakest = breakdown.filter((b) => b.got / b.max < 0.75)

  const retryWrong = async () => {
    if (wrongQs.length === 0) return
    const id = await createAttempt({ kind: 'mistakes', mode: 'practice', title: `Fehler wiederholen: ${attempt.title}`, subjectId: attempt.subjectId, topicIds: attempt.topicIds, questions: wrongQs })
    navigate(`/quiz/${id}`)
  }
  const retryAll = async () => {
    const id = await createAttempt({ kind: attempt.kind, mode: attempt.mode, title: attempt.title, subjectId: attempt.subjectId, topicIds: attempt.topicIds, questions: attempt.questionSnapshots, timeLimitMin: attempt.timeLimitMin })
    navigate(`/quiz/${id}`)
  }
  const xpTotal = (xp ?? []).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <div className="eyebrow mb-1">{attempt.kind === 'mock' ? 'Probeklausur' : attempt.kind === 'diagnostic' ? 'Diagnosetest' : attempt.mode === 'exam' ? 'Prüfungsmodus' : 'Übung'} · {formatDateTime(attempt.finishedAt!)}</div>
        <h1 className="text-xl font-semibold sm:text-2xl">{attempt.title}</h1>
      </div>

      {/* only right after finishing (not when looking at an old result), and only for a solid result */}
      <Celebrate when={attempt.percent >= 60 && !!attempt.finishedAt && Date.now() - Date.parse(attempt.finishedAt) < 120_000} anchor="#quiz-ring" />
      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <span id="quiz-ring" className="contents" />
        <Ring value={attempt.percent / 100} size={88} stroke={7} label="Ergebnis" tone={attempt.percent >= 75 ? 'success' : attempt.percent >= 45 ? 'accent' : 'warn'}>
          <span className="text-lg">{Math.round(attempt.percent)} %</span>
        </Ring>
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-fg-subtle">Punkte</div>
            <div className="text-xl font-semibold font-display">
              {attempt.score.toLocaleString('de-DE')} / {attempt.maxScore}
            </div>
          </div>
          <div>
            <div className="text-xs text-fg-subtle">Geschätzte Note</div>
            <div className="text-xl font-semibold font-display">
              {grade ? grade.label : '–'} <span className="text-sm font-normal text-fg-muted">{grade?.name}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-fg-subtle">Lern-XP</div>
            <div className="text-xl font-semibold font-display text-accent tabular">+<AnimatedNumber value={xpTotal} duration={900} /></div>
          </div>
        </div>
      </Card>
      <p className="-mt-3 flex items-start gap-1.5 text-xs text-fg-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Die Note ist nur eine Schätzung nach dem Schlüssel „{scale?.name ?? '…'}“. Deine Lehrkraft kann anders bewerten. Echte Noten trägst du unter Fortschritt ein.
      </p>

      {needsSelf.length > 0 && (
        <Notice tone="accent" icon={Info} title={`${needsSelf.length} Freitext-Antwort${needsSelf.length === 1 ? '' : 'en'} kannst du selbst nachbewerten`}>
          Die automatische Prüfung erkennt nur Schlüsselwörter. Vergleiche unten mit der Musterlösung und bewerte ehrlich.
        </Notice>
      )}

      {breakdown.length > 1 && (
        <section aria-labelledby="by-topic">
          <SectionHeader id="by-topic" title="Ergebnis nach Thema" />
          <Card className="divide-y divide-border">
            {breakdown.map((b) => {
              const stats = allAnswers ? computeTopicStats(b.topicId, allAnswers) : null
              return (
                <div key={b.topicId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{topicName(b.topicId)}</div>
                    {stats && <div className="text-xs text-fg-subtle">Stand insgesamt: {LEVEL_LABELS[stats.level]}</div>}
                  </div>
                  <span className={cn('text-sm tabular', b.got / b.max < 0.5 ? 'text-warn' : 'text-fg-muted')}>
                    {b.got.toLocaleString('de-DE')} / {b.max}
                  </span>
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {(attempt.kind === 'mock' || attempt.kind === 'diagnostic' || weakest.length > 0) && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-md font-semibold">Nächster Schritt</h2>
              {weakest.length === 0 ? (
                <p className="mt-1 text-sm text-fg-muted">Alle Themen über 75 %. Wiederhole in ein paar Tagen kurz, damit es sitzt – oder probiere schwierigere Aufgaben.</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-fg-muted">
                    Am meisten bringt dir jetzt: <strong className="text-fg">{topicName(weakest[0].topicId)}</strong> gezielt üben
                    {weakest.length > 1 && <> – danach {weakest.slice(1, 3).map((w) => topicName(w.topicId)).join(' und ')}</>}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!weakest[0].topicId.startsWith('deck:') && (
                      <ButtonLink variant="primary" size="sm" to={`/quiz/neu?topic=${weakest[0].topicId}&preset=practice`} icon={TrendingUp}>
                        {topicName(weakest[0].topicId)} üben
                      </ButtonLink>
                    )}
                    {attempt.examId && (
                      <ButtonLink size="sm" to={`/pruefungen/${attempt.examId}`}>
                        Zum Lernplan
                      </ButtonLink>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {wrongQs.length > 0 && (
          <Button variant="primary" icon={RotateCcw} onClick={retryWrong}>
            {wrongQs.length} Fehler direkt wiederholen
          </Button>
        )}
        <Button icon={RefreshCcw} onClick={retryAll}>
          Noch einmal
        </Button>
        <ButtonLink to="/" variant="ghost">
          Zur Übersicht
        </ButtonLink>
      </div>

      <section aria-labelledby="review">
        <SectionHeader
          id="review"
          title="Alle Fragen mit Erklärung"
          action={<Segmented size="sm" label="Filter" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Alle' }, { value: 'wrong', label: `Nur Fehler (${wrongQs.length})` }]} />}
        />
        <ol className="stagger flex flex-col gap-3">
          {attempt.questionSnapshots.map((q, i) => {
            const a = latest.get(q.id)
            if (filter === 'wrong' && a?.correct) return null
            const status = !a ? 'missing' : a.correct ? 'correct' : a.score > 0 ? 'partial' : 'wrong'
            return (
              <li key={q.id}>
                <Card className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-fg-subtle tabular">{i + 1}.</span>
                    {status === 'correct' ? (
                      <Badge tone="success"><CheckCircle2 className="size-3" /> Richtig</Badge>
                    ) : status === 'partial' ? (
                      <Badge tone="warn">Teilweise ({a!.score * q.points} P.)</Badge>
                    ) : (
                      <Badge tone="warn"><CircleDashed className="size-3" /> {status === 'missing' ? 'Nicht beantwortet' : 'Noch nicht richtig'}</Badge>
                    )}
                    <Badge>{TYPE_LABELS[q.type]}</Badge>
                    {a?.selfAssessed && <Badge>Selbst bewertet</Badge>}
                  </div>
                  <Markdown className="text-sm">{q.prompt}</Markdown>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                      <dt className="text-xs text-fg-subtle">Deine Antwort</dt>
                      <dd className="mt-0.5 break-words">
                        <Markdown inline>{givenText(a, q)}</Markdown>
                      </dd>
                    </div>
                    <div className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                      <dt className="text-xs text-fg-subtle">Richtige Antwort</dt>
                      <dd className="mt-0.5 break-words">
                        <Markdown inline>{expectedAnswerText(q)}</Markdown>
                      </dd>
                    </div>
                  </dl>
                  {a && !a.correct && a.feedback && <p className="mt-2 text-sm text-fg-muted"><Markdown inline>{a.feedback}</Markdown></p>}
                  {q.explanation && (
                    <div className="mt-2 text-sm text-fg-muted">
                      <Markdown>{q.explanation}</Markdown>
                    </div>
                  )}
                  {a && q.type === 'text' && attempt.mode === 'exam' && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs text-fg-subtle">Selbst bewerten:</span>
                      {([1, 0.5, 0] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={a.selfAssessed && a.score === s ? 'soft' : 'ghost'}
                          onClick={async () => {
                            await regradeAnswer(a.id, s)
                            toast({ title: 'Bewertung gespeichert', tone: 'success' })
                          }}
                        >
                          {s === 1 ? 'Richtig' : s === 0.5 ? 'Teilweise' : 'Falsch'}
                        </Button>
                      ))}
                    </div>
                  )}
                </Card>
              </li>
            )
          })}
        </ol>
      </section>
      <p className="text-center text-sm text-fg-subtle">
        <Award className="mr-1 inline size-4" aria-hidden />
        Fehler sind Lernmaterial: Jede falsch beantwortete Frage landet unter <Link to="/fehler" className="text-accent underline">Fehler wiederholen</Link>.
      </p>
    </div>
  )
}
