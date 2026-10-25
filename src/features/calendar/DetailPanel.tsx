import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRightLeft, Bell, BookOpen, CalendarClock, CalendarPlus, Check, Copy, ExternalLink, FileText, GraduationCap, Layers, ListTodo, MapPin, Pencil, Play, Repeat, Trash2, User, X,
} from 'lucide-react'
import { db } from '@/db/index'
import type { DayKey } from '@/db/types'
import { deleteEvent, deletePlanSession, deleteTask, duplicateItem, moveItem, scheduleTask, setItemDone, toggleChecklist, toggleSubtask } from '@/db/calendar'
import { deleteExam, ValidationError } from '@/db/repo'
import { sessionHref } from '@/features/exams/plan'
import { Badge, Button, ButtonLink, cn, IconButton, Input, Notice, ProgressBar, useConfirm, useToast } from '@/components/ui'
import { formatMinutes, parseDay, relativeDay } from '@/lib/dates'
import type { CalItem } from '@/lib/calendar/items'
import { KIND_META, PRIORITY_META, REMINDER_OPTIONS } from '@/lib/calendar/meta'
import { describeRecurrence } from '@/lib/calendar/recurrence'
import { formatTimeRange, isTime } from '@/lib/calendar/time'
import { itemColor, kindLabel, type ColorCtx } from './data'
import { canComplete } from './ItemCard'
import { useScopeAsk } from './ScopeDialog'

export function DetailPanel({ item, ctx, today, onClose, onEdit, onDeleted }: { item: CalItem; ctx: ColorCtx; today: DayKey; onClose?: () => void; onEdit: () => void; onDeleted: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [scopeEl, askScope] = useScopeAsk()
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDate, setMoveDate] = useState(item.date)
  const [moveTime, setMoveTime] = useState(item.start ?? '')
  const [planOpen, setPlanOpen] = useState(false)
  const [plan, setPlan] = useState({ date: today, start: '16:00', minutes: 30 })
  useEffect(() => {
    setMoveOpen(false)
    setPlanOpen(false)
    setMoveDate(item.date)
    setMoveTime(item.start ?? '')
  }, [item.key, item.date, item.start])

  const full = useLiveQuery(async () => {
    const ev = item.source === 'event' ? await db.events.get(item.refId) : undefined
    const task = item.source === 'task' ? await db.tasks.get(item.refId) : item.taskId ? await db.tasks.get(item.taskId) : undefined
    const exam = item.examId ? await db.exams.get(item.examId) : undefined
    const topics = item.topicIds.length ? (await db.topics.bulkGet(item.topicIds)).filter((t) => !!t) : []
    const matIds = ev?.materialIds ?? (task?.materialId ? [task.materialId] : exam && item.source === 'exam' ? exam.materialIds : [])
    const materials = matIds.length ? (await db.materials.bulkGet(matIds)).filter((m) => !!m) : []
    const deck = ev?.deckId ? await db.decks.get(ev.deckId) : undefined
    const sessions = item.source === 'task' ? await db.events.where('taskId').equals(item.refId).toArray() : []
    return { ev, task, exam, topics, materials, deck, sessions }
  }, [item.key, item.refId, item.taskId, item.examId, item.topicIds.join()])

  const color = itemColor(item, ctx)
  const M = KIND_META[item.kind]
  const subject = item.subjectId ? ctx.subjects.get(item.subjectId) : undefined
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn()
      if (ok) toast({ title: ok, tone: 'success' })
    } catch (e) {
      toast({ title: e instanceof ValidationError ? e.message : 'Das hat nicht geklappt', tone: 'danger' })
    }
  }

  const remove = async () => {
    if (item.source === 'event' && item.recurring && full?.ev?.recurrence) {
      const scope = await askScope('Wiederkehrenden Eintrag löschen')
      if (scope) await run(() => deleteEvent(item.refId, { scope, occurrence: item.date }), 'Gelöscht')
      if (scope) onDeleted()
      return
    }
    const what = item.source === 'exam' ? 'Die Prüfung und ihr Lernplan werden gelöscht. Quiz-Ergebnisse bleiben erhalten.' : item.source === 'task' ? `Die Aufgabe${full?.sessions.length ? ` und ${full.sessions.length} eingeplante Arbeitszeit(en)` : ''} werden gelöscht.` : 'Der Eintrag wird gelöscht.'
    if (!(await confirm({ title: `„${item.title}“ löschen?`, message: `${what} Du kannst es direkt danach rückgängig machen.` }))) return
    if (item.source === 'event') await run(() => deleteEvent(item.refId), 'Gelöscht')
    else if (item.source === 'task') await run(() => deleteTask(item.refId), 'Aufgabe gelöscht')
    else if (item.source === 'plan') await run(() => deletePlanSession(item.refId, item.sessionId!), 'Lerneinheit gelöscht')
    else await run(() => deleteExam(item.refId), 'Prüfung gelöscht')
    onDeleted()
  }

  const canDone = canComplete(item) || (item.source === 'event' && !['lesson', 'break'].includes(item.kind))
  const sessionLink = item.source === 'plan' && full?.exam ? (() => {
    const s = full.exam.plan.find((p) => p.id === item.sessionId)
    return s ? sessionHref(s, full.exam.id, full.exam.subjectId) : null
  })() : null
  const reminder = full?.ev?.reminderMinutes ?? full?.task?.reminderMinutes
  const checklist = item.source === 'event' ? full?.ev?.checklist : item.source === 'task' ? full?.task?.subtasks : undefined

  return (
    <div className="flex flex-col gap-4" style={{ ['--c' as string]: color }}>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in oklab, var(--c) 22%, transparent)', color: 'var(--c)' }}><M.icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-fg-muted">{kindLabel(item, ctx)}{subject ? ` · ${subject.name}` : ''}</div>
          <h2 className={cn('text-lg font-semibold leading-snug', item.done && 'text-fg-muted line-through')}>{item.title}</h2>
        </div>
        {onClose && <IconButton label="Details schließen" icon={X} size="sm" onClick={onClose} />}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {item.done && <Badge tone="success">erledigt</Badge>}
        {item.cancelled && <Badge>abgesagt</Badge>}
        {item.priority === 'high' && item.kind !== 'lesson' && <Badge tone="warn">Priorität {PRIORITY_META.high.short}</Badge>}
        {item.planner && !item.pinned && <Badge tone="accent">vom Planer</Badge>}
        {item.pinned && <Badge>von dir festgelegt</Badge>}
      </div>

      <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-2 text-sm">
        <CalendarClock className="mt-0.5 size-4 text-fg-subtle" aria-hidden />
        <dd>
          {parseDay(item.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          {item.endDate !== item.date && ` – ${parseDay(item.endDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`}
          <span className="text-fg-muted"> · {item.deadline ? (item.start ? `fällig ${item.start} Uhr` : 'fällig') : item.untimed ? `${item.minutes} Min., noch ohne Uhrzeit` : formatTimeRange(item.start, item.end)}</span>
          <div className="text-xs text-fg-subtle">{relativeDay(item.date, today)}</div>
        </dd>
        {full?.ev?.recurrence && (<><Repeat className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>{describeRecurrence(full.ev.recurrence, full.ev.date)}</dd></>)}
        {item.location && (<><MapPin className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>{item.location}</dd></>)}
        {item.teacher && (<><User className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>{item.teacher}</dd></>)}
        {item.minutes > 0 && (item.deadline || item.allDay) && !item.untimed && (<><ListTodo className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>Aufwand etwa {formatMinutes(item.minutes)}</dd></>)}
        {reminder !== undefined && reminder !== null && (<><Bell className="mt-0.5 size-4 text-fg-subtle" aria-hidden /><dd>Erinnerung: {REMINDER_OPTIONS.find((o) => o.value === reminder)?.label ?? `${reminder} Min. vorher`}</dd></>)}
      </dl>

      {item.description && <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-muted">{item.description}</p>}

      {checklist && checklist.length > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-fg-muted"><span>{item.source === 'task' ? 'Teilaufgaben' : 'Checkliste'}</span><span className="tabular">{checklist.filter((c) => c.done).length}/{checklist.length}</span></div>
          <ProgressBar value={checklist.filter((c) => c.done).length / checklist.length} label="Fortschritt der Checkliste" className="mb-2" />
          <ul className="flex flex-col gap-0.5">
            {checklist.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => (item.source === 'task' ? toggleSubtask(item.refId, c.id) : toggleChecklist(item.refId, c.id))} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-surface-2">
                  <span className={cn('flex size-4 items-center justify-center rounded border', c.done ? 'border-transparent bg-[var(--c)] text-[var(--bg)]' : 'border-border-strong')}>{c.done && <Check className="size-3" strokeWidth={3} />}</span>
                  <span className={cn(c.done && 'text-fg-muted line-through')}>{c.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Links to related content */}
      <div className="flex flex-col gap-1 text-sm">
        {subject && <Link className="inline-flex items-center gap-2 text-accent hover:underline" to={`/faecher/${subject.id}`}><BookOpen className="size-4" />Fach {subject.name} öffnen</Link>}
        {full?.topics.map((t) => <Link key={t!.id} className="inline-flex items-center gap-2 text-accent hover:underline" to={`/faecher/${t!.subjectId}/themen/${t!.id}`}><ExternalLink className="size-4" />Thema: {t!.name}</Link>)}
        {full?.materials.map((m) => <Link key={m!.id} className="inline-flex items-center gap-2 text-accent hover:underline" to={`/bibliothek/material/${m!.id}`}><FileText className="size-4" />Material: {m!.title}</Link>)}
        {full?.exam && item.source !== 'exam' && <Link className="inline-flex items-center gap-2 text-accent hover:underline" to={`/pruefungen/${full.exam.id}`}><GraduationCap className="size-4" />Prüfung: {full.exam.title}</Link>}
        {full?.task && item.source !== 'task' && <Link className="inline-flex items-center gap-2 text-accent hover:underline" to={`/aufgaben?aufgabe=${full.task.id}`}><ListTodo className="size-4" />Gehört zur Aufgabe: {full.task.title}{full.task.status === 'done' ? ' (erledigt)' : ''}</Link>}
        {item.kind === 'flashcards' && <Link className="inline-flex items-center gap-2 text-accent hover:underline" to={full?.deck ? `/karteikarten/${full.deck.id}/lernen` : '/karteikarten/lernen'}><Layers className="size-4" />{full?.deck ? `Stapel „${full.deck.name}“ lernen` : 'Fällige Karten lernen'}</Link>}
      </div>

      {item.source === 'task' && full?.sessions && (
        <div className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 font-medium">Eingeplante Arbeitszeit</div>
          {full.sessions.length === 0 ? <p className="text-fg-muted">Noch keine. Plane Zeit ein oder lass den Planer verteilen.</p> : (
            <ul className="flex flex-col gap-0.5 text-fg-muted">
              {full.sessions.sort((a, b) => a.date.localeCompare(b.date)).map((s) => <li key={s.id} className={cn(s.status === 'done' && 'line-through')}>{parseDay(s.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} {formatTimeRange(s.start, s.end)}{s.source === 'planner' && !s.pinned ? ' · Planer' : ''}</li>)}
            </ul>
          )}
          {planOpen ? (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Input type="date" aria-label="Tag" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} className="w-40" />
              <Input type="time" aria-label="Beginn" value={plan.start} onChange={(e) => setPlan({ ...plan, start: e.target.value })} className="w-28" />
              <Input type="number" aria-label="Minuten" min={5} max={240} step={5} value={plan.minutes} onChange={(e) => setPlan({ ...plan, minutes: Number(e.target.value) })} className="w-24" />
              <Button size="sm" variant="primary" onClick={() => run(async () => { await scheduleTask(item.refId, plan.date, plan.start, plan.minutes); setPlanOpen(false) }, 'Arbeitszeit eingeplant')}>Einplanen</Button>
            </div>
          ) : (
            <Button size="sm" className="mt-2" icon={CalendarPlus} onClick={() => setPlanOpen(true)} disabled={item.done}>Arbeitszeit einplanen</Button>
          )}
        </div>
      )}

      {moveOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">Neuer Tag<Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className="w-40" /></label>
          {!item.allDay || item.deadline ? (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">{item.deadline ? 'Uhrzeit (optional)' : 'Beginn'}<Input type="time" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} className="w-28" /></label>
          ) : null}
          <Button size="sm" variant="primary" onClick={() => run(async () => { await moveItem(item, moveDate, moveTime && isTime(moveTime) ? moveTime : item.deadline ? null : undefined); setMoveOpen(false) }, 'Verschoben')}>Hierhin verschieben</Button>
          <Button size="sm" variant="ghost" onClick={() => setMoveOpen(false)}>Abbrechen</Button>
        </div>
      )}
      {moveOpen && item.recurring && item.source === 'event' && <Notice tone="neutral">Verschieben ändert nur diesen einen Termin. Die Serie bearbeitest du über „Bearbeiten“.</Notice>}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {sessionLink && !item.done && <ButtonLink to={sessionLink} variant="primary" size="sm" icon={Play}>Jetzt lernen</ButtonLink>}
        {canDone && <Button size="sm" variant={item.done || sessionLink ? 'secondary' : 'primary'} icon={Check} onClick={() => run(() => setItemDone(item, !item.done))}>{item.done ? 'Wieder offen' : 'Erledigt'}</Button>}
        <Button size="sm" icon={Pencil} onClick={onEdit}>Bearbeiten</Button>
        <Button size="sm" icon={ArrowRightLeft} onClick={() => setMoveOpen((o) => !o)}>Verschieben</Button>
        <Button size="sm" icon={Copy} onClick={() => run(() => duplicateItem(item), item.source === 'event' || item.source === 'task' ? 'Dupliziert' : 'Als eigener Lernblock kopiert')}>Duplizieren</Button>
        {item.source === 'exam' && <ButtonLink size="sm" to={`/pruefungen/${item.refId}`} icon={GraduationCap}>Vorbereitung</ButtonLink>}
        <Button size="sm" variant="ghost" icon={Trash2} className="text-danger" onClick={remove}>Löschen</Button>
      </div>
      {scopeEl}
    </div>
  )
}
