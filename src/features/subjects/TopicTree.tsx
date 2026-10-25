import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, CornerDownRight, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import type { Topic } from '@/db/types'
import { createTopic, deleteTopic, reorderTopics, topicDeletionImpact, updateTopic, ValidationError } from '@/db/repo'
import type { TopicStats } from '@/lib/mastery'
import { LEVEL_LABELS } from '@/lib/mastery'
import { Badge, Button, cn, EmptyState, IconButton, Input, Menu, ProgressBar, useConfirm, useToast } from '@/components/ui'
import { CURRICULUM_NOTICE } from '@/content/curriculum'

/** Editable topic hierarchy: add, rename, reorder, nest and delete topics. */
export function TopicTree({ subjectId, topics, stats }: { subjectId: string; topics: Topic[]; stats: Map<string, TopicStats> }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const roots = topics.filter((t) => !t.parentId || !topics.some((p) => p.id === t.parentId)).sort((a, b) => a.order - b.order)
  const unverified = topics.some((t) => t.curriculum === 'example-unverified')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createTopic(subjectId, newName)
      setNewName('')
      setError(null)
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {unverified && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-fg-muted">
          <strong className="text-fg">Beispiel-Lehrplan:</strong> {CURRICULUM_NOTICE} Mit dem Schild-Symbol im Menü markierst du ein Thema als „mit Unterricht abgeglichen“.
        </p>
      )}
      {roots.length === 0 ? (
        <EmptyState compact title="Noch keine Themen" description="Lege das erste Thema an, z. B. „Satz des Pythagoras“." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {roots.map((t, i) => (
            <TopicRow key={t.id} topic={t} all={topics} siblings={roots} index={i} depth={0} stats={stats} onError={(m) => toast({ title: m, tone: 'danger' })} />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Neues Thema …" aria-label="Name des neuen Themas" maxLength={120} invalid={!!error} />
          <Button type="submit" variant="primary" icon={Plus} disabled={!newName.trim()}>
            Hinzufügen
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </div>
  )
}

function TopicRow({ topic, all, siblings, index, depth, stats, onError }: { topic: Topic; all: Topic[]; siblings: Topic[]; index: number; depth: number; stats: Map<string, TopicStats>; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(topic.name)
  const [addingSub, setAddingSub] = useState(false)
  const [subName, setSubName] = useState('')
  const confirm = useConfirm()
  const children = all.filter((t) => t.parentId === topic.id).sort((a, b) => a.order - b.order)
  const s = stats.get(topic.id)

  const save = async () => {
    try {
      await updateTopic(topic.id, { name })
      setEditing(false)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }
  const move = async (dir: -1 | 1) => {
    const ids = siblings.map((x) => x.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    await reorderTopics(ids)
  }
  const remove = async () => {
    const imp = await topicDeletionImpact(topic.id)
    const ok = await confirm({
      title: `„${topic.name}“ löschen?`,
      message: `Gelöscht werden ${imp.subtopics ? `${imp.subtopics} Unterthemen, ` : ''}${imp.questions} Fragen und ${imp.answers} gespeicherte Antworten. ${imp.notes} Notizen und ${imp.cards} Karteikarten bleiben erhalten (ohne Themenzuordnung).`,
      confirmLabel: 'Thema löschen',
    })
    if (ok) await deleteTopic(topic.id)
  }
  const addSub = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createTopic(topic.subjectId, subName, { parentId: topic.id })
      setSubName('')
      setAddingSub(false)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <li>
      <div className={cn('flex items-center gap-2 px-3 py-2.5')} style={{ paddingLeft: 12 + depth * 22 }}>
        {depth > 0 && <CornerDownRight className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />}
        {editing ? (
          <form
            className="flex flex-1 items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Themenname" className="h-8" onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} />
            <IconButton label="Speichern" icon={Check} type="submit" size="sm" />
            <IconButton label="Abbrechen" icon={X} size="sm" onClick={() => setEditing(false)} />
          </form>
        ) : (
          <Link to={`/faecher/${topic.subjectId}/themen/${topic.id}`} className="group min-w-0 flex-1">
            <span className="block truncate text-sm font-medium group-hover:text-accent">{topic.name}</span>
            <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {topic.curriculum === 'example-unverified' && <Badge title="Nicht mit dem offiziellen Lehrplan abgeglichen">Beispiel · ungeprüft</Badge>}
              {s && s.answers > 0 && <span className="text-xs text-fg-subtle">{LEVEL_LABELS[s.level]}</span>}
            </span>
          </Link>
        )}
        {!editing && s && s.answers > 0 && <ProgressBar className="hidden w-28 shrink-0 sm:flex" value={s.mastery} label={`Beherrschung ${topic.name}`} tone={s.level === 'struggling' ? 'warn' : s.level === 'mastered' ? 'success' : 'accent'} />}
        {!editing && (
          <Menu
            label={`Aktionen für ${topic.name}`}
            icon={MoreHorizontal}
            items={[
              { label: 'Umbenennen', icon: Pencil, onSelect: () => { setName(topic.name); setEditing(true) } },
              { label: 'Unterthema hinzufügen', icon: Plus, onSelect: () => setAddingSub(true) },
              { label: 'Nach oben', icon: ArrowUp, onSelect: () => move(-1), disabled: index === 0 },
              { label: 'Nach unten', icon: ArrowDown, onSelect: () => move(1), disabled: index === siblings.length - 1 },
              ...(topic.curriculum === 'example-unverified' ? [{ label: 'Mit Unterricht abgeglichen', icon: ShieldCheck, onSelect: () => updateTopic(topic.id, { curriculum: 'own' }) }] : []),
              { label: 'Löschen', icon: Trash2, onSelect: remove, danger: true },
            ]}
          />
        )}
      </div>
      {addingSub && (
        <form onSubmit={addSub} className="flex gap-2 px-3 pb-3" style={{ paddingLeft: 34 + depth * 22 }}>
          <Input value={subName} onChange={(e) => setSubName(e.target.value)} autoFocus placeholder="Name des Unterthemas" aria-label="Name des Unterthemas" className="h-8" onKeyDown={(e) => e.key === 'Escape' && setAddingSub(false)} />
          <Button type="submit" size="sm" variant="primary" disabled={!subName.trim()}>
            Anlegen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAddingSub(false)}>
            Abbrechen
          </Button>
        </form>
      )}
      {children.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {children.map((c, i) => (
            <TopicRow key={c.id} topic={c} all={all} siblings={children} index={i} depth={depth + 1} stats={stats} onError={onError} />
          ))}
        </ul>
      )}
    </li>
  )
}
