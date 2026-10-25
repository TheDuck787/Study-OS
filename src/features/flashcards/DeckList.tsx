import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Plus } from 'lucide-react'
import { db } from '@/db/index'
import { isDueToday } from '@/lib/srs'
import { Badge, Button, EmptyState, LoadingBlock } from '@/components/ui'
import { DeckDialog } from './DeckDialog'

export function DeckList({ subjectId }: { subjectId?: string }) {
  const [open, setOpen] = useState(false)
  const data = useLiveQuery(async () => {
    const decks = subjectId ? await db.decks.where('subjectId').equals(subjectId).toArray() : await db.decks.toArray()
    const cards = await db.cards.where('deckId').anyOf(decks.map((d) => d.id)).toArray()
    const now = new Date()
    return decks.map((d) => {
      const cs = cards.filter((c) => c.deckId === d.id)
      return { deck: d, total: cs.length, due: cs.filter((c) => c.srs.state !== 'new' && isDueToday(c.srs, now)).length, fresh: cs.filter((c) => c.srs.state === 'new').length }
    }).sort((a, b) => b.due - a.due || a.deck.name.localeCompare(b.deck.name))
  }, [subjectId])
  if (!data) return <LoadingBlock />
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>
          Neuer Stapel
        </Button>
      </div>
      {data.length === 0 ? (
        <EmptyState compact icon={Layers} title="Keine Kartenstapel" description="Lege einen Stapel an, importiere eine CSV-Datei oder erstelle Karten aus Notizen und Material." />
      ) : (
        <ul className="stagger grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data.map(({ deck, total, due, fresh }) => (
            <li key={deck.id} className="lift surface-raised flex flex-col rounded-lg border border-border bg-surface">
              <Link to={`/karteikarten/${deck.id}`} className="group flex-1 p-3.5">
                <div className="font-medium group-hover:text-accent">{deck.name}</div>
                <div className="mt-0.5 text-sm text-fg-muted">
                  {total} Karten · {fresh} neu
                </div>
              </Link>
              <div className="flex items-center justify-between border-t border-border px-3.5 py-2">
                {due > 0 ? <Badge tone="accent">{due} fällig</Badge> : fresh > 0 ? <Badge>{fresh} neu</Badge> : <span className="text-xs text-fg-subtle">nichts fällig</span>}
                <Link to={`/karteikarten/${deck.id}/lernen`} className="text-sm font-medium text-accent">
                  {due > 0 || fresh > 0 ? 'Lernen' : 'Trotzdem üben'}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <DeckDialog open={open} onClose={() => setOpen(false)} subjectId={subjectId} />
    </div>
  )
}
