import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUp, BookOpen, FileText, History, Info, Plus, Search, Square, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import type { ChatMessage, ExplanationMode, TutorChat as Chat } from '@/db/types'
import { deleteChat, saveChat } from '@/db/repo'
import { tutorChat, AiError } from '@/lib/ai/client'
import { EXPLANATION_MODES } from '@/shared/ai'
import { excerpt, searchScore } from '@/lib/text'
import { uid, nowIso } from '@/lib/id'
import { formatDateTime } from '@/lib/dates'
import { Badge, Button, ButtonLink, Checkbox, cn, Dialog, IconButton, Notice, Select, Spinner, Textarea, useConfirm } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useAi, useProfile, useSubjects } from '@/hooks/data'

const MAX_CONTEXT_CHARS = 60_000

interface Props {
  subjectId?: string | null
  topicId?: string | null
  materialIds?: string[]
  noteId?: string | null
  compact?: boolean
}

/** Chat with the tutor. Works with any configured AI provider; without AI it searches the student's own material. */
export function TutorChat({ subjectId: initialSubject, topicId: initialTopic, materialIds: initialMaterials, noteId, compact }: Props) {
  const ai = useAi()
  const profile = useProfile()
  const subjects = useSubjects()
  const confirm = useConfirm()
  const [subjectId, setSubjectId] = useState(initialSubject ?? '')
  const [topicId, setTopicId] = useState(initialTopic ?? '')
  const [mode, setMode] = useState<ExplanationMode>('normal')
  const [materialIds, setMaterialIds] = useState<string[]>(initialMaterials ?? [])
  const [includeNote, setIncludeNote] = useState(!!noteId)
  const [chat, setChat] = useState<Chat | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const streamed = useRef('')
  const endRef = useRef<HTMLDivElement>(null)
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])
  const materials = useLiveQuery(() => db.materials.toArray(), [])
  const note = useLiveQuery(() => (noteId ? db.notes.get(noteId) : undefined), [noteId])
  const chats = useLiveQuery(() => db.tutorChats.orderBy('updatedAt').reverse().limit(30).toArray(), [])
  const notes = useLiveQuery(() => db.notes.toArray(), [])

  useEffect(() => {
    if (profile) setMode(profile.explanationMode)
  }, [profile])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [chat?.messages.length, streaming])

  const topic = topics?.find((t) => t.id === topicId)
  const subject = subjects?.find((s) => s.id === subjectId)
  const selectedMaterials = (materials ?? []).filter((m) => materialIds.includes(m.id))
  const context = useMemo(() => {
    const items = [...selectedMaterials.map((m) => ({ title: m.title, text: m.text })), ...(includeNote && note ? [{ title: `Notiz: ${note.title}`, text: note.content }] : [])].slice(0, 5)
    let budget = MAX_CONTEXT_CHARS
    let truncated = false
    const out = items.map((it) => {
      const t = it.text.slice(0, Math.max(0, budget))
      if (t.length < it.text.length) truncated = true
      budget -= t.length
      return { title: it.title, text: t }
    }).filter((x) => x.text.trim())
    return { items: out, truncated }
  }, [selectedMaterials, includeNote, note])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || streaming !== null) return
    setError(null)
    setInput('')
    const base: Chat = chat ?? { id: uid('chat'), subjectId: subjectId || null, topicId: topicId || null, title: content.slice(0, 60), mode, materialIds, messages: [], createdAt: nowIso(), updatedAt: nowIso() }
    const userMsg: ChatMessage = { role: 'user', content, at: nowIso() }
    const withUser = { ...base, mode, materialIds, messages: [...base.messages, userMsg] }
    setChat(withUser)
    await saveChat(withUser)
    if (!ai?.ok) return
    setStreaming('')
    streamed.current = ''
    abort.current = new AbortController()
    try {
      const { text: answer, provider } = await tutorChat(
        {
          mode,
          student: { grade: profile?.grade ?? 9, schoolType: profile?.schoolType ?? 'Gesamtschule', region: profile?.region ?? '' },
          subject: subject?.name ?? null,
          topic: topic ? `${topic.name}${topic.description ? ` (${topic.description})` : ''}` : null,
          materials: context.items,
          messages: withUser.messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        },
        (full) => {
          streamed.current = full
          setStreaming(full)
        },
        abort.current.signal,
      )
      const next = { ...withUser, messages: [...withUser.messages, { role: 'assistant' as const, content: answer, at: nowIso(), provider }] }
      setChat(next)
      await saveChat(next)
    } catch (e) {
      const partial = streamed.current
      if ((e instanceof DOMException && e.name === 'AbortError') || (e instanceof AiError && e.code === 'cancelled')) {
        if (partial) {
          const next = { ...withUser, messages: [...withUser.messages, { role: 'assistant' as const, content: `${partial}\n\n_(abgebrochen)_`, at: nowIso() }] }
          setChat(next)
          await saveChat(next)
        }
      } else setError(e instanceof AiError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setStreaming(null)
      abort.current = null
    }
  }

  const quick = [
    topic ? `Erkläre mir „${topic.name}“.` : 'Erkläre mir das Thema, das ich gerade lerne.',
    'Gib mir ein Beispiel aus dem Alltag.',
    'Erkläre es noch einmal anders.',
    'Stell mir eine Kontrollfrage, ob ich es verstanden habe.',
    'Gib mir eine Übungsaufgabe auf meinem Niveau – erst Hinweise, dann die Lösung.',
    ...(context.items.length ? ['Fasse mein Material zusammen.', 'Was davon ist für die Prüfung am wichtigsten?'] : []),
  ]

  // Offline mode: search the student's own material for the last question
  const lastQuestion = chat?.messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
  const offlineHits = useMemo(() => {
    if (ai?.ok || !lastQuestion) return []
    const hits: { kind: 'Material' | 'Notiz'; id: string; title: string; snippet: string; score: number }[] = []
    for (const m of materials ?? []) {
      const s = searchScore(lastQuestion, m.title, m.text)
      if (s) hits.push({ kind: 'Material', id: m.id, title: m.title, snippet: excerpt(m.text, lastQuestion), score: s })
    }
    for (const n of notes ?? []) {
      const s = searchScore(lastQuestion, n.title, n.content)
      if (s) hits.push({ kind: 'Notiz', id: n.id, title: n.title, snippet: excerpt(n.content, lastQuestion), score: s })
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 5)
  }, [ai?.ok, lastQuestion, materials, notes])

  return (
    <div className={cn('flex flex-col gap-4', !compact && 'min-h-[calc(100vh-14rem)]')}>
      {/* Context bar */}
      <div className="flex flex-wrap items-end gap-2">
        <Select aria-label="Fach" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId('') }} className="h-9 w-auto min-w-36 text-sm">
          <option value="">Kein Fach</option>
          {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select aria-label="Thema" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} className="h-9 w-auto min-w-40 max-w-60 text-sm">
          <option value="">Kein bestimmtes Thema</option>
          {topics?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select aria-label="Erklärmodus" value={mode} onChange={(e) => setMode(e.target.value as ExplanationMode)} className="h-9 w-auto text-sm">
          {(Object.keys(EXPLANATION_MODES) as ExplanationMode[]).map((k) => <option key={k} value={k}>{EXPLANATION_MODES[k].label}</option>)}
        </Select>
        <Button size="sm" icon={FileText} onClick={() => setPickerOpen(true)}>
          Material{context.items.length ? ` (${context.items.length})` : ''}
        </Button>
        <div className="ml-auto flex gap-1">
          <IconButton label="Frühere Gespräche" icon={History} onClick={() => setHistoryOpen(true)} />
          <IconButton label="Neues Gespräch" icon={Plus} onClick={() => { setChat(null); setError(null) }} />
        </div>
      </div>

      {ai && !ai.ok && (
        <Notice tone="warn" icon={Info} title="Ohne KI-Anbieter">
          {ai.detail} Der Tutor kann deshalb keine Erklärungen schreiben. Er durchsucht stattdessen deine Materialien und Notizen nach deiner Frage. <Link to="/einstellungen#ki" className="text-accent underline">KI einrichten</Link>
        </Notice>
      )}
      {ai?.ok && (
        <p className="text-xs text-fg-subtle">
          Tutor: {ai.label}{ai.model ? ` (${ai.model})` : ''}. {context.items.length ? `Liest mit: ${context.items.map((c) => c.title).join(', ')}.` : 'Ohne Material – der Tutor kennt deine Arbeitsblätter nicht, bis du sie auswählst.'}
          {context.truncated && ' Material wurde gekürzt (zu lang).'} KI kann sich irren – frag nach, wenn etwas komisch klingt.
        </p>
      )}

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-4" aria-live="polite">
        {!chat || chat.messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-sm text-fg-muted">Worum geht es? Du kannst auch so anfangen:</p>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-sm hover:border-border-strong cursor-pointer">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.messages.map((m, i) => <Bubble key={i} m={m} />)
        )}
        {streaming !== null && (
          <div className="max-w-[92%] rounded-lg border border-border bg-surface px-4 py-3">
            {streaming ? <Markdown className="text-[0.95rem] leading-relaxed">{streaming}</Markdown> : <Spinner label="Denkt nach …" />}
          </div>
        )}
        {!ai?.ok && chat && chat.messages.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Search className="size-4" /> In deinen Materialien gefunden</div>
            {offlineHits.length === 0 ? (
              <p className="text-sm text-fg-muted">Keine passende Stelle in deinen Materialien oder Notizen. Tipp: Importiere dein Arbeitsblatt oder übe das Thema mit Fragen.</p>
            ) : (
              offlineHits.map((h) => (
                <Link key={h.id} to={`/bibliothek/${h.kind === 'Notiz' ? 'notiz' : 'material'}/${h.id}`} className="rounded-md bg-surface-2 px-3 py-2 text-sm hover:bg-surface-3">
                  <span className="font-medium">{h.kind}: {h.title}</span>
                  <span className="mt-0.5 block text-fg-muted">{h.snippet}</span>
                </Link>
              ))
            )}
            {topicId && <ButtonLink size="sm" variant="soft" icon={BookOpen} to={`/quiz/neu?preset=practice&topic=${topicId}`} className="self-start">Thema mit Fragen üben</ButtonLink>}
          </div>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="sticky bottom-0 flex items-end gap-2 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow)]"
        style={{ bottom: 'calc(8px + var(--mobile-nav-h, 0px) + env(safe-area-inset-bottom, 0px))' }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ai?.ok ? 'Frag den Tutor … (Enter senden, Umschalt+Enter neue Zeile)' : 'Suchbegriff oder Frage – durchsucht deine Materialien'}
          aria-label="Nachricht an den Tutor"
          rows={1}
          className="min-h-10! max-h-40 flex-1 resize-none border-0 bg-transparent py-2 focus:ring-0"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
        />
        {streaming !== null ? (
          <IconButton label="Antwort stoppen" icon={Square} onClick={() => abort.current?.abort()} />
        ) : (
          <button type="submit" aria-label="Senden" disabled={!input.trim()} className="flex size-9 items-center justify-center rounded-md bg-accent-solid text-accent-fg disabled:opacity-40 cursor-pointer">
            <ArrowUp className="size-4" />
          </button>
        )}
      </form>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title="Material für den Tutor" description="Der Tutor bekommt nur das ausgewählte Material (höchstens 5, zusammen bis 60.000 Zeichen)." footer={<Button variant="primary" onClick={() => setPickerOpen(false)}>Fertig</Button>}>
        <div className="flex flex-col gap-1">
          {note && <Checkbox checked={includeNote} onChange={setIncludeNote} label={`Notiz: ${note.title}`} />}
          {(materials ?? []).length === 0 && !note && <p className="text-sm text-fg-muted">Noch kein Material in der Bibliothek.</p>}
          {(materials ?? []).filter((m) => m.text.trim()).sort((a, b) => Number(b.subjectId === subjectId) - Number(a.subjectId === subjectId)).map((m) => (
            <Checkbox key={m.id} checked={materialIds.includes(m.id)} onChange={(v) => setMaterialIds((ids) => (v ? [...ids, m.id].slice(-5) : ids.filter((x) => x !== m.id)))} label={m.title} description={`${m.text.length.toLocaleString('de-DE')} Zeichen${m.extraction.status !== 'complete' ? ' · Text unvollständig' : ''}`} />
          ))}
        </div>
      </Dialog>
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Frühere Gespräche">
        {(chats ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">Noch keine Gespräche.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {chats!.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <button type="button" className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => { setChat(c); setMode(c.mode); setMaterialIds(c.materialIds); setSubjectId(c.subjectId ?? ''); setTopicId(c.topicId ?? ''); setHistoryOpen(false) }}>
                  <span className="block truncate text-sm font-medium">{c.title}</span>
                  <span className="text-xs text-fg-subtle">{formatDateTime(c.updatedAt)} · {c.messages.length} Nachrichten</span>
                </button>
                <IconButton label="Gespräch löschen" icon={Trash2} size="sm" onClick={async () => { if (await confirm({ title: 'Gespräch löschen?' })) { await deleteChat(c.id); if (chat?.id === c.id) setChat(null) } }} />
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'user')
    return (
      <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-accent-soft px-4 py-2.5 text-[0.95rem]">{m.content}</div>
    )
  return (
    <div className="max-w-[92%] rounded-lg border border-border bg-surface px-4 py-3">
      <Markdown className="text-[0.95rem] leading-relaxed">{m.content}</Markdown>
      {m.provider && <div className="mt-2"><Badge>{m.provider}</Badge></div>}
    </div>
  )
}
