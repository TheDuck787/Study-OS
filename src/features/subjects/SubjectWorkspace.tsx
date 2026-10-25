import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BookOpen, CalendarClock, FileText, FileUp, Layers, LayoutGrid, ListChecks, MessagesSquare, MoreHorizontal, NotebookPen, Package, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import { deleteSubject, subjectDeletionImpact } from '@/db/repo'
import { useExams, useOpenMistakes, useTopicStats } from '@/hooks/data'
import { averageMastery, LEVEL_LABELS } from '@/lib/mastery'
import { recommendTopics } from '@/lib/recommend'
import { dayKey, diffDays, relativeDay } from '@/lib/dates'
import { Badge, Button, ButtonLink, Card, EmptyState, LoadingBlock, Menu, Notice, PageHeader, Ring, SectionHeader, SubjectDot, Tabs, useConfirm } from '@/components/ui'
import { TopicTree } from './TopicTree'
import { SubjectDialog } from './SubjectDialog'
import { NotesList } from '@/features/notes/NotesList'
import { MaterialsList } from '@/features/library/LibraryPage'
import { DeckList } from '@/features/flashcards/DeckList'
import { MistakeList } from '@/features/mistakes/MistakesPage'
import { ExamList, TeacherGrades } from '@/features/exams/ExamsPage'
import { ExamForm } from '@/features/exams/ExamForm'
import { TutorChat } from '@/features/tutor/TutorChat'

type Tab = 'overview' | 'topics' | 'notes' | 'materials' | 'cards' | 'quiz' | 'mistakes' | 'exams' | 'tutor'

export default function SubjectWorkspace() {
  const { subjectId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const tab = (params.get('tab') as Tab) ?? 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const subject = useLiveQuery(async () => (await db.subjects.get(subjectId)) ?? null, [subjectId])
  const topics = useLiveQuery(() => db.topics.where('subjectId').equals(subjectId).sortBy('order'), [subjectId])
  const materials = useLiveQuery(() => db.materials.where('subjectId').equals(subjectId).reverse().sortBy('createdAt'), [subjectId])
  const counts = useLiveQuery(async () => ({
    notes: await db.notes.where('subjectId').equals(subjectId).count(),
    decks: await db.decks.where('subjectId').equals(subjectId).count(),
    questions: await db.questions.where('subjectId').equals(subjectId).filter((q) => q.source !== 'generator').count(),
  }), [subjectId])
  const attempts = useLiveQuery(() => db.attempts.where('subjectId').equals(subjectId).reverse().sortBy('startedAt'), [subjectId])
  const { stats } = useTopicStats()
  const mistakes = useOpenMistakes()
  const exams = useExams()
  const [editOpen, setEditOpen] = useState(false)
  const [examOpen, setExamOpen] = useState(false)
  const today = dayKey()

  const subjectMistakes = useMemo(() => (mistakes ?? []).filter((m) => m.subjectId === subjectId), [mistakes, subjectId])
  const recs = useMemo(() => (subject && topics && mistakes && exams ? recommendTopics({ topics, subjects: [subject], stats, mistakes, exams, today }) : []), [subject, topics, stats, mistakes, exams, today])

  if (subject === undefined || !topics || !counts || !materials) return <LoadingBlock />
  if (!subject) return <Notice tone="warn" title="Fach nicht gefunden" />
  const subjectExams = (exams ?? []).filter((e) => e.subjectId === subjectId)
  const nextExam = subjectExams.find((e) => diffDays(today, e.date) >= 0)
  const practiced = topics.map((t) => stats.get(t.id)).filter((s): s is NonNullable<typeof s> => !!s && s.answers > 0)

  const remove = async () => {
    const imp = await subjectDeletionImpact(subject.id)
    if (await confirm({ title: `„${subject.name}“ löschen?`, message: `Das löscht ${imp.topics} Themen, ${imp.questions} Fragen, ${imp.decks} Stapel, ${imp.notes} Notizen, ${imp.exams} Prüfungen und ${imp.answers} Antworten. Materialien bleiben in der Bibliothek.`, confirmLabel: 'Endgültig löschen' })) {
      await deleteSubject(subject.id)
      navigate('/faecher')
    }
  }

  const tabs: { id: Tab; label: string; count?: number; icon?: typeof BookOpen }[] = [
    { id: 'overview', label: 'Überblick', icon: LayoutGrid },
    { id: 'topics', label: 'Themen', count: topics.length, icon: BookOpen },
    { id: 'notes', label: 'Notizen', count: counts.notes, icon: NotebookPen },
    { id: 'materials', label: 'Material', count: materials.length, icon: FileText },
    { id: 'cards', label: 'Karteikarten', count: counts.decks, icon: Layers },
    { id: 'quiz', label: 'Quiz', icon: ListChecks },
    { id: 'mistakes', label: 'Fehler', count: subjectMistakes.length, icon: RotateCcw },
    { id: 'exams', label: 'Prüfungen', count: subjectExams.filter((e) => diffDays(today, e.date) >= 0).length, icon: CalendarClock },
    { id: 'tutor', label: 'Tutor', icon: MessagesSquare },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Link to="/faecher" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Fächer
      </Link>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-2"><SubjectDot color={subject.color} /> Fach</span>}
        title={subject.name}
        description={nextExam ? `${nextExam.type} „${nextExam.title}“ ${relativeDay(nextExam.date, today)}.` : `${topics.length} Themen · ${counts.questions} Fragen`}
        actions={
          <>
            <ButtonLink to={`/quiz/neu?subject=${subject.id}`} variant="primary" icon={Play}>Üben</ButtonLink>
            <Menu label="Fach-Aktionen" icon={MoreHorizontal} items={[{ label: 'Umbenennen / Farbe', icon: Pencil, onSelect: () => setEditOpen(true) }, { label: 'Lernpaket importieren', icon: Package, onSelect: () => navigate(`/bibliothek/lernpaket?fach=${subject.id}`) }, { label: 'Fach löschen', icon: Trash2, danger: true, onSelect: remove }]} />
          </>
        }
      />
      <Tabs label="Bereiche des Fachs" value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'overview' && (
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <section>
              <SectionHeader title="Als Nächstes in diesem Fach" description="Aus deinen Antworten, Fehlern und Prüfungsterminen berechnet." />
              {topics.length === 0 ? (
                <EmptyState compact title="Dieses Fach ist noch leer" description="Lege deine Themen an, z. B. die aus deinem Unterricht. Danach kannst du Notizen, Karteikarten und Aufgaben dazu erstellen." action={<Button variant="primary" onClick={() => setTab('topics')}>Erstes Thema anlegen</Button>} />
              ) : recs.length === 0 ? (
                <EmptyState compact title={practiced.length ? 'Gerade nichts Dringendes' : 'Noch keine Lerndaten'} description={practiced.length ? 'Alles im grünen Bereich. Du kannst ein neues Thema anfangen.' : 'Übe ein Thema – dann erscheinen hier begründete Empfehlungen.'} action={<Button onClick={() => setTab('topics')}>Themen ansehen</Button>} />
              ) : (
                <div className="flex flex-col gap-2">
                  {recs.slice(0, 4).map((r) => (
                    <Link key={r.topicId} to={`/quiz/neu?topic=${r.topicId}&preset=${r.action}`} className="lift surface-raised group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:border-border-strong">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium group-hover:text-accent">{topics.find((t) => t.id === r.topicId)?.name}: {r.actionLabel}</div>
                        <div className="truncate text-sm text-fg-muted">{r.reasons.join(' · ')}</div>
                      </div>
                      <span className="text-sm text-fg-subtle">≈ {r.estMinutes} Min.</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeader title="Stand je Thema" action={<Button size="sm" variant="ghost" onClick={() => setTab('topics')}>Bearbeiten</Button>} />
              <Card className="divide-y divide-border">
                {topics.filter((t) => !t.parentId).map((t) => {
                  const s = stats.get(t.id)
                  return (
                    <Link key={t.id} to={`/faecher/${subject.id}/themen/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="truncate text-sm">{t.name}</span>
                      {s && s.answers > 0 ? <Badge tone={s.level === 'struggling' ? 'warn' : s.level === 'mastered' || s.level === 'solid' ? 'success' : 'neutral'}>{LEVEL_LABELS[s.level]} · {Math.round(s.mastery * 100)} %</Badge> : <span className="text-xs text-fg-subtle">noch nicht geübt</span>}
                    </Link>
                  )
                })}
                {topics.length === 0 && <p className="px-4 py-3 text-sm text-fg-muted">Noch keine Themen – über „Bearbeiten“ legst du sie an.</p>}
              </Card>
            </section>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card className="flex items-center gap-4 p-4">
              <Ring value={averageMastery(practiced)} size={64} stroke={6} label={`Durchschnittlicher Stand in ${subject.name}`} />
              <div className="text-sm">
                <div className="font-semibold">Durchschnitt geübter Themen</div>
                <div className="text-fg-muted">{practiced.length} von {topics.length} Themen geübt · {subjectMistakes.length} offene Fehler</div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink to={`/bibliothek/notiz/neu?subject=${subject.id}`} icon={NotebookPen}>Notiz</ButtonLink>
              <ButtonLink to={`/bibliothek/import?subject=${subject.id}`} icon={FileUp}>Material</ButtonLink>
              <Button icon={CalendarClock} onClick={() => setExamOpen(true)}>Prüfung</Button>
              <ButtonLink to={`/tutor?subject=${subject.id}`} icon={MessagesSquare}>Tutor</ButtonLink>
            </div>
            <section>
              <SectionHeader title="Echte Noten" />
              <TeacherGrades subjectId={subject.id} />
            </section>
          </div>
        </div>
      )}
      {tab === 'topics' && <TopicTree subjectId={subject.id} topics={topics} stats={stats} />}
      {tab === 'notes' && <NotesList subjectId={subject.id} />}
      {tab === 'materials' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end"><ButtonLink size="sm" icon={FileUp} to={`/bibliothek/import?subject=${subject.id}`}>Importieren</ButtonLink></div>
          <MaterialsList materials={materials} />
        </div>
      )}
      {tab === 'cards' && <DeckList subjectId={subject.id} />}
      {tab === 'quiz' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/quiz/neu?subject=${subject.id}`} variant="primary" icon={ListChecks}>Quiz zusammenstellen</ButtonLink>
            <ButtonLink to={`/quiz/neu?subject=${subject.id}&mode=exam`}>Test unter Prüfungsbedingungen</ButtonLink>
            {subjectMistakes.length > 0 && <ButtonLink to={`/quiz/neu?preset=mistakes&subject=${subject.id}`} icon={RotateCcw}>Fehler wiederholen</ButtonLink>}
          </div>
          <p className="text-sm text-fg-muted">{counts.questions} gespeicherte Fragen in diesem Fach. Eigene Fragen legst du auf der Seite eines Themas an.</p>
          {attempts && attempts.length > 0 && (
            <Card className="divide-y divide-border">
              {attempts.slice(0, 15).map((a) => (
                <Link key={a.id} to={`/quiz/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                  <span className="truncate">{a.title}</span>
                  <span className="shrink-0 tabular text-fg-muted">{a.finishedAt ? `${Math.round(a.percent)} %` : 'nicht beendet'}</span>
                </Link>
              ))}
            </Card>
          )}
        </div>
      )}
      {tab === 'mistakes' && (subjectMistakes.length === 0 ? <EmptyState compact title="Keine offenen Fehler" /> : (
        <div className="flex flex-col gap-3">
          <ButtonLink to={`/quiz/neu?preset=mistakes&subject=${subject.id}`} variant="primary" icon={RotateCcw} className="self-start">Jetzt wiederholen</ButtonLink>
          <MistakeList mistakes={subjectMistakes} />
        </div>
      ))}
      {tab === 'exams' && (
        <div className="flex flex-col gap-4">
          <Button variant="primary" icon={CalendarClock} className="self-start" onClick={() => setExamOpen(true)}>Prüfung eintragen</Button>
          <ExamList subjectId={subject.id} />
        </div>
      )}
      {tab === 'tutor' && <TutorChat subjectId={subject.id} compact />}
      <SubjectDialog open={editOpen} onClose={() => setEditOpen(false)} subject={subject} />
      <ExamForm open={examOpen} onClose={() => setExamOpen(false)} subjectId={subject.id} />
    </div>
  )
}
