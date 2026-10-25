import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Download, FileUp, ListChecks, MoreHorizontal, Pencil, Play, Plus, RotateCcw, Search, Trash2, Volume2 } from 'lucide-react'
import { db } from '@/db/index'
import type { Card as CardT } from '@/db/types'
import { addCards, deleteCard, deleteDeck, resetCardProgress, updateCard, ValidationError } from '@/db/repo'
import { csvToCards, toCsv } from '@/lib/csv'
import { formatDate } from '@/lib/dates'
import { retentionRate } from '@/lib/srs'
import { saveFile } from '@/lib/download'
import { speak, speechAvailable } from '@/lib/speech'
import { Badge, Button, ButtonLink, Card, Dialog, EmptyState, Field, IconButton, Input, LoadingBlock, Menu, Notice, PageHeader, StatTile, Textarea, useConfirm, useToast } from '@/components/ui'
import { DeckDialog } from './DeckDialog'

const STATE_LABEL = { new: 'neu', learning: 'in Arbeit', review: 'gelernt' }

export default function DeckPage() {
  const { deckId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const deck = useLiveQuery(async () => (await db.decks.get(deckId ?? '')) ?? null, [deckId])
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(deckId ?? '').toArray(), [deckId])
  const reviews = useLiveQuery(() => db.cardReviews.where('deckId').equals(deckId ?? '').toArray(), [deckId])
  const [q, setQ] = useState('')
  const [editDeck, setEditDeck] = useState(false)
  const [editing, setEditing] = useState<CardT | 'new' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const highlight = params.get('karte')
  const highlightRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (highlight) setTimeout(() => highlightRef.current?.scrollIntoView({ block: 'center' }), 100)
  }, [highlight, cards])

  const filtered = useMemo(() => (cards ?? []).filter((c) => !q || `${c.front} ${c.back} ${c.example}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [cards, q])
  if (deck === undefined || !cards || !reviews) return <LoadingBlock />
  if (!deck) return <Notice tone="warn" title="Stapel nicht gefunden" />
  const now = new Date()
  const due = cards.filter((c) => new Date(c.srs.due) <= now).length
  const retention = retentionRate(reviews)

  const exportCsv = async () => {
    const rows = [['Vorderseite', 'Rückseite', 'Beispiel'], ...cards.map((c) => [c.front, c.back, c.example])]
    await saveFile(`${deck.name.replace(/[^\wäöüÄÖÜß -]/g, '')}.csv`, toCsv(rows), 'text/csv')
  }
  const remove = async () => {
    if (await confirm({ title: `Stapel „${deck.name}“ löschen?`, message: `${cards.length} Karten und ihr Lernfortschritt werden gelöscht.` })) {
      await deleteDeck(deck.id)
      navigate('/karteikarten')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/karteikarten" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Alle Stapel
      </Link>
      <PageHeader
        title={deck.name}
        description={deck.description || undefined}
        actions={
          <>
            <ButtonLink to={`/karteikarten/${deck.id}/lernen`} variant="primary" icon={Play}>
              {due > 0 ? `${due} fällige lernen` : 'Üben'}
            </ButtonLink>
            <ButtonLink to={`/quiz/neu?deck=${deck.id}`} icon={ListChecks}>
              Vokabeltest
            </ButtonLink>
            <Menu
              label="Weitere Aktionen"
              icon={MoreHorizontal}
              items={[
                { label: 'Stapel bearbeiten', icon: Pencil, onSelect: () => setEditDeck(true) },
                { label: 'CSV importieren', icon: FileUp, onSelect: () => setImportOpen(true) },
                { label: 'Als CSV exportieren', icon: Download, onSelect: exportCsv, disabled: cards.length === 0 },
                { label: 'Stapel löschen', icon: Trash2, onSelect: remove, danger: true },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Karten" value={cards.length} />
        <StatTile label="Jetzt fällig" value={due} />
        <StatTile label="Gelernt" value={cards.filter((c) => c.srs.state === 'review').length} sub={`${cards.filter((c) => c.srs.state === 'new').length} noch neu`} />
        <StatTile label="Behaltensquote" value={retention === null ? '–' : `${Math.round(retention * 100)} %`} sub={`${reviews.length} Wiederholungen`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Karten durchsuchen" aria-label="Karten durchsuchen" className="pl-9" />
        </div>
        <Button icon={Plus} onClick={() => setEditing('new')}>
          Karte
        </Button>
      </div>
      {cards.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Noch keine Karten"
          description="Lege Karten von Hand an, importiere eine CSV-Datei (z. B. aus Excel) oder erstelle sie aus deinen Notizen und Materialien."
          action={
            <>
              <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>Karte anlegen</Button>
              <Button icon={FileUp} onClick={() => setImportOpen(true)}>CSV importieren</Button>
            </>
          }
        />
      ) : (
        <Card as="div" className="divide-y divide-border">
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} ref={c.id === highlight ? highlightRef : undefined} className={`flex items-start gap-3 px-4 py-3 ${c.id === highlight ? 'bg-accent-soft' : ''}`}>
                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-4">
                  <div className="min-w-0">
                    <div className="break-words font-medium">{c.front}</div>
                    {c.example && <div className="mt-0.5 text-xs italic text-fg-subtle">{c.example}</div>}
                  </div>
                  <div className="min-w-0 break-words text-fg-muted">{c.back}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={c.srs.state === 'review' ? 'success' : c.srs.state === 'learning' ? 'accent' : 'neutral'}>{STATE_LABEL[c.srs.state]}</Badge>
                  <span className="text-xs text-fg-subtle">{c.srs.state === 'new' ? '' : `fällig ${formatDate(c.srs.due)}`}</span>
                </div>
                <div className="flex shrink-0">
                  {deck.frontLang && speechAvailable() && <IconButton label="Aussprechen" icon={Volume2} size="sm" onClick={() => speak(c.front, deck.frontLang!)} />}
                  <Menu
                    label="Aktionen für Karte"
                    icon={MoreHorizontal}
                    items={[
                      { label: 'Bearbeiten', icon: Pencil, onSelect: () => setEditing(c) },
                      { label: 'Lernstand zurücksetzen', icon: RotateCcw, onSelect: async () => { await resetCardProgress(c.id); toast({ title: 'Karte ist wieder neu' }) } },
                      { label: 'Löschen', icon: Trash2, danger: true, onSelect: async () => { if (await confirm({ title: 'Karte löschen?', message: `„${c.front}“` })) await deleteCard(c.id) } },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-fg-muted">Keine Karte passt zu „{q}“.</p>}
        </Card>
      )}
      <p className="text-xs text-fg-subtle">Tastenkürzel beim Lernen: Leertaste = umdrehen, 1 = Vergessen, 2 = Schwer, 3 = Gut, 4 = Leicht.</p>
      <DeckDialog open={editDeck} onClose={() => setEditDeck(false)} deck={deck} />
      <CardDialog open={!!editing} onClose={() => setEditing(null)} deckId={deck.id} card={editing === 'new' ? undefined : editing ?? undefined} />
      <CsvImportDialog open={importOpen} onClose={() => setImportOpen(false)} deckId={deck.id} />
    </div>
  )
}

function CardDialog({ open, onClose, deckId, card }: { open: boolean; onClose: () => void; deckId: string; card?: CardT }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [another, setAnother] = useState(false)
  const toast = useToast()
  const frontRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) {
      setFront(card?.front ?? '')
      setBack(card?.back ?? '')
      setExample(card?.example ?? '')
      setError(null)
    }
  }, [open, card])
  const save = async (keepOpen: boolean) => {
    try {
      if (card) await updateCard(card.id, { front, back, example })
      else {
        if (!front.trim() || !back.trim()) throw new ValidationError('Vorder- und Rückseite dürfen nicht leer sein.')
        await addCards(deckId, [{ front, back, example }])
      }
      toast({ title: card ? 'Karte gespeichert' : 'Karte angelegt', tone: 'success' })
      if (keepOpen && !card) {
        setFront('')
        setBack('')
        setExample('')
        setAnother(!another)
        frontRef.current?.focus()
      } else onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={card ? 'Karte bearbeiten' : 'Neue Karte'}
      footer={
        <>
          {!card && <Button onClick={() => save(true)}>Speichern & nächste</Button>}
          <Button variant="primary" onClick={() => save(false)}>Speichern</Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(!card) }}>
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="Vorderseite" htmlFor="card-front" hint="z. B. das englische Wort oder ein Begriff">
          <Input ref={frontRef} id="card-front" value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        </Field>
        <Field label="Rückseite" htmlFor="card-back" hint="Mehrere Bedeutungen mit ; trennen – beim Vokabeltest zählt jede.">
          <Input id="card-back" value={back} onChange={(e) => setBack(e.target.value)} />
        </Field>
        <Field label="Beispielsatz" htmlFor="card-example" optional>
          <Textarea id="card-example" value={example} onChange={(e) => setExample(e.target.value)} rows={2} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

function CsvImportDialog({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId: string }) {
  const [text, setText] = useState('')
  const toast = useToast()
  const preview = useMemo(() => (text.trim() ? csvToCards(text) : null), [text])
  useEffect(() => {
    if (open) setText('')
  }, [open])
  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Datei zu groß', description: 'Höchstens 5 MB.', tone: 'danger' })
      return
    }
    setText(await f.text())
  }
  const run = async () => {
    if (!preview) return
    const n = await addCards(deckId, preview.cards)
    toast({ title: `${n} Karten importiert`, description: preview.skipped ? `${preview.skipped} Zeilen ohne Vorder- oder Rückseite übersprungen.` : undefined, tone: 'success' })
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Karten aus CSV importieren"
      description="Spalten: Vorderseite; Rückseite; Beispiel (optional). Komma, Semikolon oder Tab als Trenner. Eine Kopfzeile wird erkannt."
      footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={run} disabled={!preview || preview.cards.length === 0}>{preview?.cards.length ?? 0} Karten importieren</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Field label="CSV-Datei" htmlFor="csv-file">
          <input id="csv-file" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-fg" />
        </Field>
        <Field label="… oder Text einfügen" htmlFor="csv-text">
          <Textarea id="csv-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} className="font-mono text-sm" placeholder={'environment;die Umwelt;We must protect the environment.\npollution;die Verschmutzung'} />
        </Field>
        {preview && (
          <div className="text-sm">
            <p className="text-fg-muted">
              {preview.cards.length} Karten erkannt{preview.usedHeader ? ' (Kopfzeile erkannt)' : ''}{preview.skipped ? `, ${preview.skipped} Zeilen übersprungen` : ''}.
            </p>
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
              {preview.cards.slice(0, 20).map((c, i) => (
                <li key={i} className="grid grid-cols-2 gap-3 border-b border-border px-3 py-1.5 last:border-0">
                  <span className="truncate">{c.front}</span>
                  <span className="truncate text-fg-muted">{c.back}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  )
}
