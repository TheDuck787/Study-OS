import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import { addCards, saveDeck, type CardInput } from '@/db/repo'
import { Button, Dialog, Field, IconButton, Input, Notice, Select, useToast } from '@/components/ui'

/** Review step for automatically created cards: edit, remove or add before anything is saved. */
export function GenerateCardsDialog({ open, onClose, initial, subjectId, topicId, sourceMaterialId, sourceLabel, defaultDeckName }: {
  open: boolean
  onClose: () => void
  initial: CardInput[]
  subjectId: string | null
  topicId: string | null
  sourceMaterialId: string | null
  sourceLabel: string
  defaultDeckName?: string
}) {
  const toast = useToast()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const [cards, setCards] = useState<CardInput[]>([])
  const [deckId, setDeckId] = useState('__new')
  const [deckName, setDeckName] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setCards(initial.map((c) => ({ ...c })))
      setDeckName(defaultDeckName ?? '')
      const match = decks?.find((d) => (topicId && d.topicId === topicId) || (subjectId && d.subjectId === subjectId))
      setDeckId(match?.id ?? '__new')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const update = (i: number, patch: Partial<CardInput>) => setCards((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const valid = cards.filter((c) => c.front.trim() && c.back.trim())

  const save = async () => {
    setBusy(true)
    try {
      const target = deckId === '__new' ? await saveDeck({ name: deckName || 'Neue Karten', subjectId, topicId }) : deckId
      const n = await addCards(target, valid.map((c) => ({ ...c, topicId: topicId ?? c.topicId ?? null, sourceMaterialId })))
      toast({ title: `${n} Karteikarten gespeichert`, tone: 'success' })
      onClose()
    } catch (e) {
      toast({ title: 'Speichern fehlgeschlagen', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Karteikarten prüfen und speichern"
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={valid.length === 0 || (deckId === '__new' && !deckName.trim())}>
            {valid.length} Karten speichern
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Notice tone="neutral">{sourceLabel}</Notice>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="In Stapel speichern" htmlFor="gc-deck">
            <Select id="gc-deck" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="__new">+ Neuer Stapel</option>
              {decks?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          {deckId === '__new' && (
            <Field label="Name des neuen Stapels" htmlFor="gc-name">
              <Input id="gc-name" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="z. B. Biologie: Hormone" />
            </Field>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {cards.map((c, i) => (
            <li key={i} className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1.4fr_auto]">
              <Input value={c.front} onChange={(e) => update(i, { front: e.target.value })} aria-label={`Vorderseite Karte ${i + 1}`} placeholder="Vorderseite" className="h-9" />
              <Input value={c.back} onChange={(e) => update(i, { back: e.target.value })} aria-label={`Rückseite Karte ${i + 1}`} placeholder="Rückseite" className="h-9" />
              <IconButton label={`Karte ${i + 1} entfernen`} icon={Trash2} onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => setCards((cs) => [...cs, { front: '', back: '', example: '' }])}>
          Karte hinzufügen
        </Button>
      </div>
    </Dialog>
  )
}
