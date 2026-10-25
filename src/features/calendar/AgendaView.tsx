import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarRange, GraduationCap } from 'lucide-react'
import type { DayKey, Exam } from '@/db/types'
import { db } from '@/db/index'
import { Badge, Button, cn, EmptyState, ProgressBar } from '@/components/ui'
import { addDays, diffDays, formatDayShort, parseDay, relativeDay } from '@/lib/dates'
import { isOverdue, itemsOnDay, type CalItem } from '@/lib/calendar/items'
import { examPreparation, type ExamPrep } from '@/lib/calendar/prep'
import { subjectColorVar } from '@/lib/colors'
import { ItemRow } from './ItemCard'
import { isoWeek, type ViewProps } from './MonthView'

const dayLabel = (d: DayKey, today: DayKey) => {
  const rel = diffDays(today, d)
  const base = parseDay(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  return rel === 0 ? `Heute · ${base}` : rel === 1 ? `Morgen · ${base}` : base
}

export function AgendaView(p: ViewProps & { from: DayKey; to: DayKey; overdue: CalItem[]; onMore?: () => void; title?: string; emptyText?: string }) {
  const days = useMemo(() => {
    const set = new Set<DayKey>()
    for (const i of p.items) for (let d = i.date < p.from ? p.from : i.date; d <= i.endDate && d <= p.to; d = addDays(d, 1)) set.add(d)
    return [...set].sort()
  }, [p.items, p.from, p.to])
  return (
    <div className="flex flex-col gap-5 overflow-y-auto pb-6">
      {p.overdue.length > 0 && (
        <section aria-labelledby="ag-overdue" className="rounded-lg border border-warn/35 bg-warn-soft/40 p-2">
          <h3 id="ag-overdue" className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-warn"><AlertTriangle className="size-4" />Überfällig ({p.overdue.length})</h3>
          {p.overdue.map((i) => <ItemRow key={i.key} item={i} ctx={p.ctx} onClick={() => p.onSelect(i)} onToggle={(d) => p.onToggle(i, d)} selected={p.selectedKey === i.key} showDate={formatDayShort(i.date)} subjectName={p.subjectName(i.subjectId)} overdue />)}
        </section>
      )}
      {days.length === 0 ? (
        <EmptyState icon={CalendarRange} title={p.title ?? 'Keine Einträge in diesem Zeitraum'} description={p.emptyText ?? 'Lege Termine, Hausaufgaben oder Prüfungen an – oder lass den Planer Lernzeiten vorschlagen.'} />
      ) : (
        days.map((d) => {
          const list = itemsOnDay(p.items, d)
          const monday = parseDay(d).getDay() === 1
          return (
            <section key={d} aria-label={dayLabel(d, p.today)}>
              {monday && <div className="mb-1 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-subtle">KW {isoWeek(d)}</div>}
              <h3 className={cn('sticky top-0 z-[1] flex items-baseline justify-between bg-bg/95 px-3 py-1.5 text-sm font-semibold backdrop-blur', d === p.today && 'text-accent')}>
                <span>{dayLabel(d, p.today)}</span>
                <span className="text-xs font-normal text-fg-subtle">{list.length} {list.length === 1 ? 'Eintrag' : 'Einträge'}</span>
              </h3>
              <div className="flex flex-col">
                {list.map((i) => <ItemRow key={i.key} item={i} ctx={p.ctx} onClick={() => p.onSelect(i)} onToggle={(dn) => p.onToggle(i, dn)} selected={p.selectedKey === i.key} subjectName={p.subjectName(i.subjectId)} overdue={isOverdue(i, p.today)} />)}
              </div>
            </section>
          )
        })
      )}
      {p.onMore && <Button className="self-center" onClick={p.onMore}>Weitere 30 Tage anzeigen</Button>}
    </div>
  )
}

/** Long-term overview: exams with real preparation progress, major deadlines, load per week. */
export function SemesterView(p: ViewProps & { from: DayKey; weeks: number; exams: Exam[] }) {
  const data = useLiveQuery(async () => ({
    answers: await db.answers.toArray(), topics: await db.topics.toArray(), decks: await db.decks.toArray(), cards: await db.cards.toArray(),
    cardReviews: await db.cardReviews.toArray(), attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(), events: await db.events.toArray(),
  }), [])
  const to = addDays(p.from, p.weeks * 7 - 1)
  const exams = p.exams.filter((x) => x.date >= p.from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  const prep = useMemo(() => {
    const m = new Map<string, ExamPrep>()
    if (data) for (const x of exams) m.set(x.id, examPreparation({ exam: x, ...data, today: p.today }))
    return m
  }, [data, exams, p.today])
  const majors = p.items.filter((i) => (i.deadline && (i.kind === 'project' || i.priority === 'high')) || i.kind === 'internship').filter((i) => i.date >= p.from)
  const weekStarts = Array.from({ length: p.weeks }, (_, w) => addDays(p.from, w * 7))
  const load = weekStarts.map((ws) => {
    const we = addDays(ws, 6)
    const inWeek = p.items.filter((i) => i.date >= ws && i.date <= we)
    return { ws, exams: inWeek.filter((i) => i.kind === 'exam').length, deadlines: inWeek.filter((i) => i.deadline).length, study: inWeek.filter((i) => i.kind === 'study' || i.kind === 'flashcards').reduce((s, i) => s + i.minutes, 0) }
  })
  const maxLoad = Math.max(1, ...load.map((l) => l.exams * 3 + l.deadlines))
  const subjectColor = (id: string) => {
    const s = p.ctx.subjects.get(id)
    return s ? subjectColorVar(s.color) : 'var(--accent)'
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto pb-8">
      <section aria-labelledby="sem-load">
        <h3 id="sem-load" className="mb-2 text-sm font-semibold">Belastung pro Woche</h3>
        <div className="flex items-end gap-1 overflow-x-auto pb-1" role="list">
          {load.map((l) => {
            const h = ((l.exams * 3 + l.deadlines) / maxLoad) * 56
            return (
              <button key={l.ws} role="listitem" type="button" onClick={() => p.onOpenDay(l.ws)} className="group flex w-9 shrink-0 cursor-pointer flex-col items-center gap-1" title={`KW ${isoWeek(l.ws)}: ${l.exams} Prüfungen, ${l.deadlines} Fristen, ${l.study} Min. Lernen geplant`}>
                <span className="flex h-14 w-full items-end justify-center rounded bg-surface-2 group-hover:bg-surface-3">
                  <span className={cn('w-5 rounded-sm', l.exams ? 'bg-danger/80' : 'bg-accent/70')} style={{ height: Math.max(l.exams + l.deadlines ? 6 : 2, h) }} />
                </span>
                <span className={cn('text-[0.65rem] tabular', l.ws <= p.today && p.today <= addDays(l.ws, 6) ? 'font-semibold text-accent' : 'text-fg-subtle')}>{isoWeek(l.ws)}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-fg-subtle">Höhe = Prüfungen (×3) + Fristen. Rot = Woche mit Prüfung. Antippen öffnet die Woche.</p>
      </section>

      <section aria-labelledby="sem-exams">
        <h3 id="sem-exams" className="mb-2 flex items-center gap-2 text-sm font-semibold"><GraduationCap className="size-4 text-danger" />Prüfungen ({exams.length})</h3>
        {exams.length === 0 ? (
          <EmptyState compact icon={GraduationCap} title="Keine Prüfungen im Zeitraum" description="Trag Klassenarbeiten und Tests ein – Study OS erstellt dann einen Lernplan." action={<Button onClick={() => p.onCreate(addDays(p.today, 14))}>Prüfung eintragen</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {exams.map((x) => {
              const pr = prep.get(x.id)
              const s = p.ctx.subjects.get(x.subjectId)
              return (
                <article key={x.id} className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-4" style={{ borderTop: `3px solid ${subjectColor(x.subjectId)}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-fg-muted">{s?.name ?? 'Ohne Fach'} · {x.type}</div>
                      <Link to={`/pruefungen/${x.id}`} className="block truncate font-semibold hover:text-accent">{x.title}</Link>
                    </div>
                    <Badge tone={diffDays(p.today, x.date) <= 3 ? 'warn' : 'neutral'}>{relativeDay(x.date, p.today)}</Badge>
                  </div>
                  <div className="text-xs text-fg-muted">{parseDay(x.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}{x.startTime ? `, ${x.startTime} Uhr` : ''}{x.location ? ` · ${x.location}` : ''}</div>
                  {pr ? (
                    <>
                      <div>
                        <div className="mb-1 flex justify-between text-xs"><span className="text-fg-muted">Vorbereitung (aus deinen Antworten)</span><span className="tabular font-medium">{pr.readiness === null ? '–' : `${Math.round(pr.readiness * 100)} %`}</span></div>
                        <ProgressBar value={pr.readiness ?? 0} label="Vorbereitung" tone={pr.readiness !== null && pr.readiness >= 0.75 ? 'success' : 'accent'} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-surface-2 py-1.5"><div className="tabular text-sm font-semibold">{pr.planDone}/{pr.planTotal}</div><div className="text-fg-subtle">Einheiten</div></div>
                        <div className="rounded-md bg-surface-2 py-1.5"><div className="tabular text-sm font-semibold">{pr.topics.filter((t) => t.needsRevision).length}</div><div className="text-fg-subtle">Themen offen</div></div>
                        <div className="rounded-md bg-surface-2 py-1.5"><div className="tabular text-sm font-semibold">{pr.quizzesCompleted}</div><div className="text-fg-subtle">Quizze</div></div>
                      </div>
                      {pr.weakTopics.length > 0 && <div className="text-xs text-fg-muted">Schwach: {pr.weakTopics.map((t) => t.name).join(', ')}</div>}
                    </>
                  ) : (
                    <div className="h-16 animate-pulse rounded bg-surface-2" />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="sem-deadlines">
        <h3 id="sem-deadlines" className="mb-1 text-sm font-semibold">Große Fristen & Projekte</h3>
        {majors.length === 0 ? <p className="text-sm text-fg-muted">Keine Projekt-Abgaben, Praktika oder Aufgaben mit hoher Priorität.</p> : majors.map((i) => <ItemRow key={i.key} item={i} ctx={p.ctx} onClick={() => p.onSelect(i)} onToggle={(d) => p.onToggle(i, d)} showDate={formatDayShort(i.date)} subjectName={p.subjectName(i.subjectId)} overdue={isOverdue(i, p.today)} />)}
      </section>
    </div>
  )
}
