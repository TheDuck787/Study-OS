import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed, Clock, Flag, Lightbulb, ListOrdered, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { db } from '@/db/index'
import type { Question } from '@/db/types'
import { finishAttempt, recordAnswer, regradeAnswer, saveDraftAnswer, type AnswerInput as AnswerPayload } from '@/db/repo'
import { checkAnswer, type CheckResult } from '@/lib/answerCheck'
import { Badge, Button, Card, cn, LoadingBlock, Notice, ProgressBar, useConfirm, useToast } from '@/components/ui'
import { haptic } from '@/lib/motion'
import { Markdown } from '@/components/Markdown'
import { AnswerInput, QuestionPrompt, TYPE_LABELS } from './QuestionView'
import { QuizResult } from './QuizResult'
import { useAi, useProfile } from '@/hooks/data'
import { generate, AiError } from '@/lib/ai/client'

export default function QuizRunner() {
  const { attemptId } = useParams()
  const attempt = useLiveQuery(async () => (await db.attempts.get(attemptId ?? '')) ?? null, [attemptId])
  const answers = useLiveQuery(() => db.answers.where('attemptId').equals(attemptId ?? '').toArray(), [attemptId])
  if (attempt === undefined || answers === undefined) return <LoadingBlock />
  if (!attempt) return <Notice tone="warn" title="Dieses Quiz gibt es nicht (mehr).">Es wurde vielleicht gelöscht.</Notice>
  if (attempt.finishedAt) return <QuizResult attempt={attempt} answers={answers} />
  return attempt.mode === 'exam' ? <ExamRunner attemptId={attempt.id} /> : <PracticeRunner attemptId={attempt.id} />
}

function useElapsed(startIso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000))
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function RunnerHeader({ title, index, total, elapsed, limitSec, onExit }: { title: string; index: number; total: number; elapsed: number; limitSec?: number; onExit: () => void }) {
  const remaining = limitSec ? Math.max(0, limitSec - elapsed) : null
  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg cursor-pointer">
          <ArrowLeft className="size-4" /> Pausieren
        </button>
        <div className="flex items-center gap-3 text-sm text-fg-muted tabular">
          <span className="inline-flex items-center gap-1" title={remaining !== null ? 'Verbleibende Zeit' : 'Bisherige Zeit'}>
            <Clock className="size-4" aria-hidden />
            <span className={cn(remaining !== null && remaining < 120 && 'text-warn font-semibold')}>{remaining !== null ? `noch ${mmss(remaining)}` : mmss(elapsed)}</span>
          </span>
          <span>
            Frage {Math.min(index + 1, total)} von {total}
          </span>
        </div>
      </div>
      <ProgressBar value={index / total} label="Fortschritt im Quiz" />
      <h1 className="sr-only">{title}</h1>
    </div>
  )
}

// ───────────────────────── Practice mode ─────────────────────────

function PracticeRunner({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate()
  const toast = useToast()
  const ai = useAi()
  const profile = useProfile()
  const attempt = useLiveQuery(async () => (await db.attempts.get(attemptId)) ?? null, [attemptId])
  const answers = useLiveQuery(() => db.answers.where('attemptId').equals(attemptId).toArray(), [attemptId])
  const questions = attempt?.questionSnapshots ?? []
  const answeredIds = useMemo(() => new Set((answers ?? []).map((a) => a.questionId)), [answers])
  const firstOpen = questions.findIndex((q) => !answeredIds.has(q.id))
  const [index, setIndex] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [hints, setHints] = useState(0)
  const [check, setCheck] = useState<CheckResult | null>(null)
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [showSteps, setShowSteps] = useState(false)
  const [busy, setBusy] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const started = useRef(Date.now())
  const elapsed = useElapsed(attempt?.startedAt ?? new Date().toISOString())

  useEffect(() => {
    if (index === null && answers && attempt) setIndex(firstOpen === -1 ? questions.length : firstOpen)
  }, [answers, attempt, firstOpen, index, questions.length])

  const q: Question | undefined = index !== null ? questions[index] : undefined

  const reset = () => {
    setValue('')
    setHints(0)
    setCheck(null)
    setAnswerId(null)
    setShowSteps(false)
    setAiText(null)
    setInputError(null)
    started.current = Date.now()
  }

  const finish = useCallback(async () => {
    setFinishing(true)
    try {
      await finishAttempt(attemptId)
    } catch (e) {
      toast({ title: 'Konnte das Quiz nicht abschließen', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
      setFinishing(false)
    }
  }, [attemptId, toast])

  const submit = async () => {
    if (!q || check || busy) return
    const r = checkAnswer(q, value)
    if (r.status === 'unreadable') {
      setInputError(r.feedback)
      return
    }
    setInputError(null)
    setCheck(r)
    if (r.correct) haptic(10)
    if (r.status === 'self-assess') return // student judges first
    setBusy(true)
    try {
      const a = await recordAnswer(attemptId, { question: q, given: value, check: r, hintsUsed: hints, timeMs: Date.now() - started.current })
      setAnswerId(a.id)
    } finally {
      setBusy(false)
    }
  }

  const selfAssess = async (score: 0 | 0.5 | 1) => {
    if (!q || !check) return
    setBusy(true)
    try {
      if (answerId) {
        await regradeAnswer(answerId, score)
      } else {
        const a = await recordAnswer(attemptId, { question: q, given: value, check, hintsUsed: hints, timeMs: Date.now() - started.current, selfAssessed: true, selfScore: score })
        setAnswerId(a.id)
      }
      setCheck({ ...check, status: score === 1 ? 'correct' : score === 0.5 ? 'partial' : 'wrong', correct: score === 1, score, feedback: score === 1 ? 'Du hast deine Antwort als richtig bewertet.' : score === 0.5 ? 'Du hast deine Antwort als teilweise richtig bewertet.' : 'Du hast deine Antwort als falsch bewertet – gut, dass du ehrlich bist. Die Frage kommt wieder.' })
    } finally {
      setBusy(false)
    }
  }

  const next = async () => {
    if (index === null) return
    reset()
    const ni = index + 1
    if (ni >= questions.length) {
      setIndex(ni)
      await finish()
    } else setIndex(ni)
  }

  const askAiWhy = async () => {
    if (!q || !check) return
    setAiBusy(true)
    try {
      const { result } = await generate({ task: 'explain-mistake', question: q.prompt, correctAnswer: check.expected, studentAnswer: q.type === 'mc' ? q.options?.[Number(value)] ?? value : q.type === 'tf' ? (value === 'true' ? 'Wahr' : 'Falsch') : value, grade: profile?.grade ?? 9, mode: profile?.explanationMode ?? 'normal' })
      setAiText(result.explanation)
    } catch (e) {
      toast({ title: 'KI nicht verfügbar', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setAiBusy(false)
    }
  }

  const askAiGrade = async () => {
    if (!q || !check) return
    setAiBusy(true)
    try {
      const { result, provider } = await generate({ task: 'grade', question: q.prompt, modelAnswer: q.answer, studentAnswer: value, grade: profile?.grade ?? 9 })
      setAiText(`**KI-Bewertung (${provider}):** ${result.feedback}${result.misconception ? `\n\n**Möglicher Denkfehler:** ${result.misconception}` : ''}`)
      await selfAssess(result.score)
    } catch (e) {
      toast({ title: 'KI-Bewertung fehlgeschlagen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setAiBusy(false)
    }
  }

  // keyboard: digits for options, Enter to check/continue, H for hint
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA'].includes(t.tagName)
      if (!q) return
      if (!typing && !check && (q.type === 'mc' || q.type === 'tf')) {
        const n = Number(e.key)
        const count = q.type === 'mc' ? q.options?.length ?? 0 : 2
        if (n >= 1 && n <= count) setValue(q.type === 'mc' ? String(n - 1) : n === 1 ? 'true' : 'false')
      }
      if (e.key === 'Enter' && !typing) {
        e.preventDefault()
        if (check && check.status !== 'self-assess') next()
        else if (!check && value) submit()
      }
      if ((e.key === 'h' || e.key === 'H') && !typing && !check && hints < q.hints.length) setHints((h) => h + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!attempt || !answers || index === null || finishing) return <LoadingBlock label={finishing ? 'Auswertung …' : undefined} />
  if (!q) return <LoadingBlock label="Auswertung …" />

  const tone = check?.status === 'correct' ? 'success' : check?.status === 'partial' ? 'warn' : check?.status === 'wrong' ? 'warn' : 'neutral'
  return (
    <div className="mx-auto max-w-2xl">
      <RunnerHeader title={attempt.title} index={index} total={questions.length} elapsed={elapsed} onExit={() => navigate('/quiz')} />
      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge>{TYPE_LABELS[q.type]}</Badge>
          <Badge tone="neutral" title="Schwierigkeit">
            {'●'.repeat(q.difficulty)}
            <span className="text-fg-subtle">{'●'.repeat(4 - q.difficulty)}</span>
          </Badge>
          {q.source === 'generator' && q.skill !== 'vocab' && <Badge tone="accent">Generierte Aufgabe</Badge>}
          {q.source === 'ai' && <Badge tone="accent">KI-erstellt</Badge>}
        </div>
        <QuestionPrompt q={q} />
        <div className="mt-5">
          <AnswerInput q={q} value={value} onChange={(v) => { setValue(v); setInputError(null) }} onSubmit={submit} locked={!!check} correctness={check ? (check.correct ? 'correct' : check.status === 'self-assess' ? null : 'wrong') : null} />
          {inputError && <p className="mt-2 text-sm text-warn" role="alert">{inputError} (Das zählt nicht als Fehler.)</p>}
        </div>

        {hints > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {q.hints.slice(0, hints).map((h, i) => (
              <Notice key={i} tone="accent" icon={Lightbulb} title={`Hinweis ${i + 1}`}>
                <Markdown inline>{h}</Markdown>
              </Notice>
            ))}
          </div>
        )}

        {check && check.status === 'self-assess' && !answerId && (
          <div className="mt-5 flex flex-col gap-3">
            <Notice tone="neutral" icon={MessageCircleQuestion} title="Vergleiche selbst">
              {check.feedback}
            </Notice>
            <div className="rounded-lg border border-border bg-surface-2 p-4">
              <div className="eyebrow mb-1">Musterlösung</div>
              <Markdown>{q.answer}</Markdown>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => selfAssess(1)} disabled={busy}>Hatte ich richtig</Button>
              <Button onClick={() => selfAssess(0.5)} disabled={busy}>Teilweise</Button>
              <Button onClick={() => selfAssess(0)} disabled={busy}>Nicht richtig</Button>
              {ai?.ok && (
                <Button variant="soft" icon={Sparkles} loading={aiBusy} onClick={askAiGrade}>
                  Von KI bewerten lassen
                </Button>
              )}
            </div>
          </div>
        )}

        {check && check.status !== 'self-assess' && (
          <div className="pop-in mt-5 flex flex-col gap-3" aria-live="polite">
            <Notice tone={tone} icon={check.correct ? CheckCircle2 : CircleDashed} title={check.correct ? 'Richtig' : check.status === 'partial' ? 'Teilweise richtig' : 'Noch nicht richtig'}>
              <Markdown inline>{check.feedback}</Markdown>
            </Notice>
            {!check.correct && (
              <div className="rounded-lg border border-border bg-surface-2 p-4">
                <div className="eyebrow mb-1">Richtige Antwort</div>
                <Markdown>{check.expected}</Markdown>
              </div>
            )}
            {q.explanation && (
              <div className="rounded-lg border border-border p-4">
                <div className="eyebrow mb-1">Warum?</div>
                <Markdown>{q.explanation}</Markdown>
              </div>
            )}
            {q.steps && q.steps.length > 0 && (
              <div>
                <Button variant="ghost" size="sm" icon={ListOrdered} onClick={() => setShowSteps((s) => !s)} aria-expanded={showSteps}>
                  {showSteps ? 'Lösungsweg ausblenden' : 'Lösungsweg Schritt für Schritt'}
                </Button>
                {showSteps && (
                  <ol className="mt-2 flex flex-col gap-1.5 rounded-lg border border-border p-4">
                    {q.steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="text-xs font-semibold text-fg-subtle tabular pt-1">{i + 1}.</span>
                        <Markdown inline>{s}</Markdown>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            {aiText && (
              <div className="rounded-lg border border-accent/30 bg-accent-soft p-4">
                <div className="eyebrow mb-1">Zusätzliche Erklärung (KI)</div>
                <Markdown>{aiText}</Markdown>
              </div>
            )}
            {!check.correct && (
              <div className="flex flex-wrap gap-2">
                {ai?.ok && !aiText && (
                  <Button variant="soft" size="sm" icon={Sparkles} loading={aiBusy} onClick={q.type === 'text' ? askAiGrade : askAiWhy}>
                    {q.type === 'text' ? 'Von KI genauer bewerten lassen' : 'KI: Warum war meine Antwort falsch?'}
                  </Button>
                )}
                {(q.type === 'text' || q.type === 'vocab') && answerId && (
                  <Button variant="ghost" size="sm" onClick={() => selfAssess(1)} disabled={busy}>
                    Meine Antwort war doch richtig
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            {!check && q.hints.length > hints && (
              <Button variant="ghost" icon={Lightbulb} onClick={() => setHints((h) => h + 1)}>
                {hints === 0 ? 'Hinweis' : 'Nächster Hinweis'} ({q.hints.length - hints})
              </Button>
            )}
          </div>
          {!check || check.status === 'self-assess' ? (
            !check && (
              <Button variant="primary" onClick={submit} disabled={!value.trim()} loading={busy}>
                Prüfen
              </Button>
            )
          ) : (
            <Button variant="primary" iconRight={ArrowRight} onClick={next} autoFocus>
              {index + 1 >= questions.length ? 'Auswertung' : 'Weiter'}
            </Button>
          )}
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-fg-subtle">Übungsmodus: sofortiges Feedback. Falsche Antworten kommen später automatisch wieder.</p>
    </div>
  )
}

// ───────────────────────── Exam mode ─────────────────────────

function ExamRunner({ attemptId }: { attemptId: string }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const attempt = useLiveQuery(async () => (await db.attempts.get(attemptId)) ?? null, [attemptId])
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const elapsed = useElapsed(attempt?.startedAt ?? new Date().toISOString())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (attempt && values === null) setValues({ ...(attempt.draftAnswers ?? {}) })
  }, [attempt, values])

  const questions = useMemo(() => attempt?.questionSnapshots ?? [], [attempt])
  const limitSec = attempt?.timeLimitMin ? attempt.timeLimitMin * 60 : undefined

  const submit = useCallback(
    async (auto = false) => {
      if (!attempt || !values || submitting) return
      const missing = questions.filter((q) => !values[q.id]?.trim()).length
      if (!auto && missing > 0) {
        const ok = await confirm({ title: 'Wirklich abgeben?', message: `${missing} Frage${missing === 1 ? ' ist' : 'n sind'} noch unbeantwortet. Unbeantwortete Fragen zählen 0 Punkte.`, confirmLabel: 'Abgeben', tone: 'primary' })
        if (!ok) return
      }
      setSubmitting(true)
      const payload: AnswerPayload[] = questions
        .filter((q) => values[q.id]?.trim())
        .map((q) => {
          const given = values[q.id]
          let check = checkAnswer(q, given)
          if (check.status === 'unreadable') check = { ...check, status: 'wrong', feedback: 'Die Eingabe war nicht lesbar und wurde als falsch gewertet.' }
          return { question: q, given, check, hintsUsed: 0, timeMs: 0 }
        })
      try {
        await finishAttempt(attemptId, payload)
        if (auto) toast({ title: 'Die Zeit ist abgelaufen', description: 'Deine Antworten wurden automatisch abgegeben.' })
      } catch (e) {
        toast({ title: 'Abgabe fehlgeschlagen', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
        setSubmitting(false)
      }
    },
    [attempt, values, submitting, questions, confirm, attemptId, toast],
  )

  useEffect(() => {
    if (limitSec && elapsed >= limitSec && !submitting) submit(true)
  }, [elapsed, limitSec, submit, submitting])

  if (!attempt || !values || submitting) return <LoadingBlock label={submitting ? 'Wird ausgewertet …' : undefined} />
  const q = questions[index]
  const setValue = (v: string) => {
    setValues((vs) => ({ ...vs!, [q.id]: v }))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraftAnswer(attemptId, q.id, v), 400)
  }
  const answered = questions.filter((x) => values[x.id]?.trim()).length

  return (
    <div className="mx-auto max-w-3xl">
      <RunnerHeader title={attempt.title} index={answered} total={questions.length} elapsed={elapsed} limitSec={limitSec} onExit={() => navigate('/quiz')} />
      <Notice tone="neutral" icon={Flag} className="mb-4">
        Prüfungsmodus: Keine Hinweise, keine Rückmeldung bis zur Abgabe. Deine Eingaben werden laufend gespeichert.
      </Notice>
      <nav aria-label="Fragen" className="mb-4 flex flex-wrap gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={`Frage ${i + 1}${values[x.id]?.trim() ? ', beantwortet' : ''}`}
            className={cn('size-9 rounded-md border text-sm font-medium tabular cursor-pointer', i === index ? 'border-accent text-accent' : values[x.id]?.trim() ? 'border-transparent bg-surface-3 text-fg' : 'border-border text-fg-muted')}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Badge>Frage {index + 1}</Badge>
          <Badge>{TYPE_LABELS[q.type]}</Badge>
          <span className="text-xs text-fg-subtle">{q.points} Punkt{q.points === 1 ? '' : 'e'}</span>
        </div>
        <QuestionPrompt q={q} />
        <div className="mt-5">
          <AnswerInput q={q} value={values[q.id] ?? ''} onChange={setValue} onSubmit={() => index < questions.length - 1 && setIndex(index + 1)} />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button icon={ArrowLeft} onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
            Zurück
          </Button>
          {index < questions.length - 1 ? (
            <Button variant="secondary" iconRight={ArrowRight} onClick={() => setIndex(index + 1)}>
              Nächste Frage
            </Button>
          ) : (
            <Button variant="primary" onClick={() => submit(false)}>
              Abgeben ({answered}/{questions.length})
            </Button>
          )}
        </div>
      </Card>
      {index < questions.length - 1 && (
        <div className="mt-3 text-right">
          <Button variant="ghost" size="sm" onClick={() => submit(false)}>
            Jetzt abgeben
          </Button>
        </div>
      )}
    </div>
  )
}
