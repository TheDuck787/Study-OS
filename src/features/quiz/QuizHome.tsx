import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { History, Languages, ListChecks, RotateCcw, Timer, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import { deleteAttempt } from '@/db/repo'
import { formatDateTime } from '@/lib/dates'
import { recurringPatterns } from '@/lib/mistakes'
import { BUILTIN_SCALES, percentToGrade } from '@/lib/grading'
import { Badge, ButtonLink, Card, EmptyState, IconButton, LoadingBlock, PageHeader, SectionHeader, Select, useConfirm } from '@/components/ui'
import { useOpenMistakes, useSubjects, useTopics } from '@/hooks/data'

const KIND_LABEL: Record<string, string> = { practice: 'Übung', exam: 'Test', quick: '5 Minuten', diagnostic: 'Diagnose', mock: 'Probeklausur', mistakes: 'Fehler', math: 'Mathe' }

export default function QuizHome() {
  const attempts = useLiveQuery(() => db.attempts.orderBy('startedAt').reverse().toArray(), [])
  const scales = useLiveQuery(() => db.gradingScales.toArray(), [])
  const answers = useLiveQuery(() => db.answers.toArray(), [])
  const subjects = useSubjects()
  const topics = useTopics()
  const mistakes = useOpenMistakes()
  const confirm = useConfirm()
  const [subject, setSubject] = useState('')
  const patterns = useMemo(() => (answers ? recurringPatterns(answers, new Date(Date.now() - 30 * 86_400_000).toISOString()) : []), [answers])
  const subjectName = (id: string | null) => subjects?.find((s) => s.id === id)?.name
  const topicName = (id?: string) => topics?.find((t) => t.id === id)?.name

  if (!attempts || !subjects) return <LoadingBlock />
  const list = attempts.filter((a) => !subject || a.subjectId === subject)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Quiz"
        title="Üben und testen"
        description="Fragen einzeln beantworten, Rückmeldung bekommen, Fehler später wiederholen."
        actions={
          <ButtonLink to="/quiz/neu" variant="primary" icon={ListChecks}>
            Quiz zusammenstellen
          </ButtonLink>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <QuickStart to="/quiz/neu?preset=quick" icon={Timer} title="5-Minuten-Runde" text="Sechs Fragen, ausgewählt nach Fehlern und Dringlichkeit." />
        <QuickStart to="/quiz/neu?preset=mistakes" icon={RotateCcw} title="Fehler wiederholen" text={mistakes ? `${mistakes.length} offene Fehler` : '…'} />
        <QuickStart to="/quiz/neu?deck=" icon={Languages} title="Vokabeltest" text="Ein Wort nach dem anderen, mit Tippfehler-Erkennung." />
      </div>

      {patterns.length > 0 && (
        <section aria-labelledby="patterns">
          <SectionHeader id="patterns" title="Wiederkehrende Fehler" description="Muster aus den letzten 30 Tagen." />
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <Badge key={p.key} tone="warn">
                {p.topicId ? `${topicName(p.topicId) ?? 'Thema'}: ` : ''}
                {p.topicId ? `${p.count} Fehler` : `${p.label} (${p.count}×)`}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="history">
        <SectionHeader
          id="history"
          title="Bisherige Versuche"
          action={
            <Select aria-label="Nach Fach filtern" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 w-44 text-sm">
              <option value="">Alle Fächer</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          }
        />
        {list.length === 0 ? (
          <EmptyState icon={History} title="Noch keine Versuche" description="Starte ein Quiz – deine Ergebnisse erscheinen dann hier." />
        ) : (
          <Card as="div" className="divide-y divide-border">
            {list.slice(0, 60).map((a) => {
              const scale = scales?.find((s) => s.id === a.gradingScaleId) ?? BUILTIN_SCALES[0]
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Link to={`/quiz/${a.id}`} className="min-w-0 flex-1 group">
                    <div className="truncate text-sm font-medium group-hover:text-accent">{a.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                      <span>{formatDateTime(a.startedAt)}</span>
                      {subjectName(a.subjectId) && <span>· {subjectName(a.subjectId)}</span>}
                      <span>· {a.questionIds.length} Fragen</span>
                    </div>
                  </Link>
                  <Badge>{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                  {a.finishedAt ? (
                    <div className="w-24 text-right text-sm tabular">
                      <div className="font-semibold">{Math.round(a.percent)} %</div>
                      <div className="text-xs text-fg-subtle">Note ≈ {percentToGrade(a.percent, scale).label}</div>
                    </div>
                  ) : (
                    <Link to={`/quiz/${a.id}`} className="w-24 text-right text-sm text-accent">Fortsetzen</Link>
                  )}
                  <IconButton
                    label="Versuch löschen"
                    icon={Trash2}
                    size="sm"
                    onClick={async () => {
                      if (await confirm({ title: 'Versuch löschen?', message: 'Die Antworten dieses Versuchs werden auch aus deiner Lernstatistik entfernt.' })) await deleteAttempt(a.id)
                    }}
                  />
                </div>
              )
            })}
          </Card>
        )}
      </section>
    </div>
  )
}

function QuickStart({ to, icon: Icon, title, text }: { to: string; icon: typeof Timer; title: string; text: string }) {
  return (
    <Link to={to} className="lift surface-raised group flex items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold group-hover:text-accent">{title}</span>
        <span className="block text-sm text-fg-muted">{text}</span>
      </span>
    </Link>
  )
}
