import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, BarChart3, BookOpen, Copy, Dumbbell, FileDown, FileJson, GraduationCap, Layers, MessagesSquare, MoreHorizontal, Package, Pencil, Play, Plus, RotateCcw, Sigma, Sparkles, Target, Trash2, type LucideIcon } from 'lucide-react'
import { db } from '@/db/index'
import type { Question } from '@/db/types'
import { deleteQuestion, saveQuestion, updateTopic, ValidationError } from '@/db/repo'
import { startTopicExam } from '@/db/packages'
import { exportTopicPackage } from '@/features/packages/exportTopic'
import { computeTopicStats, LEVEL_LABELS } from '@/lib/mastery'
import { openMistakes } from '@/lib/mistakes'
import { formatDayLong, relativeDay } from '@/lib/dates'
import { SKILLS } from '@/lib/mathgen'
import { CURRICULUM_NOTICE } from '@/content/curriculum'
import { Badge, Button, ButtonLink, Card, Checkbox, Dialog, EmptyState, IconButton, LoadingBlock, Menu, Notice, ProgressBar, SectionHeader, Select, Tabs, Textarea, useConfirm, useToast } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useAi } from '@/hooks/data'
import { QuestionEditor } from '@/features/quiz/QuestionEditor'
import { AiPracticeDialog } from '@/features/quiz/AiPracticeDialog'
import { TYPE_LABELS } from '@/features/quiz/QuestionView'
import { TopicLearn } from './TopicLearn'

type Area = 'lernen' | 'pruefen' | 'fortschritt'
const AREAS: Area[] = ['lernen', 'pruefen', 'fortschritt']
const LEVEL_ORDER = ['easy', 'medium', 'hard'] as const
const LEVEL_NAME: Record<string, string> = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' }
const levelOf = (q: Question) => q.tags?.find((t) => t.startsWith('stufe:'))?.slice(6) ?? (q.difficulty <= 1 ? 'easy' : q.difficulty >= 3 ? 'hard' : 'medium')

const SOURCE_LABEL: Record<Question['source'], string> = { library: 'Beispiel', user: 'Eigene', generator: 'Generiert', material: 'Aus Material', ai: 'KI-erstellt', import: 'Lernpaket' }

export default function TopicPage() {
  const { topicId = '' } = useParams()
  const ai = useAi()
  const toast = useToast()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const topic = useLiveQuery(async () => (await db.topics.get(topicId)) ?? null, [topicId])
  const subject = useLiveQuery(() => (topic ? db.subjects.get(topic.subjectId) : undefined), [topic?.subjectId])
  const siblings = useLiveQuery(() => (topic ? db.topics.where('subjectId').equals(topic.subjectId).toArray() : []), [topic?.subjectId])
  const questions = useLiveQuery(() => db.questions.where('topicId').equals(topicId).filter((q) => q.source !== 'generator').toArray(), [topicId])
  const answers = useLiveQuery(() => db.answers.where('topicId').equals(topicId).toArray(), [topicId])
  const cardCount = useLiveQuery(() => db.cards.where('topicId').equals(topicId).count(), [topicId])
  const [editingQ, setEditingQ] = useState<Question | 'new' | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [descEdit, setDescEdit] = useState<string | null>(null)
  const [prereqOpen, setPrereqOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [params, setParams] = useSearchParams()
  const area: Area = AREAS.includes(params.get('bereich') as Area) ? (params.get('bereich') as Area) : 'lernen'
  const setArea = (a: Area) => setParams((p) => { p.set('bereich', a); return p }, { replace: true })
  const deckId = useLiveQuery(async () => (await db.cards.where('topicId').equals(topicId).first())?.deckId, [topicId])
  const noteCount = useLiveQuery(() => db.notes.where('topicId').equals(topicId).count(), [topicId])

  const stats = useMemo(() => (answers ? computeTopicStats(topicId, answers) : null), [answers, topicId])
  const open = useMemo(() => (answers ? openMistakes(answers) : []), [answers])
  if (topic === undefined || !questions || !stats || !siblings) return <LoadingBlock />
  if (!topic) return <Notice tone="warn" title="Thema nicht gefunden">Es wurde vielleicht gelöscht.</Notice>
  const skills = SKILLS.filter((s) => s.topicKey === topic.id)
  const prereqs = siblings.filter((t) => topic.prerequisiteIds.includes(t.id))
  const dependents = siblings.filter((t) => t.prerequisiteIds.includes(topic.id))
  const shown = questions.filter((q) => !filter || q.type === filter)
  const tests = shown.filter((q) => !q.tags?.includes('uebung'))
  const exercises = shown.filter((q) => q.tags?.includes('uebung'))
  const hasExam = questions.some((q) => q.tags?.includes('pruefung'))
  const startExam = async () => {
    try {
      navigate(`/quiz/${await startTopicExam(topic.id)}`)
    } catch (e) {
      toast({ title: e instanceof ValidationError ? e.message : 'Das hat nicht geklappt', tone: 'danger' })
    }
  }
  const row = (q: Question) => {
    const qa = answers!.filter((a) => a.questionId === q.id)
    return (
      <div key={q.id} className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge>{TYPE_LABELS[q.type]}</Badge>
            <Badge>{SOURCE_LABEL[q.source]}</Badge>
            {q.tags?.includes('pruefung') && <Badge tone="accent">Prüfung</Badge>}
            <span className="text-xs text-fg-subtle">Schwierigkeit {q.difficulty}</span>
            {qa.length > 0 && <span className="text-xs text-fg-subtle">· {qa.filter((a) => a.correct).length}/{qa.length} richtig</span>}
            {open.some((m) => m.questionId === q.id) && <Badge tone="warn">offener Fehler</Badge>}
          </div>
          <div className="line-clamp-2 text-sm"><Markdown inline>{q.prompt.replace(/\n+/g, ' ')}</Markdown></div>
        </div>
        <IconButton label="Bearbeiten" icon={Pencil} size="sm" onClick={() => setEditingQ(q)} />
        <IconButton label="Duplizieren" icon={Copy} size="sm" onClick={async () => { const { id: _id, createdAt: _c, ...rest } = q; await saveQuestion({ ...rest, source: 'user', prompt: `${q.prompt}` }); toast({ title: 'Kopie angelegt' }) }} />
        <IconButton label="Löschen" icon={Trash2} size="sm" onClick={async () => { if (await confirm({ title: 'Frage löschen?', message: 'Bisherige Antworten bleiben in deiner Statistik.' })) await deleteQuestion(q.id) }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Link to={`/faecher/${topic.subjectId}?tab=topics`} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {subject?.name ?? 'Fach'}
      </Link>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">Thema</span>
          {topic.curriculum === 'example-unverified' && <Badge title={CURRICULUM_NOTICE}>Beispiel-Lehrplan · nicht amtlich geprüft</Badge>}
        </div>
        <h1 className="text-2xl font-semibold">{topic.name}</h1>
        {descEdit === null ? (
          <div className="flex items-start gap-2">
            <p className="max-w-2xl text-fg-muted">{topic.description || 'Keine Beschreibung.'}</p>
            <IconButton label="Beschreibung bearbeiten" icon={Pencil} size="sm" onClick={() => setDescEdit(topic.description)} />
          </div>
        ) : (
          <div className="flex max-w-2xl flex-col gap-2">
            <Textarea value={descEdit} onChange={(e) => setDescEdit(e.target.value)} rows={3} aria-label="Beschreibung" autoFocus />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={async () => { await updateTopic(topic.id, { description: descEdit }); setDescEdit(null) }}>Speichern</Button>
              <Button size="sm" onClick={() => setDescEdit(null)}>Abbrechen</Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <ButtonLink to={`/tutor?subject=${topic.subjectId}&topic=${topic.id}`} icon={MessagesSquare}>Tutor fragen</ButtonLink>
          {skills.length > 0 && <ButtonLink to="/mathe" icon={Sigma}>Mathe-Modus</ButtonLink>}
          <Menu label="Weitere Aktionen zum Thema" icon={MoreHorizontal} align="left" items={[
            { label: 'Als Lernpaket exportieren (JSON)', icon: FileJson, onSelect: () => void exportTopicPackage(topic.id, 'json').then(() => toast({ title: 'Lernpaket exportiert', description: 'Die JSON-Datei kann auf jedem Gerät wieder importiert werden.', tone: 'success' })) },
            { label: 'Als Lernpaket exportieren (Markdown)', icon: FileDown, onSelect: () => void exportTopicPackage(topic.id, 'markdown').then(() => toast({ title: 'Lernpaket als Markdown exportiert', tone: 'success' })) },
            { label: 'Lernpaket importieren …', icon: Package, onSelect: () => navigate(`/bibliothek/lernpaket?fach=${topic.subjectId}`) },
          ]} />
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <Tabs<Area> label="Bereiche des Themas" value={area} onChange={setArea} tabs={[
          { id: 'lernen', label: 'Lernen', icon: BookOpen, count: noteCount },
          { id: 'pruefen', label: 'Üben & Prüfen', icon: Target, count: questions.length },
          { id: 'fortschritt', label: 'Fortschritt', icon: BarChart3 },
        ]} />

        {area === 'lernen' && <TopicLearn subjectId={topic.subjectId} topicId={topic.id} />}

        {area === 'pruefen' && (
          <div className="flex flex-col gap-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard to={`/quiz/neu?topic=${topic.id}&preset=${stats.level === 'new' ? 'learn' : 'practice'}`} icon={Play} primary title={stats.level === 'new' ? 'Einstieg üben' : 'Gezielt üben'} text="Gemischte Fragen, angepasst an deinen Stand." />
              {hasExam && <ActionCard onClick={() => void startExam()} icon={GraduationCap} title="Prüfungsmodus" text="Test mit Zeitlimit – wie in der Klassenarbeit." />}
              {open.length > 0 && <ActionCard to={`/quiz/neu?topic=${topic.id}&preset=mistakes`} icon={RotateCcw} title={`${open.length} Fehler wiederholen`} text="Genau die Fragen, die zuletzt falsch waren." />}
              {deckId && <ActionCard to={`/karteikarten/${deckId}`} icon={Layers} title="Karteikarten" text={`${cardCount ?? 0} Karten mit Wiederholungsplan.`} />}
              {stats.challengeReady && <ActionCard to={`/quiz/neu?topic=${topic.id}&preset=challenge`} icon={Dumbbell} title="Herausforderung" text="Die schwersten Aufgaben für Fortgeschrittene." />}
            </div>

            <section aria-labelledby="questions" className="flex flex-col gap-4">
              <SectionHeader
                id="questions"
                title={`Fragen (${questions.length})`}
                description={skills.length ? 'Zusätzlich gibt es für dieses Thema unbegrenzt generierte Rechenaufgaben.' : undefined}
                action={
                  <div className="flex flex-wrap gap-2">
                    <Select aria-label="Fragetyp filtern" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-36 text-sm">
                      <option value="">Alle Typen</option>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    {ai?.ok && <Button size="sm" icon={Sparkles} onClick={() => setAiOpen(true)}>KI-Vorschläge</Button>}
                    <Button size="sm" variant="primary" icon={Plus} onClick={() => setEditingQ('new')}>Frage</Button>
                  </div>
                }
              />
              {questions.length === 0 ? (
                <EmptyState compact title="Noch keine Fragen" description="Lege eigene Fragen an, erstelle welche aus deinem Material oder lass dir von der KI Vorschläge machen." action={<Button variant="primary" icon={Plus} onClick={() => setEditingQ('new')}>Erste Frage anlegen</Button>} />
              ) : (
                <>
                  {tests.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-sm font-semibold">Testfragen ({tests.length})</h3>
                      <Card className="divide-y divide-border">{tests.map(row)}</Card>
                    </div>
                  )}
                  {LEVEL_ORDER.map((lv) => {
                    const list = exercises.filter((q) => levelOf(q) === lv)
                    return list.length > 0 && (
                      <div key={lv} className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Übungsaufgaben · {LEVEL_NAME[lv]} ({list.length})</h3>
                        <Card className="divide-y divide-border">{list.map(row)}</Card>
                      </div>
                    )
                  })}
                </>
              )}
            </section>
          </div>
        )}

        {area === 'fortschritt' && (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <Card className="flex flex-col gap-3 p-5 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-md font-semibold">Dein Stand</h2>
                <Badge tone={stats.level === 'struggling' ? 'warn' : stats.level === 'mastered' || stats.level === 'solid' ? 'success' : 'neutral'}>{LEVEL_LABELS[stats.level]}</Badge>
              </div>
              <ProgressBar value={stats.mastery} label="Beherrschung" tone={stats.level === 'struggling' ? 'warn' : stats.level === 'mastered' ? 'success' : 'accent'} showValue />
              <p className="text-sm text-fg-muted">{stats.explanation}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-fg-subtle">Antworten</dt><dd className="font-semibold tabular">{stats.answers}</dd></div>
                <div><dt className="text-xs text-fg-subtle">Richtig</dt><dd className="font-semibold tabular">{stats.correct}</dd></div>
                <div><dt className="text-xs text-fg-subtle">Lerntage</dt><dd className="font-semibold tabular">{stats.distinctDays}</dd></div>
                <div><dt className="text-xs text-fg-subtle">Wiederholen</dt><dd className="font-semibold">{stats.nextReview ? relativeDay(stats.nextReview) : '–'}</dd></div>
              </dl>
              {stats.nextReview && <p className="text-xs text-fg-subtle">Nächste Wiederholung laut Plan: {formatDayLong(stats.nextReview)}.</p>}
            </Card>
            <Card className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-md font-semibold">Zusammenhänge</h2>
                <Button size="sm" variant="ghost" onClick={() => setPrereqOpen(true)}>Bearbeiten</Button>
              </div>
              <div className="text-sm">
                <div className="text-xs text-fg-subtle">Baut auf</div>
                {prereqs.length ? prereqs.map((p) => <Link key={p.id} to={`/faecher/${p.subjectId}/themen/${p.id}`} className="block text-accent hover:underline">{p.name}</Link>) : <span className="text-fg-muted">keinem anderen Thema auf</span>}
              </div>
              <div className="text-sm">
                <div className="text-xs text-fg-subtle">Ist Grundlage für</div>
                {dependents.length ? dependents.map((p) => <Link key={p.id} to={`/faecher/${p.subjectId}/themen/${p.id}`} className="block text-accent hover:underline">{p.name}</Link>) : <span className="text-fg-muted">–</span>}
              </div>
              <p className="text-xs text-fg-subtle">Grundlagen werden bei Empfehlungen und im Lernplan vorgezogen. {cardCount ? `${cardCount} Karteikarten gehören zu diesem Thema.` : ''}</p>
            </Card>
          </div>
        )}
      </div>

      <QuestionEditor open={!!editingQ} onClose={() => setEditingQ(null)} subjectId={topic.subjectId} topicId={topic.id} question={editingQ === 'new' ? undefined : editingQ ?? undefined} />
      <AiPracticeDialog open={aiOpen} onClose={() => setAiOpen(false)} topicId={topic.id} />
      <Dialog open={prereqOpen} onClose={() => setPrereqOpen(false)} title="Worauf baut das Thema auf?" description="Wähle Themen, die man vorher verstanden haben sollte." footer={<Button variant="primary" onClick={() => setPrereqOpen(false)}>Fertig</Button>}>
        <div className="flex flex-col">
          {siblings.filter((t) => t.id !== topic.id).map((t) => (
            <Checkbox key={t.id} checked={topic.prerequisiteIds.includes(t.id)} onChange={(v) => updateTopic(topic.id, { prerequisiteIds: v ? [...topic.prerequisiteIds, t.id] : topic.prerequisiteIds.filter((x) => x !== t.id) })} label={t.name} />
          ))}
          {siblings.length <= 1 && <p className="text-sm text-fg-muted">Keine weiteren Themen in diesem Fach.</p>}
        </div>
      </Dialog>
    </div>
  )
}

function ActionCard({ to, onClick, icon: Icon, title, text, primary }: { to?: string; onClick?: () => void; icon: LucideIcon; title: string; text: string; primary?: boolean }) {
  const cls = `lift surface-raised flex items-start gap-3 rounded-lg border p-4 text-left ${primary ? 'border-accent bg-accent-soft/40' : 'border-border bg-surface hover:border-border-strong'}`
  const body = (
    <>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${primary ? 'bg-accent-solid text-accent-fg' : 'bg-surface-2 text-fg-muted'}`}><Icon className="size-4" aria-hidden /></span>
      <span className="min-w-0"><span className="block font-medium">{title}</span><span className="block text-sm text-fg-muted">{text}</span></span>
    </>
  )
  return to ? <Link to={to} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>{body}</button>
}
