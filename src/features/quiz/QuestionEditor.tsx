import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Difficulty, Question, QuestionType } from '@/db/types'
import { saveQuestion, ValidationError } from '@/db/repo'
import { checkAnswer } from '@/lib/answerCheck'
import { Button, Dialog, Field, IconButton, Input, Notice, Select, Textarea, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { TYPE_LABELS } from './QuestionView'

interface Draft {
  type: QuestionType
  prompt: string
  options: string[]
  optionFeedback: string[]
  correctIndex: number
  correctBool: boolean
  answer: string
  accepted: string
  keywords: string
  unit: string
  tolerance: string
  requireForm: '' | NonNullable<Question['requireForm']>
  explanation: string
  hints: string
  difficulty: Difficulty
  points: number
}

const empty = (): Draft => ({ type: 'mc', prompt: '', options: ['', '', '', ''], optionFeedback: ['', '', '', ''], correctIndex: 0, correctBool: true, answer: '', accepted: '', keywords: '', unit: '', tolerance: '', requireForm: '', explanation: '', hints: '', difficulty: 2, points: 1 })

function toDraft(q: Question): Draft {
  return {
    type: q.type, prompt: q.prompt, options: q.options ?? ['', '', '', ''], optionFeedback: q.optionFeedback ?? (q.options ?? ['', '', '', '']).map(() => ''),
    correctIndex: q.correctIndex ?? 0, correctBool: q.correctBool ?? true, answer: q.answer, accepted: (q.acceptedAnswers ?? []).join('; '),
    keywords: (q.keywords ?? []).map((g) => g.join(' | ')).join(', '), unit: q.unit ?? '', tolerance: q.tolerance !== undefined ? String(q.tolerance) : '',
    requireForm: q.requireForm ?? '', explanation: q.explanation, hints: q.hints.join('\n'), difficulty: q.difficulty, points: q.points,
  }
}

/** Create or edit a question of any type. A live test field shows how an answer would be checked. */
export function QuestionEditor({ open, onClose, subjectId, topicId, question }: { open: boolean; onClose: () => void; subjectId: string; topicId: string; question?: Question }) {
  const [d, setD] = useState<Draft>(empty)
  const [error, setError] = useState<string | null>(null)
  const [test, setTest] = useState('')
  const toast = useToast()
  useEffect(() => {
    if (open) {
      setD(question ? toDraft(question) : empty())
      setError(null)
      setTest('')
    }
  }, [open, question])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const build = (): Omit<Question, 'id' | 'createdAt'> & { id?: string } => {
    const options = d.options.map((o) => o.trim())
    const keep = options.map((o, i) => ({ o, f: d.optionFeedback[i] ?? '', i })).filter((x) => x.o)
    const correctIndex = keep.findIndex((x) => x.i === d.correctIndex)
    return {
      id: question?.id, subjectId, topicId, type: d.type, prompt: d.prompt.trim(),
      options: d.type === 'mc' ? keep.map((x) => x.o) : undefined,
      optionFeedback: d.type === 'mc' && keep.some((x) => x.f.trim()) ? keep.map((x) => x.f.trim()) : undefined,
      correctIndex: d.type === 'mc' ? correctIndex : undefined,
      correctBool: d.type === 'tf' ? d.correctBool : undefined,
      answer: d.type === 'mc' ? keep[correctIndex]?.o ?? '' : d.type === 'tf' ? (d.correctBool ? 'Wahr' : 'Falsch') : d.answer.trim().replace(/,(\d)/g, d.type === 'numeric' ? '.$1' : ',$1'),
      acceptedAnswers: d.accepted.trim() ? d.accepted.split(';').map((s) => s.trim()).filter(Boolean) : undefined,
      keywords: d.type === 'text' && d.keywords.trim() ? d.keywords.split(',').map((g) => g.split('|').map((k) => k.trim()).filter(Boolean)).filter((g) => g.length) : undefined,
      unit: d.type === 'numeric' && d.unit.trim() ? d.unit.trim() : undefined,
      tolerance: d.type === 'numeric' && d.tolerance.trim() ? Number(d.tolerance.replace(',', '.')) : undefined,
      requireForm: d.type === 'math' && d.requireForm ? d.requireForm : undefined,
      explanation: d.explanation.trim(), hints: d.hints.split('\n').map((h) => h.trim()).filter(Boolean),
      difficulty: d.difficulty, points: Math.max(0.5, d.points), source: question?.source ?? 'user', sourceMaterialId: question?.sourceMaterialId ?? null,
      skill: question?.skill, steps: question?.steps, stepCheck: question?.stepCheck,
    }
  }
  const save = async () => {
    try {
      if (d.type === 'mc' && d.options.filter((o) => o.trim()).length >= 2 && !d.options[d.correctIndex]?.trim()) throw new ValidationError('Die als richtig markierte Antwort ist leer.')
      await saveQuestion(build())
      toast({ title: question ? 'Frage gespeichert' : 'Frage angelegt', tone: 'success' })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  let testResult: string | null = null
  if (test.trim() && d.prompt.trim()) {
    try {
      const r = checkAnswer({ ...build(), id: 'test', createdAt: '' } as Question, test)
      testResult = `${r.status === 'correct' ? 'Richtig' : r.status === 'partial' ? 'Teilweise richtig' : r.status === 'unreadable' ? 'Nicht lesbar' : r.status === 'self-assess' ? 'Selbstbewertung nötig' : 'Falsch'} – ${r.feedback}`
    } catch {
      testResult = null
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={question ? 'Frage bearbeiten' : 'Neue Frage'}
      description={question?.source === 'library' ? 'Beispielaufgabe – deine Änderungen werden gespeichert.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save}>Speichern</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fragetyp" htmlFor="qe-type">
            <Select id="qe-type" value={d.type} onChange={(e) => set('type', e.target.value as QuestionType)}>
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="Schwierigkeit" htmlFor="qe-diff">
            <Select id="qe-diff" value={d.difficulty} onChange={(e) => set('difficulty', Number(e.target.value) as Difficulty)}>
              <option value={1}>1 – leicht</option>
              <option value={2}>2 – mittel</option>
              <option value={3}>3 – schwer</option>
              <option value={4}>4 – Fortgeschritten</option>
            </Select>
          </Field>
          <Field label="Punkte" htmlFor="qe-points">
            <Input id="qe-points" type="number" min={0.5} step={0.5} value={d.points} onChange={(e) => set('points', Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Frage" htmlFor="qe-prompt" hint="Markdown und Formeln mit $…$ möglich, z. B. $\frac{3}{4}$ oder $x^2$.">
          <Textarea id="qe-prompt" value={d.prompt} onChange={(e) => set('prompt', e.target.value)} rows={3} />
        </Field>
        {d.prompt.includes('$') && (
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <div className="eyebrow mb-1">Vorschau</div>
            <Markdown>{d.prompt}</Markdown>
          </div>
        )}

        {d.type === 'mc' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Antworten – markiere die richtige</legend>
            {d.options.map((o, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border border-border p-2">
                <div className="flex items-center gap-2">
                  <input type="radio" name="qe-correct" aria-label={`Antwort ${i + 1} ist richtig`} checked={d.correctIndex === i} onChange={() => set('correctIndex', i)} className="size-4 accent-[var(--accent-solid)]" />
                  <Input value={o} onChange={(e) => set('options', d.options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Antwort ${i + 1}`} aria-label={`Antwort ${i + 1}`} className="h-9" />
                  {d.options.length > 2 && <IconButton label="Antwort entfernen" icon={Trash2} size="sm" onClick={() => { set('options', d.options.filter((_, j) => j !== i)); set('optionFeedback', d.optionFeedback.filter((_, j) => j !== i)); if (d.correctIndex >= i && d.correctIndex > 0) set('correctIndex', d.correctIndex - 1) }} />}
                </div>
                <Input value={d.optionFeedback[i] ?? ''} onChange={(e) => set('optionFeedback', d.options.map((_, j) => (j === i ? e.target.value : d.optionFeedback[j] ?? '')))} placeholder={d.correctIndex === i ? 'Optional: Warum ist das richtig?' : 'Optional: Welcher Denkfehler steckt hinter dieser Antwort?'} aria-label={`Erklärung zu Antwort ${i + 1}`} className="h-8 text-sm" />
              </div>
            ))}
            {d.options.length < 6 && <Button size="sm" variant="ghost" icon={Plus} onClick={() => { set('options', [...d.options, '']); set('optionFeedback', [...d.optionFeedback, '']) }}>Antwort hinzufügen</Button>}
          </fieldset>
        )}
        {d.type === 'tf' && (
          <Field label="Die Aussage ist …" htmlFor="qe-tf">
            <Select id="qe-tf" value={String(d.correctBool)} onChange={(e) => set('correctBool', e.target.value === 'true')}>
              <option value="true">wahr</option>
              <option value="false">falsch</option>
            </Select>
          </Field>
        )}
        {['text', 'numeric', 'math', 'vocab'].includes(d.type) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={d.type === 'text' ? 'Musterlösung' : 'Lösung'} htmlFor="qe-answer" hint={d.type === 'math' ? 'z. B. x = 4, 3/4, x^2 + 2x. Zwei Lösungen: x = 2; x = -3. Gleichungssystem: x = 1; y = 2' : d.type === 'vocab' ? 'Mehrere Bedeutungen mit ; trennen, optionale Teile in Klammern: (sich) freuen' : undefined}>
              {d.type === 'text' ? <Textarea id="qe-answer" value={d.answer} onChange={(e) => set('answer', e.target.value)} rows={2} /> : <Input id="qe-answer" value={d.answer} onChange={(e) => set('answer', e.target.value)} className={d.type === 'math' ? 'font-mono' : ''} />}
            </Field>
            {d.type === 'text' && (
              <Field label="Schlüsselwörter" htmlFor="qe-kw" optional hint="Gruppen mit Komma trennen, gleichwertige Wörter mit |. Beispiel: Licht | Sonne, Glucose | Zucker">
                <Input id="qe-kw" value={d.keywords} onChange={(e) => set('keywords', e.target.value)} />
              </Field>
            )}
            {d.type === 'numeric' && (
              <>
                <Field label="Einheit" htmlFor="qe-unit" optional>
                  <Input id="qe-unit" value={d.unit} onChange={(e) => set('unit', e.target.value)} placeholder="z. B. cm²" />
                </Field>
                <Field label="Erlaubte Abweichung" htmlFor="qe-tol" optional hint="Leer = nach Nachkommastellen der Lösung">
                  <Input id="qe-tol" value={d.tolerance} onChange={(e) => set('tolerance', e.target.value)} placeholder="z. B. 0,1" />
                </Field>
              </>
            )}
            {d.type === 'math' && (
              <Field label="Verlangte Form" htmlFor="qe-form" hint="Nur wählen, wenn die Aufgabe genau das verlangt.">
                <Select id="qe-form" value={d.requireForm} onChange={(e) => set('requireForm', e.target.value as Draft['requireForm'])}>
                  <option value="">Jede gleichwertige Form</option>
                  <option value="simplified-fraction">Vollständig gekürzter Bruch</option>
                  <option value="expanded">Ausmultipliziert</option>
                  <option value="factored">Faktorisiert (ausgeklammert)</option>
                  <option value="simplified">Vereinfacht</option>
                </Select>
              </Field>
            )}
            {(d.type === 'text' || d.type === 'vocab') && (
              <Field label="Weitere akzeptierte Antworten" htmlFor="qe-acc" optional hint="Mit ; trennen">
                <Input id="qe-acc" value={d.accepted} onChange={(e) => set('accepted', e.target.value)} />
              </Field>
            )}
          </div>
        )}
        <Field label="Erklärung" htmlFor="qe-expl" hint="Wird nach dem Beantworten gezeigt: Warum ist die Lösung richtig?">
          <Textarea id="qe-expl" value={d.explanation} onChange={(e) => set('explanation', e.target.value)} rows={2} />
        </Field>
        <Field label="Hinweise" htmlFor="qe-hints" optional hint="Ein Hinweis pro Zeile – vom kleinsten Tipp zum größten. Verrate nicht direkt die Lösung.">
          <Textarea id="qe-hints" value={d.hints} onChange={(e) => set('hints', e.target.value)} rows={2} />
        </Field>
        {['text', 'numeric', 'math', 'vocab'].includes(d.type) && (
          <Field label="Testen: Wie würde eine Antwort bewertet?" htmlFor="qe-test" optional>
            <Input id="qe-test" value={test} onChange={(e) => setTest(e.target.value)} placeholder="Probeantwort eingeben" />
            {testResult && <p className="text-sm text-fg-muted">{testResult}</p>}
          </Field>
        )}
      </div>
    </Dialog>
  )
}
