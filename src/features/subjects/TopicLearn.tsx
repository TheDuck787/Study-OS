import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, Compass, FileText, Lightbulb, ListChecks, NotebookPen, Pencil, Plus, Tags, type LucideIcon } from 'lucide-react'
import { db } from '@/db/index'
import type { Note } from '@/db/types'
import { ButtonLink, EmptyState, LoadingBlock } from '@/components/ui'
import { Markdown } from '@/components/Markdown'

/** Learning path of a topic: notes grouped into the order you study them (overview → explanations → examples → terms → mistakes → summary). */
interface Group { id: string; title: string; hint: string; icon: LucideIcon; parts: string[] }
const GROUPS: Group[] = [
  { id: 'ueberblick', title: 'Überblick', hint: 'Worum geht es und was solltest du am Ende können?', icon: Compass, parts: ['ueberblick'] },
  { id: 'erklaerungen', title: 'Erklärungen', hint: 'Der Stoff Schritt für Schritt – in dieser Reihenfolge durcharbeiten.', icon: BookOpen, parts: ['notiz'] },
  { id: 'beispiele', title: 'Musterbeispiele', hint: 'Vollständig vorgerechnet bzw. vorgemacht, mit Begründung zu jedem Schritt.', icon: Lightbulb, parts: ['beispiel'] },
  { id: 'begriffe', title: 'Fachbegriffe', hint: 'Die wichtigsten Begriffe mit Definition.', icon: Tags, parts: ['fachbegriffe'] },
  { id: 'fehler', title: 'Typische Fehler', hint: 'Was oft schiefgeht – und wie du es vermeidest.', icon: AlertTriangle, parts: ['fehler'] },
  { id: 'lernzettel', title: 'Lernzettel', hint: 'Das Wichtigste auf einen Blick – ideal kurz vor dem Test.', icon: ListChecks, parts: ['zusammenfassung'] },
  { id: 'eigene', title: 'Eigene Notizen', hint: 'Deine Mitschriften und Merkzettel zu diesem Thema.', icon: NotebookPen, parts: [''] },
  { id: 'zusatz', title: 'Weitere Angaben', hint: 'Aus dem Lernpaket aufbewahrte Felder.', icon: FileText, parts: ['zusatz'] },
]
/** Generated list of exercises – the exercises themselves are in "Üben & Prüfen". */
const HIDDEN = new Set(['uebungen'])
const partOf = (n: Note) => n.tags.find((t) => t.startsWith('lp-teil:'))?.slice(8) ?? ''

export function groupNotes(notes: Note[]) {
  // package notes get descending timestamps in reading order (newest = first); own notes newest first
  const sorted = [...notes].sort((a, b) => (partOf(a) && partOf(b) ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt)))
  return GROUPS.map((g) => ({ ...g, notes: sorted.filter((n) => !HIDDEN.has(partOf(n)) && g.parts.includes(partOf(n))) })).filter((g) => g.notes.length > 0)
}

export function TopicLearn({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const notes = useLiveQuery(() => db.notes.where('topicId').equals(topicId).toArray(), [topicId])
  if (!notes) return <LoadingBlock />
  const newLink = `/bibliothek/notiz/neu?${new URLSearchParams({ subject: subjectId, topic: topicId })}`
  const groups = groupNotes(notes)
  let step = 0
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-fg-muted">Arbeite die Abschnitte von oben nach unten durch. Wenn du alles verstanden hast, wechsle zu <strong className="text-fg">Üben &amp; Prüfen</strong>.</p>
        <ButtonLink to={newLink} size="sm" icon={Plus}>Neue Notiz</ButtonLink>
      </div>
      {groups.length === 0 ? (
        <EmptyState compact icon={NotebookPen} title="Noch kein Lernstoff" description="Schreibe eigene Notizen oder importiere ein Lernpaket – dann erscheinen hier Erklärungen, Beispiele und ein Lernzettel." />
      ) : (
        <ol className="flex flex-col gap-6">
          {groups.map((g) => {
            const Icon = g.icon
            return (
              <li key={g.id} aria-labelledby={`lg-${g.id}`}>
                <div className="mb-2 flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Icon className="size-4" aria-hidden /></span>
                  <div>
                    <h3 id={`lg-${g.id}`} className="font-semibold">{g.title} <span className="text-sm font-normal text-fg-subtle">({g.notes.length})</span></h3>
                    <p className="text-sm text-fg-muted">{g.hint}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:pl-10">
                  {g.notes.map((n) => {
                    step++
                    return (
                      <details key={n.id} open={step === 1} className="group surface-raised rounded-lg border border-border bg-surface">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                          <span className="w-6 shrink-0 text-sm text-fg-subtle tabular">{step}.</span>
                          <span className="min-w-0 flex-1 font-medium">{n.title}</span>
                        </summary>
                        <div className="border-t border-border px-4 py-4">
                          <Markdown>{n.content}</Markdown>
                          <div className="mt-3 flex justify-end">
                            <Link to={`/bibliothek/notiz/${n.id}`} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent"><Pencil className="size-3" aria-hidden /> Bearbeiten</Link>
                          </div>
                        </div>
                      </details>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
