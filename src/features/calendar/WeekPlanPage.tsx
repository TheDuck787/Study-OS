import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb, ListTodo, RefreshCcw, Wand2 } from 'lucide-react'
import { db } from '@/db/index'
import { moveItem } from '@/db/calendar'
import { ValidationError } from '@/db/repo'
import { Badge, Button, ButtonLink, Card, cn, EmptyState, IconButton, LoadingBlock, PageHeader, ProgressBar, SectionHeader, Select, StatTile, useToast } from '@/components/ui'
import { useDueCards } from '@/hooks/data'
import { addDays, dayKey, formatMinutes, parseDay, relativeDay, startOfWeek, WEEKDAYS_SHORT } from '@/lib/dates'
import { computeAllTopicStats } from '@/lib/mastery'
import { isStudyItem, itemsOnDay, type CalItem } from '@/lib/calendar/items'
import { examPreparation } from '@/lib/calendar/prep'
import { summarizeWeek } from '@/lib/calendar/review'
import { undoLast } from '@/lib/undo'
import { useCalendarSources, useColorCtx, useItems } from './data'
import { ItemRow } from './ItemCard'
import { isoWeek } from './MonthView'
import { PlannerDialog, type PlannerMode } from './PlannerDialog'

export default function WeekPlanPage() {
  const toast = useToast()
  const today = dayKey()
  const [weekStart, setWeekStart] = useState(startOfWeek(today))
  const weekEnd = addDays(weekStart, 6)
  const src = useCalendarSources()
  const ctx = useColorCtx(src)
  const items = useItems(src, weekStart, addDays(weekStart, 13))
  const due = useDueCards()
  const [planner, setPlanner] = useState<PlannerMode | null>(null)
  const learn = useLiveQuery(async () => ({
    answers: await db.answers.toArray(), topics: await db.topics.toArray(), decks: await db.decks.toArray(), cards: await db.cards.toArray(),
    cardReviews: await db.cardReviews.toArray(), attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(), events: await db.events.toArray(),
  }), [])

  const week = useMemo(() => items.filter((i) => i.date <= weekEnd), [items, weekEnd])
  const examsSoon = useMemo(() => src.exams.filter((x) => x.date >= weekStart && x.date <= addDays(weekStart, 13)).sort((a, b) => a.date.localeCompare(b.date)), [src.exams, weekStart])
  const readiness = useMemo(() => (learn ? examsSoon.map((x) => ({ id: x.id, title: x.title, date: x.date, readiness: examPreparation({ exam: x, ...learn, today }).readiness })) : []), [learn, examsSoon, today])
  const weak = useMemo(() => {
    if (!learn) return []
    const stats = computeAllTopicStats(learn.topics.map((t) => t.id), learn.answers)
    return learn.topics.filter((t) => {
      const s = stats.get(t.id)
      return s && s.answers > 0 && (s.level === 'struggling' || (s.level === 'practicing' && s.recentWrong > 0))
    }).map((t) => t.name)
  }, [learn])
  const summary = useMemo(() => (src.ready && learn ? summarizeWeek({ weekStart, items: week, sessions: learn.sessions, tasks: src.tasks, settings: src.settings, restDays: src.profile?.restDays ?? [], today, examReadiness: readiness, cardsDue: (due?.reviewCount ?? 0) + (due?.newCount ?? 0), weakTopics: weak }) : null), [src, learn, week, weekStart, today, readiness, due, weak])

  if (!src.ready || !summary) return <LoadingBlock />
  const undo = { label: 'Rückgängig', onClick: () => undoLast() }
  const move = (i: CalItem, d: string) => moveItem(i, d).then(() => toast({ title: 'Verschoben', description: `${i.title} → ${parseDay(d).toLocaleDateString('de-DE', { weekday: 'long' })}`, action: undo }), (e) => toast({ title: e instanceof ValidationError ? e.message : String(e), tone: 'danger' }))
  const movable = week.filter((i) => (isStudyItem(i) || i.deadline) && !i.done && !i.recurring && i.date >= today)
  const days = summary.days
  const maxDay = Math.max(src.settings.maxDailyMinutes, ...days.map((d) => d.plannedStudy))
  const subjectName = (id: string | null) => (id ? ctx.subjects.get(id)?.name : undefined)

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Wochenplanung"
        eyebrow={`KW ${isoWeek(weekStart)} · ${parseDay(weekStart).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${parseDay(weekEnd).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`}
        description="Rückblick und Plan in einem: Was ist geschafft, wo wird es eng, was solltest du verschieben? Alle Zahlen kommen aus deinen echten Einträgen."
        actions={
          <>
            <IconButton label="Vorherige Woche" icon={ChevronLeft} onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <Button size="sm" onClick={() => setWeekStart(startOfWeek(today))}>Diese Woche</Button>
            <IconButton label="Nächste Woche" icon={ChevronRight} onClick={() => setWeekStart(addDays(weekStart, 7))} />
            <Button icon={RefreshCcw} onClick={() => setPlanner('recalc')}>Plan neu berechnen</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Lernzeit geplant" value={formatMinutes(summary.plannedStudy)} sub="Lerneinheiten & Karteikarten-Blöcke" />
        <StatTile label="Davon erledigt" value={formatMinutes(summary.doneStudy)} sub={summary.completionRate === null ? 'noch keine vergangenen Tage' : `${Math.round(summary.completionRate * 100)} % der bisher geplanten Zeit`} />
        <StatTile label="Gemessen gelernt" value={formatMinutes(summary.measured)} sub="Quiz, Karten, Mathe, Tutor" />
        <StatTile label="Offene Aufgaben" value={summary.openTasks.length} sub={`fällig bis ${parseDay(weekEnd).toLocaleDateString('de-DE', { weekday: 'long' })}`} />
      </div>

      <section aria-labelledby="wp-days">
        <SectionHeader id="wp-days" title="Belastung pro Tag" description={`Balken = geplante Lernzeit (Linie = dein Tagesmaximum ${src.settings.maxDailyMinutes} Min.)`} />
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => (
            <ButtonLink key={d.date} to={`/kalender?ansicht=day&datum=${d.date}`} variant="ghost" className={cn('flex h-auto flex-col items-stretch justify-start gap-1.5 rounded-lg border px-1.5 py-2', d.overloaded ? 'border-warn/50 bg-warn-soft/30' : 'border-border', d.date === today && 'ring-1 ring-accent')}>
              <span className="text-center text-xs text-fg-subtle">{WEEKDAYS_SHORT[parseDay(d.date).getDay()]} {parseDay(d.date).getDate()}.</span>
              <span className="relative mx-auto flex h-20 w-6 items-end rounded bg-surface-2" title={`${d.plannedStudy} Min. geplant, ${d.doneStudy} erledigt`}>
                <span className="absolute inset-x-0 border-t border-dashed border-fg-subtle" style={{ bottom: `${(src.settings.maxDailyMinutes / maxDay) * 100}%` }} />
                <span className="flex w-full flex-col justify-end overflow-hidden rounded bg-accent/40" style={{ height: `${(d.plannedStudy / maxDay) * 100}%` }}>
                  <span className="block w-full bg-success" style={{ height: `${d.plannedStudy ? (d.doneStudy / d.plannedStudy) * 100 : 0}%` }} />
                </span>
              </span>
              <span className="text-center text-[0.7rem] tabular text-fg-muted">{d.plannedStudy} Min.</span>
              <span className="text-center text-[0.65rem] text-fg-subtle">{d.freeMinutes} frei</span>
              {(d.exams > 0 || d.deadlines > 0) && <span className="text-center text-[0.65rem] font-medium text-warn">{d.exams ? `${d.exams} Prüf.` : ''}{d.exams && d.deadlines ? ' · ' : ''}{d.deadlines ? `${d.deadlines} Frist${d.deadlines > 1 ? 'en' : ''}` : ''}</span>}
              {d.overloaded && <AlertTriangle className="mx-auto size-3.5 text-warn" aria-label="überlastet" />}
            </ButtonLink>
          ))}
        </div>
      </section>

      <div className="grid gap-7 lg:grid-cols-2">
        <section aria-labelledby="wp-rec">
          <SectionHeader id="wp-rec" title="Empfehlungen für deine Woche" />
          <Card className="flex flex-col gap-2.5 p-4">
            {summary.recommendations.map((r, i) => <p key={i} className="flex gap-2 text-sm"><Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />{r}</p>)}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" icon={Wand2} onClick={() => setPlanner('recalc')}>Plan neu berechnen</Button>
              <Button size="sm" onClick={() => setPlanner('create')}>Lernzeiten anpassen</Button>
            </div>
          </Card>
        </section>
        <section aria-labelledby="wp-exams">
          <SectionHeader id="wp-exams" title="Prüfungen (2 Wochen)" />
          {examsSoon.length === 0 ? <p className="text-sm text-fg-muted">Keine Prüfungen in den nächsten zwei Wochen.</p> : (
            <div className="flex flex-col gap-2">
              {readiness.map((r) => (
                <ButtonLink key={r.id} to={`/pruefungen/${r.id}`} variant="ghost" className="flex h-auto flex-col items-stretch gap-1.5 rounded-lg border border-border px-3 py-2.5 text-left">
                  <span className="flex items-center justify-between gap-2"><span className="truncate font-medium">{r.title}</span><Badge tone={r.date <= addDays(today, 3) ? 'warn' : 'neutral'}>{relativeDay(r.date, today)}</Badge></span>
                  <ProgressBar value={r.readiness ?? 0} label={`Vorbereitung ${r.title}`} showValue />
                </ButtonLink>
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="wp-tasks">
          <SectionHeader id="wp-tasks" title="Unerledigte Hausaufgaben & Fristen" action={<ButtonLink size="sm" variant="ghost" to="/aufgaben" icon={ListTodo}>Alle</ButtonLink>} />
          {summary.openTasks.length === 0 ? <EmptyState compact title="Nichts offen" description="Alle Aufgaben dieser Woche sind erledigt." /> : summary.openTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-b-0">
              <span className="min-w-0 truncate">{t.title}</span>
              <span className={cn('shrink-0 text-xs', t.dueDate! < today ? 'font-medium text-warn' : 'text-fg-muted')}>fällig {relativeDay(t.dueDate!, today)}</span>
            </div>
          ))}
        </section>
        <section aria-labelledby="wp-weak">
          <SectionHeader id="wp-weak" title="Themen zum Weiterüben" />
          {weak.length === 0 ? <p className="text-sm text-fg-muted">Keine auffälligen Schwachstellen in deinen Antworten.</p> : <div className="flex flex-wrap gap-1.5">{weak.slice(0, 12).map((w) => <Badge key={w} tone="warn">{w}</Badge>)}</div>}
        </section>
      </div>

      <section aria-labelledby="wp-move">
        <SectionHeader id="wp-move" title="Einheiten und Aufgaben verschieben" description="Wähle einen anderen Tag – Titel, Notizen, Themen und Verknüpfungen bleiben erhalten." />
        {movable.length === 0 ? <p className="text-sm text-fg-muted">Keine offenen Lerneinheiten oder Fristen ab heute in dieser Woche.</p> : (
          <div className="flex flex-col gap-4">
            {days.filter((d) => d.date >= today).map((d) => {
              const list = itemsOnDay(movable, d.date)
              if (!list.length) return null
              return (
                <div key={d.date}>
                  <h3 className="mb-1 text-sm font-semibold">{parseDay(d.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}{d.overloaded && <span className="ml-2 text-xs font-normal text-warn">voll</span>}</h3>
                  {list.map((i) => (
                    <ItemRow key={i.key} item={i} ctx={ctx} onClick={() => undefined} subjectName={subjectName(i.subjectId)}
                      right={
                        <div className="w-36 shrink-0"><Select aria-label={`„${i.title}“ verschieben auf`} value={i.date} onChange={(e) => move(i, e.target.value)} className="h-8 text-sm" onClick={(e) => e.stopPropagation()}>
                          {Array.from({ length: 14 }, (_, k) => addDays(weekStart, k)).filter((x) => x >= today && (i.source !== 'plan' || !src.exams.find((ex) => ex.id === i.refId) || x < src.exams.find((ex) => ex.id === i.refId)!.date)).map((x) => (
                            <option key={x} value={x}>{parseDay(x).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}{summary.days.find((s) => s.date === x)?.overloaded ? ' (voll)' : ''}</option>
                          ))}
                        </Select></div>
                      } />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>
      <PlannerDialog mode={planner} onClose={() => setPlanner(null)} subjects={src.subjects} />
    </div>
  )
}
