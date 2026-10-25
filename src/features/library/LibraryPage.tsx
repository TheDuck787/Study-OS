import { useMemo, useState } from 'react'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, FileUp, NotebookPen, Search } from 'lucide-react'
import { db } from '@/db/index'
import type { Material } from '@/db/types'
import { searchScore, excerpt } from '@/lib/text'
import { formatDate } from '@/lib/dates'
import { Badge, ButtonLink, EmptyState, Input, LoadingBlock, PageHeader, Select, Tabs } from '@/components/ui'
import { useSubjects } from '@/hooks/data'
import { NotesList } from '@/features/notes/NotesList'

export const STATUS_LABEL: Record<Material['extraction']['status'], { label: string; tone: 'success' | 'warn' | 'danger' | 'neutral' }> = {
  complete: { label: 'Text vollständig', tone: 'success' },
  partial: { label: 'Text unvollständig', tone: 'warn' },
  failed: { label: 'Kein Text erkannt', tone: 'danger' },
  unsupported: { label: 'Nicht unterstützt', tone: 'danger' },
}

export function MaterialsList({ materials }: { materials: Material[] }) {
  if (materials.length === 0) return <EmptyState compact icon={FileText} title="Kein Material" description="Importiere Arbeitsblätter (PDF, Foto), Textdateien oder füge Text ein." action={<ButtonLink to="/bibliothek/import" size="sm" icon={FileUp}>Importieren</ButtonLink>} />
  return (
    <ul className="stagger grid gap-2 sm:grid-cols-2">
      {materials.map((m) => (
        <li key={m.id}>
          <Link to={`/bibliothek/material/${m.id}`} className="lift surface-raised group flex h-full flex-col rounded-lg border border-border bg-surface p-3.5 hover:border-border-strong">
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <span className="truncate font-medium group-hover:text-accent">{m.title}</span>
            </span>
            <span className="mt-1 line-clamp-2 text-sm text-fg-muted">{m.text.slice(0, 200) || 'Kein Text'}</span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
              {formatDate(m.createdAt)}
              <Badge tone={STATUS_LABEL[m.extraction.status].tone}>{STATUS_LABEL[m.extraction.status].label}</Badge>
              {m.tags.map((t) => <Badge key={t}>{t}</Badge>)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default function LibraryPage() {
  const [params, setParams] = useSearchParams()
  const subjects = useSubjects()
  const [tab, setTab] = useState<'materials' | 'notes'>(params.get('tab') === 'notizen' ? 'notes' : 'materials')
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [tag, setTag] = useState('')
  const materials = useLiveQuery(() => db.materials.orderBy('createdAt').reverse().toArray(), [])
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), [])
  const tags = useMemo(() => [...new Set([...(materials ?? []).flatMap((m) => m.tags), ...(notes ?? []).flatMap((n) => n.tags)])].sort(), [materials, notes])

  const results = useMemo(() => {
    if (!q.trim() || !materials || !notes) return null
    const out: { kind: 'note' | 'material'; id: string; title: string; snippet: string; score: number }[] = []
    for (const m of materials) {
      const s = searchScore(q, m.title, m.text, m.tags.join(' '))
      if (s) out.push({ kind: 'material', id: m.id, title: m.title, snippet: excerpt(m.text, q), score: s + (searchScore(q, m.title) ? 10 : 0) })
    }
    for (const n of notes) {
      const s = searchScore(q, n.title, n.content, n.tags.join(' '))
      if (s) out.push({ kind: 'note', id: n.id, title: n.title, snippet: excerpt(n.content, q), score: s + (searchScore(q, n.title) ? 10 : 0) })
    }
    return out.sort((a, b) => b.score - a.score)
  }, [q, materials, notes])

  if (params.get('neu') === 'notiz') return <Navigate to="/bibliothek/notiz/neu" replace />
  if (!materials || !notes || !subjects) return <LoadingBlock />
  const filt = <T extends { subjectId: string | null; tags: string[] }>(xs: T[]) => xs.filter((x) => (!subject || x.subjectId === subject) && (!tag || x.tags.includes(tag)))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bibliothek"
        title="Deine Lernmaterialien"
        description="Arbeitsblätter, Fotos, PDFs und Notizen an einem Ort – durchsuchbar und mit Fächern verknüpft."
        actions={
          <>
            <ButtonLink to="/bibliothek/notiz/neu" icon={NotebookPen}>Notiz</ButtonLink>
            <ButtonLink to="/bibliothek/import" variant="primary" icon={FileUp}>Importieren</ButtonLink>
          </>
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="In allen Materialien und Notizen suchen" aria-label="Bibliothek durchsuchen" className="pl-9" />
        </div>
        <Select aria-label="Fach" value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-44">
          <option value="">Alle Fächer</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        {tags.length > 0 && (
          <Select aria-label="Schlagwort" value={tag} onChange={(e) => setTag(e.target.value)} className="sm:w-40">
            <option value="">Alle Schlagwörter</option>
            {tags.map((t) => <option key={t}>{t}</option>)}
          </Select>
        )}
      </div>
      {results ? (
        <section aria-label="Suchergebnisse">
          <p className="mb-3 text-sm text-fg-muted">{results.length} Treffer für „{q}“</p>
          <ul className="stagger flex flex-col gap-2">
            {results.map((r) => (
              <li key={r.id}>
                <Link to={`/bibliothek/${r.kind === 'note' ? 'notiz' : 'material'}/${r.id}`} className="lift surface-raised block rounded-lg border border-border bg-surface p-3.5 hover:border-border-strong">
                  <span className="flex items-center gap-2 font-medium">
                    {r.kind === 'note' ? <NotebookPen className="size-4 text-fg-subtle" /> : <FileText className="size-4 text-fg-subtle" />}
                    {r.title}
                  </span>
                  <span className="mt-1 block text-sm text-fg-muted">{r.snippet}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <Tabs label="Bibliothek" value={tab} onChange={(t) => { setTab(t); setParams(t === 'notes' ? { tab: 'notizen' } : {}) }} tabs={[{ id: 'materials', label: 'Materialien', count: filt(materials).length, icon: FileText }, { id: 'notes', label: 'Notizen', count: filt(notes).length, icon: NotebookPen }]} />
          {tab === 'materials' ? <MaterialsList materials={filt(materials)} /> : <NotesList notes={filt(notes)} />}
        </>
      )}
    </div>
  )
}
