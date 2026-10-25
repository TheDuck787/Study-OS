import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck2, Clock, Flag, GraduationCap, Layers, ListChecks, Target } from 'lucide-react'
import { db } from '@/db/index'
import type { Exam } from '@/db/types'
import { Badge, Card, ProgressBar, SectionHeader, StatTile } from '@/components/ui'
import { dayKey, formatMinutes, parseDay, relativeDay } from '@/lib/dates'
import { examPreparation, READY_MASTERY } from '@/lib/calendar/prep'
import { LEVEL_LABELS } from '@/lib/mastery'

/** Exam preparation overview – every number is calculated from stored learning data. */
export function PrepPanel({ exam }: { exam: Exam }) {
  const today = dayKey()
  const data = useLiveQuery(async () => ({
    answers: await db.answers.toArray(), topics: await db.topics.toArray(), decks: await db.decks.toArray(), cards: await db.cards.toArray(),
    cardReviews: await db.cardReviews.toArray(), attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(), events: await db.events.toArray(),
  }), [])
  const p = useMemo(() => (data ? examPreparation({ exam, ...data, today }) : null), [data, exam, today])
  if (!p) return <div className="h-32 animate-pulse rounded-lg bg-surface-2" />
  if (p.daysLeft < 0) return null
  return (
    <section aria-labelledby="prep" className="flex flex-col gap-4">
      <SectionHeader id="prep" title="Vorbereitung" description={`Vorbereitung = Durchschnitt deiner gemessenen Beherrschung je Thema (voll ab ${Math.round(READY_MASTERY * 100)} %). Dein Gefühl wird daneben gezeigt, aber nicht eingerechnet.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Clock} label="Noch" value={p.daysLeft === 0 ? 'heute' : `${p.daysLeft} Tag${p.daysLeft === 1 ? '' : 'e'}`} sub={parseDay(exam.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} />
        <StatTile icon={Target} label="Vorbereitung" value={p.readiness === null ? '–' : `${Math.round(p.readiness * 100)} %`} sub={`${p.topics.filter((t) => !t.needsRevision).length} von ${p.topics.length} Themen sicher`} />
        <StatTile icon={ListChecks} label="Lernplan" value={`${p.planDone}/${p.planTotal}`} sub={`noch ${formatMinutes(p.remainingPlannedMinutes)} geplant`} />
        <StatTile icon={Layers} label="Karten bis zur Prüfung" value={p.cardsDueBeforeExam} sub={`${p.cardsDueToday} heute fällig`} />
      </div>
      {p.readiness !== null && <ProgressBar value={p.readiness} label="Vorbereitung" tone={p.readiness >= 0.75 ? 'success' : 'accent'} showValue />}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-1.5 p-4 text-sm">
          <div className="font-semibold">Aufwand</div>
          <div className="flex justify-between"><span className="text-fg-muted">Gelernt (gemessen)</span><span className="tabular">{formatMinutes(p.studiedMinutes)}</span></div>
          <div className="flex justify-between"><span className="text-fg-muted">Noch geplant</span><span className="tabular">{formatMinutes(p.remainingPlannedMinutes)}</span></div>
          {p.remainingEstimateMinutes !== null && <div className="flex justify-between"><span className="text-fg-muted">Rest laut deiner Schätzung</span><span className="tabular">{formatMinutes(p.remainingEstimateMinutes)}</span></div>}
          <div className="flex justify-between"><span className="text-fg-muted">Quizze zu den Themen</span><span className="tabular">{p.quizzesCompleted}</span></div>
          <div className="flex justify-between"><span className="text-fg-muted">Probeklausuren</span><span className="tabular">{p.mockExams}</span></div>
          {p.finalSession && <div className="mt-1 flex items-center gap-1.5 text-fg-muted"><Flag className="size-3.5" />Abschluss-Wiederholung {relativeDay(p.finalSession.date, today)}{p.finalSession.done ? ' – erledigt' : ''}</div>}
        </Card>
        <Card className="flex flex-col gap-1.5 p-4 text-sm">
          <div className="font-semibold">Noch wiederholen</div>
          {p.topics.filter((t) => t.needsRevision).length === 0 ? <p className="text-fg-muted">{p.topics.length ? 'Alle Themen sitzen laut deinen Antworten.' : 'Noch keine Themen eingetragen.'}</p> : p.topics.filter((t) => t.needsRevision).sort((a, b) => a.mastery - b.mastery).map((t) => (
            <div key={t.id}>
              <div className="flex items-center justify-between gap-2"><span className="truncate">{t.name}</span><span className="shrink-0 text-xs text-fg-subtle">{t.answers ? LEVEL_LABELS[t.level] : 'nie geübt'}</span></div>
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <ProgressBar value={t.mastery} label={`Beherrschung ${t.name}`} className="flex-1" tone={t.level === 'struggling' ? 'warn' : 'accent'} />
                {t.confidence && <span title="dein Gefühl (1–5)">Gefühl {t.confidence}/5</span>}
                {t.openMistakes > 0 && <Badge tone="warn">{t.openMistakes} Fehler</Badge>}
              </div>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-1.5 p-4 text-sm">
          <div className="flex items-center justify-between font-semibold">Nächste Einheiten<Link to={`/kalender?ansicht=agenda`} className="text-xs font-normal text-accent hover:underline">Kalender</Link></div>
          {p.nextSessions.length === 0 ? <p className="text-fg-muted">Keine geplant. „Plan neu berechnen“ oder im Kalender „Lernplan automatisch erstellen“.</p> : p.nextSessions.map((s, i) => (
            <div key={i} className="flex items-center gap-2"><CalendarCheck2 className="size-3.5 shrink-0 text-fg-subtle" /><span className="w-28 shrink-0 whitespace-nowrap text-xs tabular text-fg-muted">{parseDay(s.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}{s.start ? ` ${s.start}` : ''}</span><span className="truncate">{s.title}</span></div>
          ))}
        </Card>
      </div>
      {p.weakTopics.length > 0 && <p className="flex items-center gap-2 text-sm text-fg-muted"><GraduationCap className="size-4 text-accent" />Schwächste Bereiche: {p.weakTopics.map((t) => t.name).join(', ')}.</p>}
    </section>
  )
}
