import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, Coffee, GraduationCap, Layers, ListTodo, Moon, Play, Plus, Sun, Wand2 } from 'lucide-react'
import { db } from '@/db/index'
import { setItemDone } from '@/db/calendar'
import { ValidationError } from '@/db/repo'
import { sessionHref } from '@/features/exams/plan'
import { Badge, Button, ButtonLink, Card, cn, Dialog, EmptyState, LoadingBlock, ProgressBar, Ring, SectionHeader, StatTile, useToast } from '@/components/ui'
import { useDueCards } from '@/hooks/data'
import { addDays, dayKey, diffDays, formatMinutes, parseDay, relativeDay, WEEKDAYS_LONG } from '@/lib/dates'
import { isOverdue, isStudyItem, itemsOnDay, type CalItem } from '@/lib/calendar/items'
import { buildSupply } from '@/lib/calendar/planner'
import { examPreparation } from '@/lib/calendar/prep'
import { fromMin, nowMinutes, toMin } from '@/lib/calendar/time'
import { undoLast } from '@/lib/undo'
import { useCalendarSources, useColorCtx, useItems, useNow } from './data'
import { canComplete, ItemRow } from './ItemCard'
import { DetailPanel } from './DetailPanel'
import { EntryEditor, type EditorTarget } from './EntryEditor'
import { PlannerDialog, type PlannerMode } from './PlannerDialog'

export default function MyDayPage() {
  const toast = useToast()
  const now = useNow()
  const today = dayKey(now)
  const tomorrow = addDays(today, 1)
  const src = useCalendarSources()
  const ctx = useColorCtx(src)
  const items = useItems(src, addDays(today, -14), addDays(today, 3))
  const due = useDueCards()
  const sessions = useLiveQuery(() => db.sessions.where('day').equals(today).toArray(), [today])
  const learnData = useLiveQuery(async () => ({
    answers: await db.answers.toArray(), topics: await db.topics.toArray(), decks: await db.decks.toArray(), cards: await db.cards.toArray(),
    cardReviews: await db.cardReviews.toArray(), attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(), events: await db.events.toArray(),
  }), [])
  const [selected, setSelected] = useState<CalItem | null>(null)
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [planner, setPlanner] = useState<PlannerMode | null>(null)
  const nowMin = nowMinutes(now)

  const day = useMemo(() => {
    const todays = itemsOnDay(items, today)
    const timed = todays.filter((i) => i.start && !i.allDay).sort((a, b) => a.start!.localeCompare(b.start!))
    const allDay = todays.filter((i) => !i.start || i.allDay)
    const current = timed.find((i) => toMin(i.start!) <= nowMin && toMin(i.end ?? i.start!) > nowMin && !i.cancelled)
    const nextEvent = timed.find((i) => toMin(i.start!) > nowMin && !i.cancelled)
    const nextLesson = timed.find((i) => i.kind === 'lesson' && toMin(i.start!) > nowMin)
    const overdue = items.filter((i) => i.date < today && isOverdue(i, today))
    const workable = todays.filter((i) => canComplete(i) && !i.cancelled)
    const doneN = workable.filter((i) => i.done).length
    const nextTodo =
      (current && canComplete(current) && !current.done ? current : undefined) ??
      timed.find((i) => canComplete(i) && !i.done && toMin(i.end ?? i.start!) > nowMin) ??
      allDay.find((i) => canComplete(i) && !i.done) ??
      overdue[0]
    const deadlines = items.filter((i) => i.deadline && !i.done && i.date >= today && i.date <= addDays(today, 3))
    const homework = items.filter((i) => i.deadline && !i.done && (i.date === today || i.date === tomorrow) && i.kind === 'homework')
    const studyPlanned = todays.filter(isStudyItem)
    return { todays, timed, allDay, current, nextEvent, nextLesson, overdue, workable, doneN, nextTodo, deadlines, homework, studyPlanned }
  }, [items, today, tomorrow, nowMin])

  const freeLeft = useMemo(() => {
    if (!src.ready) return 0
    const [s] = buildSupply({ days: [today], settings: src.settings, restDays: src.profile?.restDays ?? [], fixed: itemsOnDay(items, today), today, nowMin })
    return Math.min(s.capacity, s.free.reduce((m, [a, b]) => m + (b - a), 0))
  }, [src, items, today, nowMin])

  const nextExam = useMemo(() => src.exams.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0], [src.exams, today])
  const prep = useMemo(() => (nextExam && learnData ? examPreparation({ exam: nextExam, ...learnData, today }) : null), [nextExam, learnData, today])

  if (!src.ready || !sessions || !due) return <LoadingBlock />
  const measured = Math.round(sessions.reduce((s, x) => s + x.durationSec, 0) / 60)
  const undo = { label: 'Rückgängig', onClick: () => undoLast() }
  const toggle = (i: CalItem, d: boolean) => setItemDone(i, d).then(() => toast({ title: d ? 'Erledigt' : 'Wieder offen', tone: 'success', action: undo }), (e) => toast({ title: e instanceof ValidationError ? e.message : String(e), tone: 'danger' }))
  const subjectName = (id: string | null) => (id ? ctx.subjects.get(id)?.name : undefined)
  const startLink = (i: CalItem): string | null => {
    if (i.source === 'plan') {
      const x = src.exams.find((e) => e.id === i.refId)
      const s = x?.plan.find((p) => p.id === i.sessionId)
      return x && s ? sessionHref(s, x.id, x.subjectId) : null
    }
    if (i.kind === 'flashcards') return '/karteikarten/lernen'
    return null
  }
  const tomorrowItems = itemsOnDay(items, tomorrow)
  const tomorrowLessons = tomorrowItems.filter((i) => i.kind === 'lesson' && i.start).sort((a, b) => a.start!.localeCompare(b.start!))
  const evening = nowMin >= 18 * 60
  const wd = parseDay(today).getDay()

  // Timeline with free gaps inside the study window
  const restDay = (src.profile?.restDays ?? []).includes(wd) || day.allDay.some((i) => i.blocksStudy)
  const window = restDay ? null : src.settings.windows[wd]
  const timeline: ({ type: 'item'; item: CalItem } | { type: 'gap'; from: number; to: number })[] = []
  let cursor = window ? toMin(window.from) : 24 * 60
  for (const i of day.timed) {
    const s = toMin(i.start!)
    if (window && s - cursor >= 30 && s <= toMin(window.to) && cursor >= toMin(window.from)) timeline.push({ type: 'gap', from: cursor, to: Math.min(s, toMin(window.to)) })
    timeline.push({ type: 'item', item: i })
    cursor = Math.max(cursor, toMin(i.end ?? i.start!))
  }
  if (window && toMin(window.to) - cursor >= 30) timeline.push({ type: 'gap', from: Math.max(cursor, toMin(window.from)), to: toMin(window.to) })

  const N = day.nextTodo
  const nLink = N ? startLink(N) : null
  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">{WEEKDAYS_LONG[wd]}</div>
          <h1 className="text-2xl font-semibold">{parseDay(today).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            {day.current ? <>Gerade: <strong className="text-fg">{day.current.title}</strong> bis {day.current.end}</> : day.nextEvent ? <>Als Nächstes um {day.nextEvent.start}: <strong className="text-fg">{day.nextEvent.title}</strong></> : 'Für heute steht kein Termin mehr an.'}
            {day.nextLesson && day.nextLesson !== day.nextEvent && <> · Nächste Stunde {day.nextLesson.start} {day.nextLesson.title}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={Wand2} onClick={() => setPlanner('today')}>Plan für heute optimieren</Button>
          <Button icon={Plus} variant="primary" onClick={() => setEditor({ mode: 'create', date: today, start: fromMin(Math.ceil((nowMin + 15) / 15) * 15) })}>Eintrag</Button>
        </div>
      </header>

      {/* What next */}
      <Card className="flex flex-wrap items-center gap-4 p-5" style={N ? { borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))' } : undefined}>
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">{N ? <ArrowRight className="size-5" /> : <CheckCircle2 className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Das solltest du jetzt tun</div>
          {N ? (
            <>
              <div className="truncate text-lg font-semibold">{N.title}</div>
              <div className="text-sm text-fg-muted">
                {N.date < today ? `überfällig seit ${relativeDay(N.date, today).replace('vor ', '')}` : N.start && !N.allDay ? `${N.start}–${N.end}` : N.deadline ? `fällig ${relativeDay(N.date, today)}` : `${N.minutes} Min.`}
                {N.subjectId && ` · ${subjectName(N.subjectId)}`}
              </div>
            </>
          ) : (
            <div className="text-lg font-semibold">{day.workable.length ? 'Alles für heute erledigt.' : 'Heute ist nichts geplant.'}</div>
          )}
        </div>
        {N && (
          <div className="flex gap-2">
            {nLink && <ButtonLink to={nLink} variant="primary" icon={Play}>Jetzt starten</ButtonLink>}
            <Button icon={CheckCircle2} variant={nLink ? 'secondary' : 'primary'} onClick={() => toggle(N, true)}>Erledigt</Button>
            <Button variant="ghost" onClick={() => setSelected(N)}>Details</Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={CheckCircle2} label="Erledigt heute" value={`${day.doneN} / ${day.workable.length}`} sub={day.workable.length ? `${day.workable.length - day.doneN} offen` : 'nichts zum Abhaken'} />
        <StatTile icon={Clock} label="Freie Lernzeit übrig" value={formatMinutes(freeLeft)} sub={restDay ? 'heute ist ein Ruhetag' : window ? `Lernfenster ${window.from}–${window.to}` : 'heute kein Lernfenster'} />
        <StatTile icon={Layers} label="Karteikarten fällig" value={due.reviewCount + due.newCount} sub={`${due.reviewCount} Wiederholungen, ${due.newCount} neu`} />
        <StatTile icon={Sun} label="Heute gelernt (gemessen)" value={formatMinutes(measured)} sub={`${day.studyPlanned.reduce((s, i) => s + i.minutes, 0)} Min. geplant`} />
      </div>

      <div className="grid gap-7 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="md-timeline">
          <SectionHeader id="md-timeline" title="Tagesablauf" action={<ButtonLink to={`/kalender?ansicht=day&datum=${today}`} size="sm" variant="ghost" icon={CalendarDays}>Im Kalender</ButtonLink>} />
          {day.allDay.length > 0 && (
            <div className="mb-2 flex flex-col">
              {day.allDay.map((i) => <ItemRow key={i.key} item={i} ctx={ctx} onClick={() => setSelected(i)} onToggle={(d) => toggle(i, d)} subjectName={subjectName(i.subjectId)} />)}
            </div>
          )}
          {timeline.length === 0 ? (
            <EmptyState compact icon={Coffee} title="Keine Termine heute" description="Lege Unterricht, Termine oder Lernblöcke an – oder lass den Planer Zeiten vorschlagen." />
          ) : (
            <ol className="relative flex flex-col">
              {timeline.map((t, idx) => t.type === 'gap' ? (
                <li key={`gap${idx}`} className="flex items-center gap-3 px-3 py-1.5 text-xs text-fg-subtle">
                  <span className="w-14 text-right tabular">{fromMin(t.from)}</span>
                  <span className="h-px flex-1 border-t border-dashed border-border-strong" />
                  <span>{formatMinutes(t.to - t.from)} frei</span>
                  {t.from >= nowMin && <button type="button" onClick={() => setEditor({ mode: 'create', kind: 'study', date: today, start: fromMin(t.from), end: fromMin(Math.min(t.to, t.from + 45)) })} className="cursor-pointer font-medium text-accent hover:underline">Lernblock</button>}
                </li>
              ) : (
                <li key={t.item.key} className={cn('relative', toMin(t.item.end ?? t.item.start!) <= nowMin && 'opacity-60')}>
                  {day.current?.key === t.item.key && <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-danger" aria-label="läuft gerade" />}
                  <ItemRow item={t.item} ctx={ctx} onClick={() => setSelected(t.item)} onToggle={(d) => toggle(t.item, d)} subjectName={subjectName(t.item.subjectId)} right={startLink(t.item) && !t.item.done ? <ButtonLink to={startLink(t.item)!} size="sm" icon={Play}>Start</ButtonLink> : undefined} />
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {day.overdue.length > 0 && (
            <section aria-labelledby="md-overdue" className="rounded-lg border border-warn/35 bg-warn-soft/40 p-3">
              <h2 id="md-overdue" className="mb-1 flex items-center gap-2 text-sm font-semibold text-warn"><AlertTriangle className="size-4" />Braucht Aufmerksamkeit ({day.overdue.length})</h2>
              {day.overdue.slice(0, 5).map((i) => <ItemRow key={i.key} item={i} ctx={ctx} onClick={() => setSelected(i)} onToggle={(d) => toggle(i, d)} showDate={parseDay(i.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} overdue subjectName={subjectName(i.subjectId)} />)}
              <Button size="sm" className="mt-2" icon={Wand2} onClick={() => setPlanner('today')}>Verpasstes neu einplanen</Button>
            </section>
          )}
          <section aria-labelledby="md-deadlines">
            <SectionHeader id="md-deadlines" title="Fristen (3 Tage)" action={<ButtonLink to="/aufgaben" size="sm" variant="ghost" icon={ListTodo}>Aufgaben</ButtonLink>} />
            {day.deadlines.length === 0 ? <p className="text-sm text-fg-muted">Keine offenen Fristen bis {parseDay(addDays(today, 3)).toLocaleDateString('de-DE', { weekday: 'long' })}.</p> : day.deadlines.map((i) => <ItemRow key={i.key} item={i} ctx={ctx} onClick={() => setSelected(i)} onToggle={(d) => toggle(i, d)} showDate={relativeDay(i.date, today)} subjectName={subjectName(i.subjectId)} />)}
            {day.homework.length > 0 && <p className="mt-1 text-xs text-fg-subtle">{day.homework.length} Hausaufgabe{day.homework.length === 1 ? '' : 'n'} für heute/morgen offen.</p>}
          </section>
          {nextExam && prep && (
            <section aria-labelledby="md-exam">
              <SectionHeader id="md-exam" title="Prüfungsvorbereitung" />
              <Link to={`/pruefungen/${nextExam.id}`} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
                <Ring value={prep.readiness ?? 0} size={56} stroke={5} label={`Vorbereitung ${nextExam.title}`}><span className="text-xs font-semibold tabular">{prep.readiness === null ? '–' : `${Math.round(prep.readiness * 100)}%`}</span></Ring>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><GraduationCap className="size-4 text-danger" /><span className="truncate font-semibold">{nextExam.title}</span></div>
                  <div className="text-sm text-fg-muted">{relativeDay(nextExam.date, today)} · {prep.planDone}/{prep.planTotal} Einheiten · {prep.weakTopics.length ? `schwach: ${prep.weakTopics.map((t) => t.name).join(', ')}` : 'keine Schwachstellen erkannt'}</div>
                  {prep.cardsDueBeforeExam > 0 && <div className="text-xs text-fg-subtle">{prep.cardsDueBeforeExam} Karten bis zur Prüfung fällig</div>}
                </div>
              </Link>
            </section>
          )}
          <section aria-labelledby="md-tomorrow">
            <SectionHeader id="md-tomorrow" title={`Morgen, ${parseDay(tomorrow).toLocaleDateString('de-DE', { weekday: 'long' })}`} />
            <Card className="flex flex-col gap-1.5 p-4 text-sm">
              <div className="flex justify-between"><span className="text-fg-muted">Unterricht</span><span className="tabular">{tomorrowLessons.length ? `${tomorrowLessons[0].start}–${tomorrowLessons.at(-1)!.end} · ${tomorrowLessons.length} Stunden` : 'keiner'}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Fristen</span><span className="tabular">{tomorrowItems.filter((i) => i.deadline && !i.done).length}</span></div>
              <div className="flex justify-between"><span className="text-fg-muted">Lernen geplant</span><span className="tabular">{tomorrowItems.filter(isStudyItem).reduce((s, i) => s + i.minutes, 0)} Min.</span></div>
              {tomorrowItems.filter((i) => i.kind === 'exam').map((i) => <Badge key={i.key} tone="warn">Prüfung: {i.title}</Badge>)}
              <ButtonLink to={`/kalender?ansicht=day&datum=${tomorrow}`} size="sm" variant="ghost" className="self-start">Morgen ansehen</ButtonLink>
            </Card>
          </section>
          <section aria-labelledby="md-review">
            <SectionHeader id="md-review" title="Tagesrückblick" />
            <Card className="flex flex-col gap-2 p-4 text-sm">
              <div className="flex items-center gap-2 text-fg-muted">{evening ? <Moon className="size-4" /> : <Sun className="size-4" />}{evening ? 'Wie lief dein Tag?' : 'Am Abend zeigt der Rückblick, was geschafft ist.'}</div>
              <ProgressBar value={day.workable.length ? day.doneN / day.workable.length : 0} label="Erledigt" showValue />
              <ul className="text-fg-muted">
                <li>{day.doneN} von {day.workable.length} Einträgen erledigt</li>
                <li>{formatMinutes(measured)} gemessene Lernzeit (Quiz, Karten, Mathe, Tutor)</li>
                {day.workable.length - day.doneN > 0 && <li>{day.workable.length - day.doneN} offen – verschiebe sie, statt sie liegen zu lassen.</li>}
              </ul>
              {day.workable.length - day.doneN > 0 && <Button size="sm" className="self-start" icon={Wand2} onClick={() => setPlanner('today')}>Offenes neu verteilen</Button>}
              {nextExam && diffDays(today, nextExam.date) === 1 && <p className="text-xs text-fg-subtle">Morgen ist „{nextExam.title}“. Leicht wiederholen, Tasche packen, früh schlafen.</p>}
            </Card>
          </section>
        </div>
      </div>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title="Details">
        {selected && <DetailPanel item={items.find((i) => i.key === selected.key) ?? selected} ctx={ctx} today={today} onEdit={() => { const it = selected; setSelected(null); setEditor({ mode: 'edit', item: it }) }} onDeleted={() => setSelected(null)} />}
      </Dialog>
      <EntryEditor target={editor} onClose={() => setEditor(null)} onSaved={(m) => toast({ title: m, tone: 'success', action: undo })} />
      <PlannerDialog mode={planner} onClose={() => setPlanner(null)} subjects={src.subjects} />
    </div>
  )
}
