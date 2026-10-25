import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkles } from 'lucide-react'
import { db } from '@/db/index'
import { saveQuestion } from '@/db/repo'
import { generate, AiError } from '@/lib/ai/client'
import { Badge, Button, Checkbox, Dialog, Field, Notice, Select, Spinner, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useAi, useProfile } from '@/hooks/data'
import { fromGenerated } from './convert'
import { TYPE_LABELS } from './QuestionView'
import type { Question } from '@/db/types'

/** Lets the AI suggest practice questions for a topic. Nothing is saved before the student reviews it. */
export function AiPracticeDialog({ open, onClose, topicId }: { open: boolean; onClose: () => void; topicId: string }) {
  const ai = useAi()
  const toast = useToast()
  const profile = useProfile()
  const topic = useLiveQuery(async () => (await db.topics.get(topicId)) ?? null, [topicId])
  const subject = useLiveQuery(() => (topic ? db.subjects.get(topic.subjectId) : undefined), [topic])
  const [difficulty, setDifficulty] = useState(2)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<(Omit<Question, 'id' | 'createdAt'> & { keep: boolean })[] | null>(null)
  const [provider, setProvider] = useState('')

  const run = async () => {
    if (!topic || !subject) return
    setBusy(true)
    try {
      const { result, provider } = await generate({ task: 'practice', subject: subject.name, topic: topic.name, description: topic.description, count: 6, difficulty, grade: profile?.grade ?? 9 })
      const converted = result.questions.map((g) => fromGenerated(g, { subjectId: subject.id, topicId: topic.id, source: 'ai' })).filter((x): x is NonNullable<typeof x> => !!x)
      setItems(converted.map((c) => ({ ...c, keep: true })))
      setProvider(provider)
    } catch (e) {
      toast({ title: 'KI-Anfrage fehlgeschlagen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  const save = async () => {
    const keep = (items ?? []).filter((i) => i.keep)
    for (const { keep: _k, ...q } of keep) await saveQuestion(q)
    toast({ title: `${keep.length} Fragen gespeichert`, tone: 'success' })
    setItems(null)
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Übungsfragen von der KI vorschlagen lassen"
      description={topic ? `Thema: ${topic.name}` : undefined}
      footer={
        items ? (
          <>
            <Button onClick={() => setItems(null)}>Verwerfen</Button>
            <Button variant="primary" onClick={save} disabled={!items.some((i) => i.keep)}>
              {items.filter((i) => i.keep).length} Fragen speichern
            </Button>
          </>
        ) : (
          <Button variant="primary" icon={Sparkles} onClick={run} loading={busy} disabled={!ai?.ok}>
            Vorschläge erstellen
          </Button>
        )
      }
    >
      {!ai?.ok ? (
        <Notice tone="warn" title="Keine KI verfügbar">{ai?.detail ?? 'Prüfe …'}</Notice>
      ) : !items ? (
        <div className="flex flex-col gap-4">
          <Notice tone="neutral">KI-Vorschläge können Fehler enthalten. Du prüfst jede Frage, bevor sie gespeichert wird. Gespeicherte Fragen sind als „KI-erstellt“ markiert.</Notice>
          <Field label="Schwierigkeit" htmlFor="ai-diff">
            <Select id="ai-diff" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              <option value={1}>leicht</option>
              <option value={2}>mittel</option>
              <option value={3}>schwer</option>
              <option value={4}>für Fortgeschrittene</option>
            </Select>
          </Field>
          {busy && <Spinner label="Die KI erstellt Aufgaben …" />}
        </div>
      ) : items.length === 0 ? (
        <Notice tone="warn">Die KI hat keine verwendbaren Fragen geliefert. Versuche es erneut.</Notice>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-subtle">Erstellt von {provider}. Prüfe jede Frage und Lösung.</p>
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={it.keep} onChange={(v) => setItems((xs) => xs!.map((x, j) => (j === i ? { ...x, keep: v } : x)))} label={<Badge>{TYPE_LABELS[it.type]}</Badge>} />
              </div>
              <Markdown className="mt-1 text-sm">{it.prompt}</Markdown>
              {it.options && <ul className="mt-1 list-disc pl-5 text-sm text-fg-muted">{it.options.map((o, k) => <li key={k} className={k === it.correctIndex ? 'text-success font-medium' : ''}>{o}</li>)}</ul>}
              <p className="mt-1 text-sm"><span className="text-fg-subtle">Lösung:</span> {it.answer}</p>
              {it.explanation && <p className="mt-1 text-xs text-fg-muted">{it.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
