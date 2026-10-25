import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen, Plus } from 'lucide-react'
import { db } from '@/db/index'
import type { Note } from '@/db/types'
import { formatDate } from '@/lib/dates'
import { Badge, ButtonLink, EmptyState, LoadingBlock } from '@/components/ui'

export function noteExcerpt(n: Note, len = 140) {
  const plain = n.content.replace(/[#*_>`|$-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > len ? plain.slice(0, len) + ' …' : plain
}

export function NotesList({ subjectId, topicId, notes: given }: { subjectId?: string; topicId?: string; notes?: Note[] }) {
  const loaded = useLiveQuery(async () => {
    if (given) return given
    const all = topicId ? await db.notes.where('topicId').equals(topicId).toArray() : subjectId ? await db.notes.where('subjectId').equals(subjectId).toArray() : await db.notes.toArray()
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [subjectId, topicId, given])
  const newLink = `/bibliothek/notiz/neu?${new URLSearchParams({ ...(subjectId ? { subject: subjectId } : {}), ...(topicId ? { topic: topicId } : {}) })}`
  if (!loaded) return <LoadingBlock />
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ButtonLink to={newLink} size="sm" icon={Plus}>
          Neue Notiz
        </ButtonLink>
      </div>
      {loaded.length === 0 ? (
        <EmptyState compact icon={NotebookPen} title="Keine Notizen" description="Schreibe Merkzettel, Regeln oder Zusammenfassungen. Formeln gehen mit $…$." />
      ) : (
        <ul className="stagger grid gap-2 sm:grid-cols-2">
          {loaded.map((n) => (
            <li key={n.id}>
              <Link to={`/bibliothek/notiz/${n.id}`} className="lift surface-raised group flex h-full flex-col rounded-lg border border-border bg-surface p-3.5 hover:border-border-strong">
                <span className="font-medium group-hover:text-accent">{n.title}</span>
                <span className="mt-1 line-clamp-2 text-sm text-fg-muted">{noteExcerpt(n)}</span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
                  {formatDate(n.updatedAt)}
                  {n.tags.map((t) => <Badge key={t}>{t}</Badge>)}
                  {n.sourceMaterialId && <Badge tone="accent">aus Material</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
