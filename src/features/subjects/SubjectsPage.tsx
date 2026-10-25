import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookOpen, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Subject } from '@/db/types'
import { deleteSubject, reorderSubjects, subjectDeletionImpact } from '@/db/repo'
import { useExams, useSubjects, useTopicStats, useTopics } from '@/hooks/data'
import { averageMastery } from '@/lib/mastery'
import { diffDays, dayKey, relativeDay } from '@/lib/dates'
import { Badge, Button, EmptyState, LoadingBlock, Menu, PageHeader, Ring, useConfirm, useToast } from '@/components/ui'
import { subjectIcon } from '@/lib/calendar/meta'
import { subjectColorVar } from '@/lib/colors'
import { SubjectDialog } from './SubjectDialog'

export default function SubjectsPage() {
  const subjects = useSubjects()
  const topics = useTopics()
  const exams = useExams()
  const { stats } = useTopicStats()
  const [dialog, setDialog] = useState<{ open: boolean; subject?: Subject }>({ open: false })
  const confirm = useConfirm()
  const toast = useToast()
  const today = dayKey()

  if (!subjects || !topics) return <LoadingBlock />
  const move = async (i: number, dir: -1 | 1) => {
    const ids = subjects.map((s) => s.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await reorderSubjects(ids)
  }
  const remove = async (s: Subject) => {
    const imp = await subjectDeletionImpact(s.id)
    const ok = await confirm({
      title: `„${s.name}“ löschen?`,
      message: (
        <>
          Das löscht {imp.topics} Themen, {imp.questions} Fragen, {imp.decks} Kartenstapel, {imp.notes} Notizen, {imp.exams} Prüfungen und {imp.answers} gespeicherte Antworten. Materialien bleiben in der Bibliothek erhalten. <strong>Das lässt sich nicht rückgängig machen</strong> – erstelle vorher eine Sicherung, wenn du unsicher bist.
        </>
      ),
      confirmLabel: 'Endgültig löschen',
    })
    if (!ok) return
    await deleteSubject(s.id)
    toast({ title: `${s.name} gelöscht` })
  }

  return (
    <div>
      <PageHeader
        eyebrow="Fächer"
        title="Deine Fächer"
        description="Jedes Fach hat einen eigenen Arbeitsbereich mit Themen, Notizen, Material, Karteikarten, Quiz und Tutor."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true })}>
            Fach anlegen
          </Button>
        }
      />
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="Noch keine Fächer" description="Lege dein erstes Fach an oder übernimm den Beispiel-Lehrplan in den Einstellungen." action={<Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true })}>Fach anlegen</Button>} />
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s, i) => {
            const ts = topics.filter((t) => t.subjectId === s.id)
            const st = ts.map((t) => stats.get(t.id)).filter((x): x is NonNullable<typeof x> => !!x)
            const practiced = st.filter((x) => x.answers > 0)
            const nextExam = (exams ?? []).find((e) => e.subjectId === s.id && diffDays(today, e.date) >= 0)
            return (
              <li key={s.id} className="lift surface-raised flex flex-col rounded-lg border border-border bg-surface">
                <div className="flex items-start gap-3 p-4">
                  <Ring value={averageMastery(practiced)} size={48} stroke={4} label={`Durchschnittlicher Stand in ${s.name}`}>
                    <span className="text-xs">{practiced.length ? Math.round(averageMastery(practiced) * 100) : '–'}</span>
                  </Ring>
                  <Link to={`/faecher/${s.id}`} className="group min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <SubjectBadge subject={s} />
                      <h2 className="truncate text-md font-semibold group-hover:text-accent">{s.name}</h2>
                    </div>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {ts.length} Themen · {practiced.length} geübt
                    </p>
                  </Link>
                  <Menu
                    label={`Aktionen für ${s.name}`}
                    icon={MoreHorizontal}
                    items={[
                      { label: 'Bearbeiten', icon: Pencil, onSelect: () => setDialog({ open: true, subject: s }) },
                      { label: 'Nach oben', icon: ArrowUp, onSelect: () => move(i, -1), disabled: i === 0 },
                      { label: 'Nach unten', icon: ArrowDown, onSelect: () => move(i, 1), disabled: i === subjects.length - 1 },
                      { label: 'Löschen', icon: Trash2, onSelect: () => remove(s), danger: true },
                    ]}
                  />
                </div>
                <div className="mt-auto flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-fg-subtle">
                  {nextExam ? (
                    <Badge tone={diffDays(today, nextExam.date) <= 5 ? 'warn' : 'neutral'}>
                      {nextExam.type} {relativeDay(nextExam.date, today)}
                    </Badge>
                  ) : (
                    <span>Keine Prüfung eingetragen</span>
                  )}
                  {st.some((x) => x.level === 'struggling') && <Badge tone="warn">{st.filter((x) => x.level === 'struggling').length}× häufig falsch</Badge>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <SubjectDialog open={dialog.open} subject={dialog.subject} onClose={() => setDialog({ open: false })} />
    </div>
  )
}

function SubjectBadge({ subject }: { subject: Subject }) {
  const Icon = subjectIcon(subject)
  return <Icon className="size-4 shrink-0" style={{ color: subjectColorVar(subject.color) }} aria-hidden />
}
