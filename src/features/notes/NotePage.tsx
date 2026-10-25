import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Eye, Layers, MessagesSquare, Pencil, Save, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import { deleteNote, saveNote, ValidationError } from '@/db/repo'
import { formatDateTime } from '@/lib/dates'
import { extractDefinitions } from '@/lib/docs/structure'
import { Button, ButtonLink, Card, Field, Input, LoadingBlock, Notice, Segmented, Select, Textarea, useConfirm, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useSubjects } from '@/hooks/data'
import { GenerateCardsDialog } from '@/features/flashcards/GenerateCardsDialog'

export default function NotePage() {
  const { noteId } = useParams()
  const isNew = noteId === 'neu'
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const subjects = useSubjects()
  const note = useLiveQuery(async () => (isNew ? null : ((await db.notes.get(noteId ?? '')) ?? null)), [noteId])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [tags, setTags] = useState('')
  const [view, setView] = useState<'edit' | 'preview'>(isNew ? 'edit' : 'preview')
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardsOpen, setCardsOpen] = useState(false)
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])
  const source = useLiveQuery(() => (note?.sourceMaterialId ? db.materials.get(note.sourceMaterialId) : undefined), [note?.sourceMaterialId])

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setSubjectId(note.subjectId ?? '')
      setTopicId(note.topicId ?? '')
      setTags(note.tags.join(', '))
      setDirty(false)
    } else if (isNew) {
      setSubjectId(params.get('subject') ?? '')
      setTopicId(params.get('topic') ?? '')
    }
  }, [note, isNew, params])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const defs = useMemo(() => extractDefinitions(content), [content])

  const save = async () => {
    try {
      const id = await saveNote({ id: isNew ? undefined : noteId, title, content, subjectId: subjectId || null, topicId: topicId || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
      setDirty(false)
      setError(null)
      toast({ title: 'Notiz gespeichert', tone: 'success' })
      if (isNew) navigate(`/bibliothek/notiz/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }
  const remove = async () => {
    if (!noteId || isNew) return
    if (await confirm({ title: 'Notiz löschen?', message: `„${title}“ wird endgültig gelöscht.` })) {
      await deleteNote(noteId)
      navigate('/bibliothek')
    }
  }

  if (note === undefined || !subjects) return <LoadingBlock />
  if (!isNew && !note) return <Notice tone="warn" title="Notiz nicht gefunden" />
  const mark = () => setDirty(true)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/bibliothek" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Bibliothek
        </Link>
        <div className="flex flex-wrap gap-2">
          <Segmented size="sm" label="Ansicht" value={view} onChange={setView} options={[{ value: 'edit', label: <span className="inline-flex items-center gap-1"><Pencil className="size-3.5" /> Bearbeiten</span> }, { value: 'preview', label: <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> Ansehen</span> }]} />
          <Button variant="primary" size="sm" icon={Save} onClick={save} disabled={!dirty && !isNew}>
            Speichern
          </Button>
        </div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {view === 'edit' ? (
        <Card className="flex flex-col gap-4 p-5">
          <Field label="Titel" htmlFor="note-title">
            <Input id="note-title" value={title} onChange={(e) => { setTitle(e.target.value); mark() }} maxLength={150} placeholder="z. B. Merkzettel Potenzgesetze" autoFocus={isNew} />
          </Field>
          <Field label="Inhalt" htmlFor="note-content" hint="Markdown: # Überschrift, **fett**, - Liste. Formeln: $a^2 + b^2 = c^2$. Tipp: „Begriff: Erklärung“-Zeilen lassen sich in Karteikarten umwandeln.">
            <Textarea id="note-content" value={content} onChange={(e) => { setContent(e.target.value); mark() }} rows={16} className="font-mono text-sm" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Fach" htmlFor="note-subject">
              <Select id="note-subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); mark() }}>
                <option value="">– ohne –</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Thema" htmlFor="note-topic">
              <Select id="note-topic" value={topicId} onChange={(e) => { setTopicId(e.target.value); mark() }} disabled={!subjectId}>
                <option value="">– ohne –</option>
                {topics?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Schlagwörter" htmlFor="note-tags" optional>
              <Input id="note-tags" value={tags} onChange={(e) => { setTags(e.target.value); mark() }} placeholder="Merkzettel, Formel" />
            </Field>
          </div>
        </Card>
      ) : (
        <article className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{title || 'Ohne Titel'}</h1>
          <div className="text-xs text-fg-subtle">
            {note && <>Zuletzt geändert {formatDateTime(note.updatedAt)}</>}
            {source && (
              <> · Quelle: <Link className="text-accent underline" to={`/bibliothek/material/${source.id}`}>{source.title}</Link></>
            )}
          </div>
          {content.trim() ? <Markdown className="leading-relaxed">{content}</Markdown> : <p className="text-fg-muted">Diese Notiz ist leer.</p>}
        </article>
      )}
      {!isNew && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" icon={Layers} onClick={() => setCardsOpen(true)} disabled={defs.length === 0} title={defs.length === 0 ? 'Keine „Begriff: Erklärung“-Zeilen gefunden' : undefined}>
            Karteikarten erstellen ({defs.length})
          </Button>
          <ButtonLink size="sm" icon={MessagesSquare} to={`/tutor?note=${noteId}${subjectId ? `&subject=${subjectId}` : ''}${topicId ? `&topic=${topicId}` : ''}`}>
            Mit dem Tutor besprechen
          </ButtonLink>
          <Button size="sm" variant="danger" icon={Trash2} onClick={remove} className="ml-auto">
            Löschen
          </Button>
        </div>
      )}
      <GenerateCardsDialog open={cardsOpen} onClose={() => setCardsOpen(false)} initial={defs.map((d) => ({ front: d.term, back: d.definition, example: '' }))} subjectId={subjectId || null} topicId={topicId || null} sourceMaterialId={note?.sourceMaterialId ?? null} sourceLabel="Erkannt aus deiner Notiz („Begriff: Erklärung“). Prüfe und bearbeite die Karten vor dem Speichern." />
    </div>
  )
}
