import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Download, FileText, Layers, ListChecks, MessagesSquare, MoreHorizontal, NotebookPen, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import type { Question } from '@/db/types'
import { deleteMaterial, saveNote, saveQuestion, updateMaterial } from '@/db/repo'
import { extractDefinitions, extractSections, extractiveSummary, keyConcepts, questionsFromDefinitions } from '@/lib/docs/structure'
import { formatDateTime } from '@/lib/dates'
import { generate, AiError } from '@/lib/ai/client'
import { saveFile } from '@/lib/download'
import { Badge, Button, Card, Checkbox, Dialog, Field, Input, LoadingBlock, Menu, Notice, SectionHeader, Select, Textarea, useConfirm, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useAi, useProfile, useSubjects } from '@/hooks/data'
import { GenerateCardsDialog } from '@/features/flashcards/GenerateCardsDialog'
import type { CardInput } from '@/db/repo'
import { fromGenerated } from '@/features/quiz/convert'
import { TYPE_LABELS } from '@/features/quiz/QuestionView'
import { STATUS_LABEL } from './LibraryPage'

const METHOD_LABEL = { 'pdf-text': 'PDF-Textebene', 'pdf-ocr': 'PDF + Texterkennung', 'image-ocr': 'Texterkennung (OCR)', 'ai-vision': 'KI-Abschrift', 'plain-text': 'Textdatei', paste: 'Eingefügt' }
const MAX_AI_CHARS = 50_000

export default function MaterialPage() {
  const { materialId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const ai = useAi()
  const profile = useProfile()
  const subjects = useSubjects()
  const m = useLiveQuery(async () => (await db.materials.get(materialId ?? '')) ?? null, [materialId])
  const topics = useLiveQuery(() => (m?.subjectId ? db.topics.where('subjectId').equals(m.subjectId).sortBy('order') : db.topics.limit(0).toArray()), [m?.subjectId])
  const generatedCount = useLiveQuery(async () => ({
    cards: await db.cards.filter((c) => c.sourceMaterialId === materialId).count(),
    questions: await db.questions.filter((q) => q.sourceMaterialId === materialId).count(),
  }), [materialId])
  const [editMeta, setEditMeta] = useState(false)
  const [editText, setEditText] = useState<string | null>(null)
  const [cards, setCards] = useState<{ items: CardInput[]; label: string } | null>(null)
  const [questions, setQuestions] = useState<{ items: (Omit<Question, 'id' | 'createdAt'> & { keep: boolean })[]; label: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const defs = useMemo(() => (m ? extractDefinitions(m.text) : []), [m])
  const concepts = useMemo(() => (m ? keyConcepts(m.text) : []), [m])

  if (m === undefined || !subjects) return <LoadingBlock />
  if (!m) return <Notice tone="warn" title="Material nicht gefunden" />
  const tooLong = m.text.length > MAX_AI_CHARS
  const aiText = m.text.slice(0, MAX_AI_CHARS)
  const subject = subjects.find((s) => s.id === m.subjectId)

  const aiSummary = async () => {
    setBusy('summary')
    try {
      const { result, provider } = await generate({ task: 'summary', title: m.title, text: aiText, grade: profile?.grade ?? 9 })
      const extra = result.notInMaterial.length ? `\n\n**Lücken/Unklarheiten im Material:** ${result.notInMaterial.join('; ')}` : ''
      await updateMaterial(m.id, { summary: `${result.summary}${extra}\n\n_Erstellt von ${provider}${tooLong ? ' – nur aus den ersten 50.000 Zeichen' : ''}._`, summarySource: 'ai' })
      toast({ title: 'KI-Zusammenfassung erstellt', tone: 'success' })
    } catch (e) {
      toast({ title: 'KI-Anfrage fehlgeschlagen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }
  const cardsHeuristic = () => setCards({ items: defs.map((d) => ({ front: d.term, back: d.definition, example: '' })), label: 'Automatisch erkannt aus „Begriff: Erklärung“- und „X ist …“-Sätzen (ohne KI). Prüfe jede Karte – die Erkennung ist eine Schätzung.' })
  const cardsAi = async () => {
    setBusy('cards')
    try {
      const { result, provider } = await generate({ task: 'flashcards', title: m.title, text: aiText, count: 20, grade: profile?.grade ?? 9 })
      setCards({ items: result.cards, label: `Von der KI (${provider}) aus deinem Material erstellt. KI kann Fehler machen – prüfe jede Karte.` })
    } catch (e) {
      toast({ title: 'KI-Anfrage fehlgeschlagen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }
  const needsTopic = !m.subjectId || !m.topicId
  const questionsHeuristic = () => {
    if (needsTopic) return setEditMeta(true)
    const drafts = questionsFromDefinitions(defs)
    setQuestions({
      label: 'Automatisch aus erkannten Begriffen erstellt (ohne KI). Prüfe jede Frage.',
      items: drafts.map((d) => ({ subjectId: m.subjectId!, topicId: m.topicId!, type: d.type, prompt: d.prompt, answer: d.answer, options: d.options, correctIndex: d.correctIndex, keywords: d.keywords, explanation: d.explanation, hints: [], difficulty: 2, points: 1, source: 'material', sourceMaterialId: m.id, keep: true })),
    })
  }
  const questionsAi = async () => {
    if (needsTopic) return setEditMeta(true)
    setBusy('questions')
    try {
      const { result, provider } = await generate({ task: 'questions', title: m.title, text: aiText, count: 10, grade: profile?.grade ?? 9, subject: subject?.name ?? null })
      const items = result.questions.map((g) => fromGenerated(g, { subjectId: m.subjectId!, topicId: m.topicId!, source: 'ai', sourceMaterialId: m.id })).filter((x): x is NonNullable<typeof x> => !!x)
      setQuestions({ label: `Von der KI (${provider}) aus deinem Material erstellt. Prüfe Fragen und Lösungen.`, items: items.map((i) => ({ ...i, keep: true })) })
    } catch (e) {
      toast({ title: 'KI-Anfrage fehlgeschlagen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(null)
    }
  }
  const saveAsNote = async () => {
    const id = await saveNote({ title: m.title, content: m.summary ? `${m.summary}\n\n---\n\n${m.text}` : m.text, subjectId: m.subjectId, topicId: m.topicId, tags: m.tags, sourceMaterialId: m.id })
    navigate(`/bibliothek/notiz/${id}`)
  }
  const download = async () => {
    const b = await db.materialBlobs.get(m.id)
    if (b) await saveFile(m.fileName ?? m.title, b.blob, b.blob.type)
  }
  const remove = async () => {
    if (await confirm({ title: `„${m.title}“ löschen?`, message: 'Das Material und die gespeicherte Originaldatei werden gelöscht. Daraus erstellte Karten, Fragen und Notizen bleiben erhalten.' })) {
      await deleteMaterial(m.id)
      navigate('/bibliothek')
    }
  }
  const saveText = async () => {
    if (editText === null) return
    const sections = extractSections(editText)
    await updateMaterial(m.id, { text: editText, sections, summary: m.summarySource === 'ai' ? m.summary : extractiveSummary(sections), summarySource: m.summarySource === 'ai' ? 'ai' : 'extractive', extraction: { ...m.extraction, warnings: [...m.extraction.warnings.filter((w) => !w.includes('von dir bearbeitet')), 'Der Text wurde von dir bearbeitet.'] } })
    setEditText(null)
    toast({ title: 'Text gespeichert', tone: 'success' })
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/bibliothek" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Bibliothek
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow mb-1 flex flex-wrap items-center gap-2">
            <FileText className="size-3.5" /> {m.fileName ?? 'Text'} · {formatDateTime(m.createdAt)}
          </div>
          <h1 className="text-2xl font-semibold">{m.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={STATUS_LABEL[m.extraction.status].tone}>{STATUS_LABEL[m.extraction.status].label}</Badge>
            <Badge>{METHOD_LABEL[m.extraction.method]}</Badge>
            {subject ? <Badge>{subject.name}{topics?.find((t) => t.id === m.topicId) ? ` · ${topics.find((t) => t.id === m.topicId)!.name}` : ''}</Badge> : <Badge tone="warn">Keinem Fach zugeordnet</Badge>}
            {m.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        </div>
        <Menu label="Aktionen" icon={MoreHorizontal} items={[
          { label: 'Fach, Thema, Titel ändern', icon: Pencil, onSelect: () => setEditMeta(true) },
          { label: 'Text bearbeiten', icon: Pencil, onSelect: () => setEditText(m.text) },
          { label: 'Originaldatei speichern', icon: Download, onSelect: download, disabled: !m.hasBlob },
          { label: 'Als Notiz übernehmen', icon: NotebookPen, onSelect: saveAsNote, disabled: !m.text },
          { label: 'Löschen', icon: Trash2, danger: true, onSelect: remove },
        ]} />
      </header>

      {m.extraction.warnings.length > 0 && (
        <div className="flex flex-col gap-2">{m.extraction.warnings.map((w, i) => <Notice key={i} tone={m.extraction.status === 'complete' ? 'neutral' : 'warn'}>{w}</Notice>)}</div>
      )}

      {m.text.trim() && (
        <section aria-labelledby="gen">
          <SectionHeader id="gen" title="Lernmaterial daraus erstellen" description={`Alles wird dir vor dem Speichern zur Prüfung gezeigt.${generatedCount ? ` Bisher erstellt: ${generatedCount.cards} Karten, ${generatedCount.questions} Fragen.` : ''}`} />
          {tooLong && ai?.ok && <Notice tone="warn" className="mb-3">Das Material ist sehr lang. Die KI verarbeitet nur die ersten 50.000 Zeichen – der Rest wird nicht berücksichtigt.</Notice>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="flex flex-col gap-2 p-4">
              <Layers className="size-5 text-accent" aria-hidden />
              <div className="font-medium">Karteikarten</div>
              <p className="text-sm text-fg-muted">{defs.length} Begriffe erkannt.</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={cardsHeuristic} disabled={defs.length === 0}>Ohne KI</Button>
                {ai?.ok && <Button size="sm" variant="soft" icon={Sparkles} onClick={cardsAi} loading={busy === 'cards'}>Mit KI</Button>}
              </div>
            </Card>
            <Card className="flex flex-col gap-2 p-4">
              <ListChecks className="size-5 text-accent" aria-hidden />
              <div className="font-medium">Übungsfragen</div>
              <p className="text-sm text-fg-muted">{needsTopic ? 'Ordne zuerst Fach und Thema zu.' : `Für das Thema „${topics?.find((t) => t.id === m.topicId)?.name ?? ''}“.`}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={questionsHeuristic} disabled={defs.length === 0 && !needsTopic}>Ohne KI</Button>
                {ai?.ok && <Button size="sm" variant="soft" icon={Sparkles} onClick={questionsAi} loading={busy === 'questions'}>Mit KI</Button>}
              </div>
            </Card>
            <Card className="flex flex-col gap-2 p-4">
              <MessagesSquare className="size-5 text-accent" aria-hidden />
              <div className="font-medium">Mit dem Tutor besprechen</div>
              <p className="text-sm text-fg-muted">Fragen zum Inhalt stellen – der Tutor trennt Material und Zusatzerklärung.</p>
              <div className="mt-auto pt-1">
                <Button size="sm" onClick={() => navigate(`/tutor?material=${m.id}${m.subjectId ? `&subject=${m.subjectId}` : ''}${m.topicId ? `&topic=${m.topicId}` : ''}`)}>Zum Tutor</Button>
              </div>
            </Card>
          </div>
          {!ai?.ok && <p className="mt-2 text-xs text-fg-subtle">Ohne KI werden nur klar erkennbare Definitionen genutzt. Mit einem KI-Anbieter (Einstellungen) sind bessere Vorschläge möglich.</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-2" aria-labelledby="summary">
          <SectionHeader id="summary" title="Zusammenfassung" action={ai?.ok && m.text.trim() && <Button size="sm" variant="ghost" icon={Sparkles} onClick={aiSummary} loading={busy === 'summary'}>Mit KI</Button>} />
          <Card className="p-4">
            {m.summary ? (
              <>
                <p className="mb-2 text-xs text-fg-subtle">{m.summarySource === 'ai' ? 'KI-Zusammenfassung – nur aus deinem Material erstellt, trotzdem prüfen.' : 'Automatischer Auszug: jeweils der erste Satz jedes Abschnitts, ohne KI.'}</p>
                <Markdown className="text-sm">{m.summary}</Markdown>
              </>
            ) : (
              <p className="text-sm text-fg-muted">Keine Zusammenfassung vorhanden.</p>
            )}
            {concepts.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="eyebrow mb-1.5">Häufige Begriffe</div>
                <div className="flex flex-wrap gap-1.5">{concepts.map((c) => <Badge key={c}>{c}</Badge>)}</div>
              </div>
            )}
          </Card>
        </section>
        <section className="min-w-0 lg:col-span-3" aria-labelledby="fulltext">
          <SectionHeader id="fulltext" title="Text" description={`${m.text.length.toLocaleString('de-DE')} Zeichen · ${m.sections.length} Abschnitte`} action={editText === null && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditText(m.text)}>Bearbeiten</Button>} />
          {editText !== null ? (
            <div className="flex flex-col gap-2">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={20} className="font-mono text-sm" aria-label="Text bearbeiten" />
              <div className="flex justify-end gap-2">
                <Button onClick={() => setEditText(null)}>Abbrechen</Button>
                <Button variant="primary" onClick={saveText}>Speichern</Button>
              </div>
            </div>
          ) : m.text.trim() ? (
            <Card className="flex flex-col gap-4 p-4">
              {m.sections.map((s, i) => (
                <div key={i}>
                  {s.heading && <h3 className="mb-1 text-sm font-semibold">{s.heading}</h3>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{s.text}</p>
                </div>
              ))}
            </Card>
          ) : (
            <Notice tone="warn">Kein Text vorhanden. Du kannst den Text über „Bearbeiten“ selbst eintragen.</Notice>
          )}
        </section>
      </div>

      <MetaDialog open={editMeta} onClose={() => setEditMeta(false)} materialId={m.id} />
      {cards && <GenerateCardsDialog open={!!cards} onClose={() => setCards(null)} initial={cards.items} subjectId={m.subjectId} topicId={m.topicId} sourceMaterialId={m.id} sourceLabel={cards.label} defaultDeckName={m.title} />}
      <Dialog
        open={!!questions}
        onClose={() => setQuestions(null)}
        size="lg"
        title="Übungsfragen prüfen"
        footer={<><Button onClick={() => setQuestions(null)}>Abbrechen</Button><Button variant="primary" disabled={!questions?.items.some((q) => q.keep)} onClick={async () => { const keep = questions!.items.filter((q) => q.keep); for (const { keep: _k, ...q } of keep) await saveQuestion(q); toast({ title: `${keep.length} Fragen gespeichert`, tone: 'success' }); setQuestions(null) }}>{questions?.items.filter((q) => q.keep).length ?? 0} speichern</Button></>}
      >
        {questions && (
          <div className="flex flex-col gap-3">
            <Notice>{questions.label}</Notice>
            {questions.items.length === 0 && <p className="text-sm text-fg-muted">Keine verwendbaren Fragen gefunden.</p>}
            {questions.items.map((q, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <Checkbox checked={q.keep} onChange={(v) => setQuestions((s) => s && { ...s, items: s.items.map((x, j) => (j === i ? { ...x, keep: v } : x)) })} label={<Badge>{TYPE_LABELS[q.type]}</Badge>} />
                <Markdown className="mt-1 text-sm">{q.prompt}</Markdown>
                {q.options && <ul className="mt-1 list-disc pl-5 text-sm">{q.options.map((o, k) => <li key={k} className={k === q.correctIndex ? 'font-medium text-success' : 'text-fg-muted'}>{o}</li>)}</ul>}
                {q.type !== 'mc' && <p className="mt-1 text-sm"><span className="text-fg-subtle">Lösung:</span> {q.answer}</p>}
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  )
}

function MetaDialog({ open, onClose, materialId }: { open: boolean; onClose: () => void; materialId: string }) {
  const m = useLiveQuery(async () => (await db.materials.get(materialId)) ?? null, [materialId])
  const subjects = useSubjects()
  const [title, setTitle] = useState<string | null>(null)
  const [sid, setSid] = useState<string | null>(null)
  const [tid, setTid] = useState<string | null>(null)
  const [tags, setTags] = useState<string | null>(null)
  const subjectId = sid ?? m?.subjectId ?? ''
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])
  if (!m) return null
  const close = () => {
    setTitle(null); setSid(null); setTid(null); setTags(null)
    onClose()
  }
  const save = async () => {
    await updateMaterial(m.id, { title: title ?? m.title, subjectId: subjectId || null, topicId: (tid ?? m.topicId) || null, tags: (tags ?? m.tags.join(', ')).split(',').map((t) => t.trim()).filter(Boolean) })
    close()
  }
  return (
    <Dialog open={open} onClose={close} title="Material zuordnen" footer={<><Button onClick={close}>Abbrechen</Button><Button variant="primary" onClick={save}>Speichern</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Titel" htmlFor="mm-title"><Input id="mm-title" value={title ?? m.title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fach" htmlFor="mm-subject">
            <Select id="mm-subject" value={subjectId} onChange={(e) => { setSid(e.target.value); setTid('') }}>
              <option value="">– ohne –</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Thema" htmlFor="mm-topic">
            <Select id="mm-topic" value={tid ?? m.topicId ?? ''} onChange={(e) => setTid(e.target.value)} disabled={!subjectId}>
              <option value="">– ohne –</option>
              {topics?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Schlagwörter" htmlFor="mm-tags" optional><Input id="mm-tags" value={tags ?? m.tags.join(', ')} onChange={(e) => setTags(e.target.value)} /></Field>
      </div>
    </Dialog>
  )
}
