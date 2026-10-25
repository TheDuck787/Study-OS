import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, CircleDashed, LineChart, ListChecks, Play, Shuffle, Sigma, Target } from 'lucide-react'
import { db } from '@/db/index'
import type { Difficulty, Question } from '@/db/types'
import { createAttempt } from '@/db/repo'
import { SKILLS, generateQuestion, type SkillDef } from '@/lib/mathgen'
import { checkEquationSteps, checkExpressionSteps, compileFunction, parseMath, solveEquation, type StepCheckLine } from '@/lib/mathcheck'
import { computeTopicStats } from '@/lib/mastery'
import { Badge, Button, Card, cn, EmptyState, Field, Input, LoadingBlock, Notice, PageHeader, ProgressBar, Segmented, Select, Tabs, Textarea, useToast } from '@/components/ui'
import { FunctionPlot, PLOT_COLORS } from './FunctionPlot'

export default function MathMode() {
  const [tab, setTab] = useState<'practice' | 'steps' | 'plot'>('practice')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Mathe" title="Mathe-Modus" description="Unbegrenzt neue Aufgaben mit Lösungsweg, ein Rechenweg-Check, der den falschen Schritt findet, und ein Funktionsplotter. Gleichwertige Ergebnisse (z. B. 0,5 und 1/2) werden immer anerkannt." />
      <Tabs label="Mathe-Bereiche" value={tab} onChange={setTab} tabs={[{ id: 'practice', label: 'Fertigkeiten üben', icon: Sigma }, { id: 'steps', label: 'Rechenweg prüfen', icon: ListChecks }, { id: 'plot', label: 'Funktionen zeichnen', icon: LineChart }]} />
      {tab === 'practice' && <SkillPractice />}
      {tab === 'steps' && <StepChecker />}
      {tab === 'plot' && <Plotter />}
    </div>
  )
}

function SkillPractice() {
  const navigate = useNavigate()
  const toast = useToast()
  const topics = useLiveQuery(() => db.topics.toArray(), [])
  const subjects = useLiveQuery(() => db.subjects.toArray(), [])
  const answers = useLiveQuery(() => db.answers.toArray(), [])
  const genQs = useLiveQuery(() => db.questions.where('source').equals('generator').toArray(), [])
  const [difficulty, setDifficulty] = useState<'adaptive' | Difficulty>('adaptive')
  const [count, setCount] = useState(8)
  const [fallbackTopic, setFallbackTopic] = useState('')

  const skillStats = useMemo(() => {
    if (!answers || !genQs) return new Map<string, { n: number; correct: number }>()
    const skillOf = new Map(genQs.map((q) => [q.id, q.skill]))
    const m = new Map<string, { n: number; correct: number }>()
    for (const a of answers) {
      const s = skillOf.get(a.questionId)
      if (!s || s === 'vocab') continue
      const e = m.get(s) ?? { n: 0, correct: 0 }
      e.n++
      if (a.correct) e.correct++
      m.set(s, e)
    }
    return m
  }, [answers, genQs])

  if (!topics || !subjects || !answers) return <LoadingBlock />
  const mathSubject = subjects.find((s) => s.name.toLowerCase().startsWith('mathe'))
  const mathTopics = topics.filter((t) => t.subjectId === mathSubject?.id)
  const topicFor = (skill: SkillDef) => topics.find((t) => t.id === skill.topicKey) ?? topics.find((t) => t.id === fallbackTopic) ?? null
  const missingTopics = SKILLS.some((s) => !topics.some((t) => t.id === s.topicKey))

  const start = async (skills: SkillDef[], title: string) => {
    const questions: Question[] = []
    for (let i = 0; i < count; i++) {
      const skill = skills[i % skills.length]
      const topic = topicFor(skill)
      if (!topic) continue
      let d: Difficulty
      if (difficulty === 'adaptive') {
        const st = skillStats.get(skill.key)
        const acc = st && st.n >= 3 ? st.correct / st.n : null
        const ts = computeTopicStats(topic.id, answers)
        d = acc === null ? (ts.level === 'solid' || ts.level === 'mastered' ? 2 : 1) : acc > 0.85 ? 3 : acc > 0.6 ? 2 : 1
        if (acc !== null && acc > 0.9 && st!.n >= 8) d = 4
      } else d = difficulty
      questions.push(generateQuestion(skill.key, d, { subjectId: topic.subjectId, topicId: topic.id }))
    }
    if (questions.length === 0) {
      toast({ title: 'Kein Thema zum Speichern', description: 'Wähle unten ein Mathe-Thema, unter dem die Antworten gespeichert werden.', tone: 'danger' })
      return
    }
    const id = await createAttempt({ kind: 'math', mode: 'practice', title, subjectId: questions[0].subjectId, topicIds: [...new Set(questions.map((q) => q.topicId))], questions })
    navigate(`/quiz/${id}`)
  }

  const weakest = SKILLS.filter((s) => (skillStats.get(s.key)?.n ?? 0) >= 3).sort((a, b) => {
    const sa = skillStats.get(a.key)!, sb = skillStats.get(b.key)!
    return sa.correct / sa.n - sb.correct / sb.n
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Schwierigkeit" htmlFor="mm-diff">
          <Select id="mm-diff" value={String(difficulty)} onChange={(e) => setDifficulty(e.target.value === 'adaptive' ? 'adaptive' : (Number(e.target.value) as Difficulty))} className="w-56">
            <option value="adaptive">Passend zu meinen Ergebnissen</option>
            <option value="1">1 – leicht</option>
            <option value="2">2 – mittel</option>
            <option value="3">3 – schwer</option>
            <option value="4">4 – für Fortgeschrittene</option>
          </Select>
        </Field>
        <Field label="Aufgaben pro Runde" htmlFor="mm-count">
          <Segmented label="Anzahl" value={count} onChange={setCount} options={[5, 8, 12].map((n) => ({ value: n, label: String(n) }))} />
        </Field>
        <div className="ml-auto flex flex-wrap gap-2">
          {weakest.length > 0 && (
            <Button variant="primary" icon={Target} onClick={() => start(weakest.slice(0, 2), `Schwächste Fertigkeiten: ${weakest.slice(0, 2).map((s) => s.name).join(', ')}`)}>
              Schwächste Fertigkeit üben
            </Button>
          )}
          <Button icon={Shuffle} onClick={() => start(SKILLS, 'Gemischte Mathe-Aufgaben')}>Gemischt</Button>
        </div>
      </div>
      {missingTopics && (
        <Notice tone="neutral" title="Nicht alle Mathe-Themen vorhanden">
          Einige Fertigkeiten gehören zu Themen des Beispiel-Lehrplans, die es bei dir nicht gibt. Antworten zu diesen Fertigkeiten werden unter diesem Thema gespeichert:
          <Select aria-label="Ersatz-Thema" value={fallbackTopic} onChange={(e) => setFallbackTopic(e.target.value)} className="mt-2 h-9 max-w-xs">
            <option value="">– bitte wählen –</option>
            {(mathTopics.length ? mathTopics : topics).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Notice>
      )}
      {topics.length === 0 ? (
        <EmptyState title="Noch keine Themen" description="Lege unter Fächer → Mathematik deine Themen an. Die Übungen werden dann einem Thema zugeordnet." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SKILLS.map((s) => {
            const st = skillStats.get(s.key)
            const topic = topicFor(s)
            const acc = st && st.n > 0 ? st.correct / st.n : null
            return (
              <li key={s.key} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{s.name}</div>
                  {acc !== null && <Badge tone={acc >= 0.8 ? 'success' : acc >= 0.5 ? 'accent' : 'warn'}>{Math.round(acc * 100)} %</Badge>}
                </div>
                <p className="text-sm text-fg-muted">{s.description}</p>
                {acc !== null ? <ProgressBar value={acc} label={`Trefferquote ${s.name}`} tone={acc >= 0.8 ? 'success' : acc >= 0.5 ? 'accent' : 'warn'} /> : <span className="text-xs text-fg-subtle">Noch nicht geübt</span>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="truncate text-xs text-fg-subtle">{st ? `${st.n} Aufgaben` : ''}{topic ? ` · ${topic.name}` : ' · kein Thema'}</span>
                  <Button size="sm" icon={Play} onClick={() => start([s], s.name)} disabled={!topic}>Üben</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StepChecker() {
  const [kind, setKind] = useState<'equation' | 'expression'>('equation')
  const [start, setStart] = useState('3x + 5 = 2x + 9')
  const [steps, setSteps] = useState('3x - 2x + 5 = 9\nx + 5 = 9\nx = 14')
  const [result, setResult] = useState<{ lines: StepCheckLine[]; firstError: number | null; info?: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const newExercise = () => {
    const q = generateQuestion(Math.random() < 0.7 ? 'lin-eq' : 'quad-eq', (Math.floor(Math.random() * 3) + 1) as Difficulty, { subjectId: '', topicId: '' })
    if (q.stepCheck?.kind === 'equation' && q.stepCheck.equation) {
      setKind('equation')
      setStart(q.stepCheck.equation)
      setSteps('')
      setResult(null)
    }
  }
  const check = () => {
    setProblem(null)
    const lines = steps.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      setProblem('Schreibe deinen Rechenweg Zeile für Zeile auf.')
      return
    }
    if (kind === 'equation') {
      const sol = solveEquation(start)
      if (!sol) {
        setProblem('Diese Gleichung kann ich nicht prüfen. Unterstützt werden lineare und quadratische Gleichungen mit der Variablen x.')
        return
      }
      if (sol.solutions.length === 0) {
        setProblem('Diese Gleichung hat keine (reelle) Lösung – deshalb gibt es keinen Rechenweg zum Prüfen.')
        return
      }
      const r = checkEquationSteps(lines, 'x', sol.solutions)
      setResult({ ...r, info: `Lösung${sol.solutions.length > 1 ? 'en' : ''} der Ausgangsgleichung: ${sol.solutions.map((s) => s.toLocaleString('de-DE')).join(' und ')}` })
    } else {
      if (!parseMath(start)) {
        setProblem('Den Ausgangsterm konnte ich nicht lesen.')
        return
      }
      setResult(checkExpressionSteps(lines, start))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="flex flex-col gap-4 p-5">
        <Segmented label="Art" value={kind} onChange={(k) => { setKind(k); setResult(null) }} options={[{ value: 'equation', label: 'Gleichung lösen' }, { value: 'expression', label: 'Term umformen' }]} />
        <Field label={kind === 'equation' ? 'Ausgangsgleichung' : 'Ausgangsterm'} htmlFor="sc-start" hint={kind === 'equation' ? 'Lineare oder quadratische Gleichung mit x.' : 'z. B. 2(x+3) - x oder (a+b)^2'}>
          <div className="flex gap-2">
            <Input id="sc-start" value={start} onChange={(e) => { setStart(e.target.value); setResult(null) }} className="font-mono" />
            {kind === 'equation' && <Button onClick={newExercise} icon={Shuffle} title="Neue Aufgabe">Neu</Button>}
          </div>
        </Field>
        <Field label="Dein Rechenweg – eine Umformung pro Zeile" htmlFor="sc-steps" hint="Notizen wie „| -5“ hinter einem senkrechten Strich werden ignoriert.">
          <Textarea id="sc-steps" value={steps} onChange={(e) => { setSteps(e.target.value); setResult(null) }} rows={8} className="font-mono" placeholder={kind === 'equation' ? '3x = 15 | :3\nx = 5' : '2x + 6 - x\nx + 6'} />
        </Field>
        <Button variant="primary" onClick={check}>Rechenweg prüfen</Button>
        {problem && <Notice tone="warn">{problem}</Notice>}
      </Card>
      <div className="flex flex-col gap-3">
        {!result ? (
          <Notice tone="neutral" title="So funktioniert es">
            Jede Zeile wird mit der Ausgangsaufgabe verglichen. Bei Gleichungen muss jede Zeile dieselben Lösungen haben; bei Termen muss jede Zeile gleichwertig sein. Die erste Zeile, die das nicht erfüllt, ist der Schritt mit dem Fehler – so siehst du genau, wo es hakt.
          </Notice>
        ) : (
          <>
            {result.info && <p className="text-sm text-fg-muted">{result.info}</p>}
            <ol className="flex flex-col gap-2">
              {result.lines.map((l, i) => (
                <li key={i} className={cn('rounded-lg border px-3.5 py-2.5', l.ok === true ? 'border-success/40 bg-success-soft' : l.ok === false ? (i === result.firstError ? 'border-warn/60 bg-warn-soft' : 'border-border') : 'border-border bg-surface-2')}>
                  <div className="flex items-center gap-2">
                    {l.ok === true ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className={cn('size-4', l.ok === false ? 'text-warn' : 'text-fg-subtle')} />}
                    <code className="font-mono text-sm">{l.input}</code>
                  </div>
                  <p className="mt-1 text-sm text-fg-muted">{i === result.firstError ? <strong className="text-fg">Hier steckt der Fehler. </strong> : null}{l.message}</p>
                </li>
              ))}
            </ol>
            {result.firstError === null && result.lines.every((l) => l.ok) && (
              <Notice tone="success" icon={CheckCircle2} title="Alle Schritte stimmen">
                {kind === 'equation' ? 'Prüfe noch, ob deine letzte Zeile die Lösung klar angibt (z. B. x = 4).' : 'Jede Umformung ist gleichwertig zum Ausgangsterm.'}
              </Notice>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Plotter() {
  const [fns, setFns] = useState(['0.5x + 1', 'x^2 - 4', ''])
  const [range, setRange] = useState(6)
  const valid = fns.map((f) => !f.trim() || compileFunction(f) !== null)
  const table = useMemo(() => {
    const xs = [-3, -2, -1, 0, 1, 2, 3]
    return fns.map((f) => {
      const c = f.trim() ? compileFunction(f) : null
      return c ? xs.map((x) => c(x)) : null
    })
  }, [fns])
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-3">
        {fns.map((f, i) => (
          <Field key={i} label={<span className="inline-flex items-center gap-2"><span className="inline-block size-2.5 rounded-full" style={{ background: PLOT_COLORS[i] }} /> f{i + 1}(x) =</span>} htmlFor={`fn-${i}`} error={valid[i] ? null : 'Nicht lesbar – nur x als Variable verwenden.'}>
            <Input id={`fn-${i}`} value={f} onChange={(e) => setFns((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} className="font-mono" placeholder={i === 2 ? 'optional, z. B. (x-1)^2 + 2' : ''} />
          </Field>
        ))}
        <Field label="Bereich" htmlFor="fn-range">
          <Segmented label="Bereich" value={range} onChange={setRange} options={[3, 6, 10, 20].map((r) => ({ value: r, label: `±${r}` }))} />
        </Field>
        <p className="text-xs text-fg-subtle">Schreibweise: 0.5x + 1, x^2, sqrt(x), (x-2)^2 + 1. Komma als Dezimaltrenner geht auch.</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <FunctionPlot functions={fns} xMin={-range} xMax={range} yMin={-range} yMax={range} />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular">
            <thead><tr className="bg-surface-2 text-left"><th className="px-3 py-1.5 font-medium">x</th>{[-3, -2, -1, 0, 1, 2, 3].map((x) => <th key={x} className="px-3 py-1.5 font-medium">{x}</th>)}</tr></thead>
            <tbody>
              {table.map((row, i) => row && (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-1.5" style={{ color: PLOT_COLORS[i] }}>f{i + 1}</td>
                  {row.map((v, j) => <td key={j} className="px-3 py-1.5">{v === null ? '–' : Math.round(v * 100) / 100}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
