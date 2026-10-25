import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListChecks, Play, Sparkles } from 'lucide-react'
import { db } from '@/db/index'
import type { AttemptKind, Difficulty, QuestionType } from '@/db/types'
import { createAttempt } from '@/db/repo'
import { buildQuestions, mistakeQuestions, quickSessionQuestions, vocabQuestions, type DifficultyChoice, type QuizConfig } from './builder'
import { Button, ButtonLink, Card, Checkbox, EmptyState, Field, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, useToast } from '@/components/ui'
import { useAi, useSubjects } from '@/hooks/data'
import { SKILLS } from '@/lib/mathgen'
import { recommendTopics } from '@/lib/recommend'
import { computeAllTopicStats } from '@/lib/mastery'
import { openMistakes } from '@/lib/mistakes'
import { dayKey } from '@/lib/dates'
import { TYPE_LABELS } from './QuestionView'
import { AiPracticeDialog } from './AiPracticeDialog'

const ALL_TYPES: QuestionType[] = ['mc', 'tf', 'text', 'numeric', 'math', 'vocab']

/** Starts a quiz directly from a preset link (dashboard, plan, topic page). */
function useAutoStart() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const started = useRef(false)
  const preset = params.get('preset')
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    if (!preset || started.current) return
    started.current = true
    ;(async () => {
      const topicId = params.get('topic')
      const subjectId = params.get('subject')
      const examId = params.get('exam')
      const sessionId = params.get('session')
      const topic = topicId ? await db.topics.get(topicId) : undefined
      let questions: Awaited<ReturnType<typeof buildQuestions>>
      let title: string
      let kind: AttemptKind = 'practice'
      let mode: 'practice' | 'exam' = 'practice'
      let timeLimitMin: number | undefined
      let topicIds: string[] = topicId ? [topicId] : (params.get('topics') ?? '').split(',').filter(Boolean)
      const base: QuizConfig = { kind: 'practice', mode: 'practice', title: '', subjectId: topic?.subjectId ?? subjectId, topicIds, types: [], count: 8, difficulty: 'adaptive', source: 'all', useGenerators: true }

      if (preset === 'quick') {
        const [topics, answers, exams, subjects] = await Promise.all([db.topics.toArray(), db.answers.toArray(), db.exams.toArray(), db.subjects.toArray()])
        const stats = computeAllTopicStats(topics.map((t) => t.id), answers)
        const recs = recommendTopics({ topics, subjects, stats, mistakes: openMistakes(answers), exams, today: dayKey() })
        questions = await quickSessionQuestions(recs.map((r) => r.topicId))
        title = '5-Minuten-Lernrunde'
        kind = 'quick'
      } else if (preset === 'mistakes') {
        questions = await mistakeQuestions(10, { topicId: topicId ?? undefined, subjectId: subjectId ?? undefined })
        title = topic ? `Fehler wiederholen: ${topic.name}` : 'Fehler wiederholen'
        kind = 'mistakes'
      } else if (preset === 'diagnostic' || preset === 'mock') {
        const exam = examId ? await db.exams.get(examId) : undefined
        if (!exam) throw new Error('Die Prüfung wurde nicht gefunden.')
        topicIds = exam.topicIds
        const perTopic = preset === 'diagnostic' ? 2 : Math.max(2, Math.ceil(12 / Math.max(1, exam.topicIds.length)))
        questions = await buildQuestions({ ...base, kind: preset, mode: 'exam', subjectId: exam.subjectId, topicIds, count: Math.min(preset === 'diagnostic' ? 12 : 16, perTopic * Math.max(1, topicIds.length)), difficulty: preset === 'diagnostic' ? 'adaptive' : 'adaptive' })
        title = `${preset === 'diagnostic' ? 'Diagnosetest' : 'Probeklausur'}: ${exam.title}`
        kind = preset
        mode = 'exam'
        timeLimitMin = preset === 'mock' ? Math.max(10, questions.length * 2) : undefined
      } else {
        const diff: Partial<Record<string, DifficultyChoice>> = { challenge: 3, learn: 1 }
        questions = await buildQuestions({ ...base, difficulty: diff[preset] ?? 'adaptive', count: preset === 'review' ? 5 : 8 })
        if (preset === 'challenge') questions = questions.length >= 3 ? questions : await buildQuestions({ ...base, difficulty: 4 })
        const label: Record<string, string> = { practice: 'Gezielt üben', review: 'Kurz wiederholen', challenge: 'Herausforderung', learn: 'Einstieg' }
        title = topic ? `${label[preset] ?? 'Übung'}: ${topic.name}` : label[preset] ?? 'Übung'
        if (preset === 'learn' && questions.length === 0) questions = await buildQuestions({ ...base, difficulty: 'adaptive' })
      }
      if (questions.length === 0) {
        setProblem(
          preset === 'mistakes'
            ? 'Es gibt gerade keine offenen Fehler. Sehr gut!'
            : topic
              ? `Für „${topic.name}“ gibt es noch keine Fragen. Lege eigene an, erstelle sie aus deinem Material oder lass die KI welche vorschlagen.`
              : 'Es gibt noch keine passenden Fragen. Füge Themen und Fragen hinzu oder übernimm den Beispiel-Lehrplan in den Einstellungen.',
        )
        return
      }
      const id = await createAttempt({ kind, mode, title, subjectId: topic?.subjectId ?? subjectId ?? null, topicIds, questions, examId, planSessionId: sessionId, timeLimitMin })
      navigate(`/quiz/${id}`, { replace: true })
    })().catch((e) => {
      toast({ title: 'Quiz konnte nicht gestartet werden', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
      setProblem(e instanceof Error ? e.message : String(e))
    })
  }, [preset, params, navigate, toast])
  return { preset, problem, topicId: params.get('topic') }
}

export default function QuizSetup() {
  const auto = useAutoStart()
  const [aiOpen, setAiOpen] = useState(false)
  if (auto.preset && !auto.problem) return <LoadingBlock label="Fragen werden zusammengestellt …" />
  if (auto.preset && auto.problem)
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={ListChecks}
          title="Kein Quiz möglich"
          description={auto.problem}
          action={
            <>
              {auto.topicId && <ButtonLink to={`/faecher/x/themen/${auto.topicId}`} variant="primary">Fragen anlegen</ButtonLink>}
              {auto.topicId && (
                <Button icon={Sparkles} onClick={() => setAiOpen(true)}>
                  KI-Vorschläge
                </Button>
              )}
              <ButtonLink to="/quiz/neu">Eigenes Quiz zusammenstellen</ButtonLink>
            </>
          }
        />
        {auto.topicId && <AiPracticeDialog open={aiOpen} onClose={() => setAiOpen(false)} topicId={auto.topicId} />}
      </div>
    )
  return <CustomQuizForm />
}

function CustomQuizForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const ai = useAi()
  const [params] = useSearchParams()
  const subjects = useSubjects()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const [what, setWhat] = useState<'topics' | 'vocab'>(params.has('deck') ? 'vocab' : 'topics')
  const [subjectId, setSubjectId] = useState<string>(params.get('subject') ?? '')
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [types, setTypes] = useState<QuestionType[]>([])
  const [count, setCount] = useState(10)
  const [difficulty, setDifficulty] = useState<DifficultyChoice>('adaptive')
  const [mode, setMode] = useState<'practice' | 'exam'>(params.get('mode') === 'exam' ? 'exam' : 'practice')
  const [timeLimit, setTimeLimit] = useState('')
  const [source, setSource] = useState<'all' | 'library' | 'own'>('all')
  const [useGen, setUseGen] = useState(true)
  const [deckId, setDeckId] = useState(params.get('deck') ?? '')
  const [direction, setDirection] = useState<'front-back' | 'back-front'>('front-back')
  const [busy, setBusy] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    if (!subjectId && subjects && subjects.length) setSubjectId(subjects[0].id)
  }, [subjects, subjectId])
  useEffect(() => setTopicIds([]), [subjectId])
  useEffect(() => {
    if (!deckId && decks && decks.length) setDeckId(decks[0].id)
  }, [decks, deckId])

  const counts = useLiveQuery(async () => {
    if (!subjectId) return null
    const qs = await db.questions.where('subjectId').equals(subjectId).filter((q) => q.source !== 'generator').toArray()
    const m = new Map<string, number>()
    for (const q of qs) m.set(q.topicId, (m.get(q.topicId) ?? 0) + 1)
    return m
  }, [subjectId])
  const hasMathGen = useMemo(() => (topics ?? []).some((t) => (topicIds.length === 0 || topicIds.includes(t.id)) && SKILLS.some((s) => s.topicKey === t.id)), [topics, topicIds])

  const start = async () => {
    setBusy(true)
    setEmpty(false)
    try {
      const limit = Number(timeLimit)
      if (what === 'vocab') {
        const deck = decks?.find((d) => d.id === deckId)
        if (!deck) throw new Error('Bitte wähle einen Kartenstapel.')
        const cards = await db.cards.where('deckId').equals(deck.id).toArray()
        if (cards.length === 0) {
          setEmpty(true)
          return
        }
        const qs = vocabQuestions(deck, cards, direction, count)
        const id = await createAttempt({ kind: mode === 'exam' ? 'exam' : 'practice', mode, title: `Vokabeltest: ${deck.name}`, subjectId: deck.subjectId, topicIds: deck.topicId ? [deck.topicId] : [], questions: qs, timeLimitMin: mode === 'exam' && limit > 0 ? limit : undefined })
        navigate(`/quiz/${id}`)
        return
      }
      const subject = subjects?.find((s) => s.id === subjectId)
      const qs = await buildQuestions({ kind: mode === 'exam' ? 'exam' : 'practice', mode, title: '', subjectId: subjectId || null, topicIds, types, count, difficulty, source, useGenerators: useGen })
      if (qs.length === 0) {
        setEmpty(true)
        return
      }
      const topicLabel = topicIds.length === 1 ? topics?.find((t) => t.id === topicIds[0])?.name : null
      const id = await createAttempt({
        kind: mode === 'exam' ? 'exam' : 'practice', mode, title: `${mode === 'exam' ? 'Test' : 'Übung'}: ${topicLabel ?? subject?.name ?? 'Gemischt'}`,
        subjectId: subjectId || null, topicIds, questions: qs, timeLimitMin: mode === 'exam' && limit > 0 ? limit : undefined,
      })
      navigate(`/quiz/${id}`)
    } catch (e) {
      toast({ title: 'Quiz konnte nicht gestartet werden', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  if (!subjects) return <LoadingBlock />
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Quiz" title="Quiz zusammenstellen" description="Wähle Thema, Fragetypen und Modus. Im Übungsmodus bekommst du sofort Rückmeldung, im Prüfungsmodus erst nach der Abgabe." />
      <Card className="flex flex-col gap-6 p-5">
        <Segmented label="Art des Quiz" value={what} onChange={setWhat} options={[{ value: 'topics', label: 'Fragen zu Themen' }, { value: 'vocab', label: 'Vokabeltest' }]} />

        {what === 'topics' ? (
          <>
            {subjects.length === 0 ? (
              <Notice tone="warn" title="Noch keine Fächer">Lege zuerst ein Fach an.</Notice>
            ) : (
              <Field label="Fach" htmlFor="quiz-subject">
                <Select id="quiz-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            {topics && topics.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Themen <span className="font-normal text-fg-subtle">(keins gewählt = alle)</span></legend>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  {topics.map((t) => (
                    <Checkbox
                      key={t.id}
                      checked={topicIds.includes(t.id)}
                      onChange={(v) => setTopicIds((ids) => (v ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
                      label={t.name}
                      description={`${counts?.get(t.id) ?? 0} Fragen${SKILLS.some((s) => s.topicKey === t.id) ? ' + Aufgabengenerator' : ''}`}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Fragetypen <span className="font-normal text-fg-subtle">(keiner gewählt = alle)</span></legend>
              <div className="flex flex-wrap gap-x-4">
                {ALL_TYPES.map((t) => (
                  <Checkbox key={t} checked={types.includes(t)} onChange={(v) => setTypes((ts) => (v ? [...ts, t] : ts.filter((x) => x !== t)))} label={TYPE_LABELS[t]} />
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Schwierigkeit" htmlFor="quiz-diff" hint="„Passend“ richtet sich nach deinem aktuellen Stand im Thema.">
                <Select id="quiz-diff" value={String(difficulty)} onChange={(e) => setDifficulty(e.target.value === 'adaptive' ? 'adaptive' : (Number(e.target.value) as Difficulty))}>
                  <option value="adaptive">Passend zu meinem Stand</option>
                  <option value="1">1 – leicht</option>
                  <option value="2">2 – mittel</option>
                  <option value="3">3 – schwer</option>
                  <option value="4">4 – für Fortgeschrittene</option>
                </Select>
              </Field>
              <Field label="Quelle" htmlFor="quiz-source">
                <Select id="quiz-source" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
                  <option value="all">Alle Fragen</option>
                  <option value="library">Nur Beispielaufgaben</option>
                  <option value="own">Nur eigene / aus Material / KI</option>
                </Select>
              </Field>
            </div>
            {hasMathGen && <Checkbox checked={useGen} onChange={setUseGen} label="Mathe-Aufgabengenerator nutzen" description="Ergänzt automatisch neue Rechenaufgaben mit Lösungsweg, wenn zu wenige Fragen vorhanden sind." />}
          </>
        ) : decks && decks.length === 0 ? (
          <Notice tone="warn" title="Noch keine Kartenstapel">Lege unter Karteikarten einen Stapel an.</Notice>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Kartenstapel" htmlFor="quiz-deck">
              <Select id="quiz-deck" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                {decks?.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Richtung" htmlFor="quiz-dir">
              <Select id="quiz-dir" value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)}>
                <option value="front-back">Vorderseite → Rückseite (z. B. Englisch → Deutsch)</option>
                <option value="back-front">Rückseite → Vorderseite (z. B. Deutsch → Englisch)</option>
              </Select>
            </Field>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Anzahl Fragen" htmlFor="quiz-count">
            <Input id="quiz-count" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Modus" htmlFor="quiz-mode">
            <Select id="quiz-mode" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="practice">Übung – sofortiges Feedback</option>
              <option value="exam">Prüfung – Feedback nach Abgabe</option>
            </Select>
          </Field>
          {mode === 'exam' && (
            <Field label="Zeitlimit in Minuten" htmlFor="quiz-time" optional>
              <Input id="quiz-time" type="number" min={1} max={180} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="ohne" />
            </Field>
          )}
        </div>

        {empty && (
          <Notice tone="warn" title="Für diese Auswahl gibt es keine Fragen">
            Wähle andere Themen oder Fragetypen, lege eigene Fragen an{ai?.ok ? ' oder lass dir von der KI Übungsaufgaben vorschlagen' : ''}.
            {ai?.ok && topicIds.length === 1 && (
              <div className="mt-2">
                <Button size="sm" icon={Sparkles} onClick={() => setAiOpen(true)}>KI-Vorschläge erstellen</Button>
              </div>
            )}
          </Notice>
        )}
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="primary" size="lg" icon={Play} onClick={start} loading={busy} disabled={what === 'topics' ? !subjectId : !deckId}>
            Quiz starten
          </Button>
        </div>
      </Card>
      {topicIds.length === 1 && <AiPracticeDialog open={aiOpen} onClose={() => setAiOpen(false)} topicId={topicIds[0]} />}
    </div>
  )
}
