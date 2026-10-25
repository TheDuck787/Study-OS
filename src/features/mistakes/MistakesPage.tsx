import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle2, Play, RotateCcw } from 'lucide-react'
import { db } from '@/db/index'
import { recurringPatterns, CORRECT_TO_RESOLVE, type OpenMistake } from '@/lib/mistakes'
import { expectedAnswerText } from '@/lib/answerCheck'
import { formatDate } from '@/lib/dates'
import { Badge, ButtonLink, Card, EmptyState, LoadingBlock, PageHeader, SectionHeader, Select } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { useAnswers, useOpenMistakes, useSubjects, useTopics } from '@/hooks/data'

export function MistakeList({ mistakes, limit }: { mistakes: OpenMistake[]; limit?: number }) {
  const ids = mistakes.slice(0, limit ?? 200).map((m) => m.questionId)
  const questions = useLiveQuery(() => db.questions.bulkGet(ids), [ids.join(',')])
  const topics = useTopics()
  if (!questions) return <LoadingBlock />
  return (
    <ul className="flex flex-col gap-3">
      {mistakes.slice(0, limit ?? 200).map((m, i) => {
        const q = questions[i]
        if (!q) return null
        const given = q.type === 'mc' ? q.options?.[Number(m.lastWrong.given)] ?? m.lastWrong.given : q.type === 'tf' ? (m.lastWrong.given === 'true' ? 'Wahr' : 'Falsch') : m.lastWrong.given
        return (
          <li key={m.questionId}>
            <Card className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <span>{topics?.find((t) => t.id === m.topicId)?.name ?? 'Vokabeln'}</span>
                <span>· zuletzt falsch am {formatDate(m.lastWrong.at)}</span>
                {m.wrongCount > 1 && <Badge tone="warn">{m.wrongCount}× falsch</Badge>}
                {m.correctSince > 0 && <Badge tone="success">{m.correctSince}/{CORRECT_TO_RESOLVE} richtig seitdem</Badge>}
              </div>
              <Markdown className="text-sm">{q.prompt}</Markdown>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                  <dt className="text-xs text-fg-subtle">Deine letzte Antwort</dt>
                  <dd className="break-words"><Markdown inline>{given || '—'}</Markdown></dd>
                </div>
                <div className="min-w-0 rounded-md bg-surface-2 px-3 py-2">
                  <dt className="text-xs text-fg-subtle">Richtig wäre</dt>
                  <dd className="break-words"><Markdown inline>{expectedAnswerText(q)}</Markdown></dd>
                </div>
              </dl>
              {m.lastWrong.feedback && <p className="mt-2 text-sm text-fg-muted"><Markdown inline>{m.lastWrong.feedback}</Markdown></p>}
              {q.explanation && <div className="mt-2 text-sm text-fg-muted"><Markdown>{q.explanation}</Markdown></div>}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

export default function MistakesPage() {
  const mistakes = useOpenMistakes()
  const answers = useAnswers()
  const subjects = useSubjects()
  const topics = useTopics()
  const [subject, setSubject] = useState('')
  const patterns = useMemo(() => (answers ? recurringPatterns(answers) : []), [answers])
  if (!mistakes || !subjects) return <LoadingBlock />
  const list = mistakes.filter((m) => !subject || m.subjectId === subject)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Fehler wiederholen"
        title="Aus Fehlern lernen"
        description={`Jede falsch beantwortete Frage bleibt hier, bis du sie ${CORRECT_TO_RESOLVE}-mal hintereinander richtig beantwortet hast. So verschwindet nichts durch einen Glückstreffer.`}
        actions={
          list.length > 0 && (
            <ButtonLink to={`/quiz/neu?preset=mistakes${subject ? `&subject=${subject}` : ''}`} variant="primary" icon={Play}>
              {Math.min(10, list.length)} Fehler wiederholen
            </ButtonLink>
          )
        }
      />
      {patterns.length > 0 && (
        <section>
          <SectionHeader title="Wiederkehrende Muster" description="Fehlerarten und Themen, die mehrfach vorkommen." />
          <div className="flex flex-wrap gap-2">
            {patterns.map((p) => (
              <Badge key={p.key} tone="warn">
                {p.topicId ? `${topics?.find((t) => t.id === p.topicId)?.name ?? 'Thema'} (${p.count} Fehler)` : `${p.label} (${p.count}×)`}
              </Badge>
            ))}
          </div>
        </section>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-md font-semibold">{list.length} offene Fehler</h2>
        <Select aria-label="Nach Fach filtern" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 w-48">
          <option value="">Alle Fächer</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={answers?.length ? CheckCircle2 : RotateCcw} title={answers?.length ? 'Keine offenen Fehler' : 'Noch keine Antworten'} description={answers?.length ? 'Alles nachgearbeitet. Neue Fehler erscheinen hier automatisch.' : 'Sobald du übst, sammeln sich hier die Fragen, die du noch einmal ansehen solltest.'} />
      ) : (
        <MistakeList mistakes={list} />
      )}
    </div>
  )
}
