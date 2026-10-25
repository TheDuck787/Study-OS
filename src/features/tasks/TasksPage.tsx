import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Check, CheckCircle2, Flag, Inbox, ListTodo, MoreHorizontal, Pencil, Plus, Timer, Trash2 } from 'lucide-react'
import { db } from '@/db/index'
import type { DayKey, Task, TaskKind } from '@/db/types'
import { success } from '@/lib/motion'
import { deleteTask, quickAddTask, scheduleTask, setTaskDone, toggleSubtask } from '@/db/calendar'
import { eventMinutes } from '@/lib/calendar/planner'
import { ValidationError } from '@/db/repo'
import { Badge, Button, cn, Dialog, EmptyState, Field, Input, LoadingBlock, Menu, PageHeader, ProgressBar, Select, Tabs, useConfirm, useToast } from '@/components/ui'
import { addDays, dayKey, formatMinutes, parseDay, relativeDay, startOfWeek, WEEKDAYS_SHORT } from '@/lib/dates'
import { taskItem, type CalItem } from '@/lib/calendar/items'
import { KIND_META, PRIORITY_META } from '@/lib/calendar/meta'
import { formatTimeRange } from '@/lib/calendar/time'
import { subjectColorVar } from '@/lib/colors'
import { undoLast } from '@/lib/undo'
import { EntryEditor, type EditorTarget } from '@/features/calendar/EntryEditor'

type View = 'inbox' | 'today' | 'upcoming' | 'overdue' | 'done' | 'subjects'
const TASK_MIME = 'application/x-studyos-task'

/** CalItem for the editor (tasks without due date get a placeholder day that is not saved). */
const asItem = (t: Task): CalItem => taskItem({ ...t, dueDate: t.dueDate ?? dayKey() })!

export default function TasksPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const today = dayKey()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const sessions = useLiveQuery(() => db.events.filter((e) => !!e.taskId).toArray(), [])
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
  const [view, setView] = useState<View>('today')
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [schedule, setSchedule] = useState<{ task: Task; date: DayKey; start: string; minutes: number } | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('homework')
  const [subjectId, setSubjectId] = useState('')
  const [due, setDue] = useState<'today' | 'tomorrow' | 'date' | 'none'>('tomorrow')
  const [dueDate, setDueDate] = useState(addDays(today, 2))

  // ?aufgabe=<id> opens that task (links from the calendar)
  useEffect(() => {
    const id = params.get('aufgabe')
    const t = id ? tasks?.find((x) => x.id === id) : undefined
    if (t) {
      setEditor({ mode: 'edit', item: asItem(t) })
      setParams({}, { replace: true })
    }
  }, [params, tasks, setParams])

  const groups = useMemo(() => {
    const all = tasks ?? []
    const open = all.filter((t) => t.status === 'open')
    const sched = (id: string) => (sessions ?? []).filter((e) => e.taskId === id)
    const byDue = (a: Task, b: Task) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
    return {
      inbox: open.filter((t) => !t.dueDate && sched(t.id).length === 0),
      today: open.filter((t) => t.dueDate === today || t.dueDate === addDays(today, 1) || sched(t.id).some((e) => e.date === today && e.status === 'planned')).sort(byDue),
      upcoming: open.filter((t) => t.dueDate && t.dueDate > today).sort(byDue),
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).sort(byDue),
      done: all.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
      open: open.sort(byDue),
    }
  }, [tasks, sessions, today])

  if (!tasks || !sessions || !subjects) return <LoadingBlock />
  const subjectOf = (id: string | null) => subjects.find((s) => s.id === id)
  const undo = { label: 'Rückgängig', onClick: () => undoLast() }
  const fail = (e: unknown) => toast({ title: e instanceof ValidationError ? e.message : String(e), tone: 'danger' })

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const date = due === 'today' ? today : due === 'tomorrow' ? addDays(today, 1) : due === 'date' ? dueDate : null
    try {
      await quickAddTask(title, { kind, subjectId: subjectId || null, dueDate: date })
      setTitle('')
      toast({ title: 'Aufgabe angelegt', description: date ? `fällig ${relativeDay(date, today)}` : 'im Eingang', tone: 'success', action: undo })
    } catch (err) {
      fail(err)
    }
  }

  const list: Task[] = view === 'subjects' ? groups.open : groups[view]
  const tabs: { id: View; label: string; count?: number }[] = [
    { id: 'today', label: 'Heute & morgen', count: groups.today.length },
    { id: 'inbox', label: 'Eingang', count: groups.inbox.length },
    { id: 'upcoming', label: 'Demnächst', count: groups.upcoming.length },
    { id: 'overdue', label: 'Überfällig', count: groups.overdue.length },
    { id: 'done', label: 'Erledigt', count: groups.done.length },
    { id: 'subjects', label: 'Nach Fach' },
  ]
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i)).filter((d) => d >= today).concat(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), 7 + i))).slice(0, 7)

  const row = (t: Task) => {
    const s = subjectOf(t.subjectId)
    const sched = sessions.filter((e) => e.taskId === t.id).sort((a, b) => a.date.localeCompare(b.date))
    const plannedMin = sched.filter((e) => e.status !== 'cancelled').reduce((m, e) => m + eventMinutes(e), 0)
    const M = KIND_META[t.kind]
    const overdue = t.status === 'open' && t.dueDate && t.dueDate < today
    return (
      <li
        key={t.id}
        draggable={t.status === 'open'}
        onDragStart={(e) => e.dataTransfer.setData(TASK_MIME, t.id)}
        className="group flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-[border-color,background-color] duration-[var(--dur-2)] hover:border-border-strong"
        style={{ ['--c' as string]: s ? subjectColorVar(s.color) : M.color }}
      >
        <button type="button" role="checkbox" aria-checked={t.status === 'done'} aria-label={t.status === 'done' ? `„${t.title}“ wieder öffnen` : `„${t.title}“ erledigt`}
          onClick={(e) => { if (t.status !== 'done') success(e.currentTarget); void setTaskDone(t.id, t.status !== 'done').then(() => toast({ title: t.status === 'done' ? 'Wieder offen' : 'Erledigt', tone: 'success', action: undo }), fail) }}
          className={cn('mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 transition-colors', t.status === 'done' ? 'border-transparent bg-[var(--c)] text-[var(--bg)]' : 'border-[color-mix(in_oklab,var(--c)_70%,var(--fg-subtle))] hover:bg-[color-mix(in_oklab,var(--c)_20%,transparent)]')}>
          {t.status === 'done' && <Check className="pop-in size-3.5" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setEditor({ mode: 'edit', item: asItem(t) })} className={cn('block max-w-full cursor-pointer truncate text-left text-sm font-medium hover:text-accent', t.status === 'done' && 'text-fg-muted line-through')}>{t.title}</button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1"><M.icon className="size-3" style={{ color: 'var(--c)' }} />{M.label}</span>
            {s && <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[var(--c)]" />{s.name}</span>}
            {t.dueDate && <span className={cn(overdue && 'font-medium text-warn')}>fällig {relativeDay(t.dueDate, today)}{t.dueTime ? `, ${t.dueTime}` : ''}</span>}
            {t.priority === 'high' && <span className="inline-flex items-center gap-0.5 text-warn"><Flag className="size-3" />hoch</span>}
            {t.estimateMinutes && <span className="inline-flex items-center gap-0.5"><Timer className="size-3" />{formatMinutes(t.estimateMinutes)}</span>}
            {sched.length > 0 && <span className="inline-flex items-center gap-0.5" title={sched.map((e) => `${parseDay(e.date).toLocaleDateString('de-DE')} ${formatTimeRange(e.start, e.end)}`).join('\n')}><CalendarPlus className="size-3" />{sched.length} Block{sched.length === 1 ? '' : 'e'} geplant ({formatMinutes(plannedMin)})</span>}
          </div>
          {t.subtasks.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1">
              <ProgressBar value={t.subtasks.filter((x) => x.done).length / t.subtasks.length} label="Teilaufgaben erledigt" className="max-w-56" />
              <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                {t.subtasks.map((st) => (
                  <li key={st.id}>
                    <button type="button" onClick={() => toggleSubtask(t.id, st.id)} className={cn('inline-flex cursor-pointer items-center gap-1 text-xs', st.done ? 'text-fg-subtle line-through' : 'text-fg-muted hover:text-fg')}>
                      <span className={cn('flex size-3 items-center justify-center rounded-[3px] border', st.done ? 'border-transparent bg-[var(--c)]' : 'border-border-strong')} />{st.text}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {t.status === 'open' && <Button size="sm" variant="ghost" icon={CalendarPlus} onClick={() => setSchedule({ task: t, date: today, start: '16:00', minutes: Math.min(90, t.estimateMinutes ?? 30) })} className="hidden sm:inline-flex">Einplanen</Button>}
        <Menu label={`Aktionen für ${t.title}`} icon={MoreHorizontal} items={[
          { label: 'Arbeitszeit einplanen', icon: CalendarPlus, onSelect: () => setSchedule({ task: t, date: today, start: '16:00', minutes: Math.min(90, t.estimateMinutes ?? 30) }), disabled: t.status === 'done' },
          { label: 'Bearbeiten', icon: Pencil, onSelect: () => setEditor({ mode: 'edit', item: asItem(t) }) },
          { label: 'Löschen', icon: Trash2, danger: true, onSelect: async () => { if (await confirm({ title: `„${t.title}“ löschen?`, message: sched.length ? `Auch ${sched.length} eingeplante Arbeitszeit(en) werden entfernt.` : undefined })) await deleteTask(t.id).then(() => toast({ title: 'Gelöscht', action: undo })) } },
        ]} />
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Aufgaben" description="Hausaufgaben, Projekte und To-dos. Geplante Arbeitszeit erscheint im Kalender – die Aufgabe selbst bleibt eine." actions={<Button variant="primary" icon={Plus} onClick={() => setEditor({ mode: 'create', kind: 'homework', date: addDays(today, 1) })}>Aufgabe mit Details</Button>} />

      <form onSubmit={add} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3" aria-label="Schnell hinzufügen">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neue Aufgabe, z. B. „Mathe S. 42 Nr. 3“ – Enter zum Speichern" aria-label="Neue Aufgabe" />
          <Button type="submit" variant="primary" icon={Plus} disabled={!title.trim()}><span className="hidden sm:inline">Hinzufügen</span></Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="w-36"><Select aria-label="Art" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} className="h-8 text-sm">
            <option value="homework">Hausaufgabe</option><option value="project">Projekt</option><option value="todo">To-do</option>
          </Select></div>
          <div className="w-40"><Select aria-label="Fach" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-8 text-sm">
            <option value="">Ohne Fach</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select></div>
          <div className="flex gap-1" role="radiogroup" aria-label="Fällig">
            {([['today', 'Heute'], ['tomorrow', 'Morgen'], ['date', 'Datum'], ['none', 'Ohne']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={due === v} onClick={() => setDue(v)} className={cn('h-8 cursor-pointer rounded-md border px-2.5 text-xs font-medium', due === v ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>{l}</button>
            ))}
          </div>
          {due === 'date' && <div className="w-40"><Input type="date" aria-label="Fälligkeitsdatum" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm" /></div>}
        </div>
      </form>

      <section aria-label="Diese Woche" className="hidden md:block">
        <div className="mb-1.5 text-xs text-fg-subtle">Aufgabe auf einen Tag ziehen, um Arbeitszeit einzuplanen</div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((d) => {
            const n = sessions.filter((e) => e.date === d && e.status === 'planned').length
            const dueN = (tasks ?? []).filter((t) => t.status === 'open' && t.dueDate === d).length
            return (
              <div key={d} onDragOver={(e) => { if (e.dataTransfer.types.includes(TASK_MIME)) { e.preventDefault(); e.currentTarget.classList.add('border-accent') } }} onDragLeave={(e) => e.currentTarget.classList.remove('border-accent')}
                onDrop={(e) => { e.currentTarget.classList.remove('border-accent'); const t = tasks?.find((x) => x.id === e.dataTransfer.getData(TASK_MIME)); if (t) setSchedule({ task: t, date: d, start: '16:00', minutes: Math.min(90, t.estimateMinutes ?? 30) }) }}
                className={cn('rounded-lg border border-dashed border-border px-2 py-2 text-center transition-colors', d === today && 'bg-accent-soft/40')}>
                <div className="text-xs text-fg-subtle">{WEEKDAYS_SHORT[parseDay(d).getDay()]}</div>
                <div className={cn('text-sm font-semibold tabular', d === today && 'text-accent')}>{parseDay(d).getDate()}.</div>
                <div className="mt-0.5 text-[0.7rem] text-fg-muted">{n} geplant · {dueN} fällig</div>
              </div>
            )
          })}
        </div>
      </section>

      <Tabs label="Aufgabenlisten" tabs={tabs} value={view} onChange={setView} />
      {view === 'subjects' ? (
        groups.open.length === 0 ? <EmptyState icon={CheckCircle2} title="Keine offenen Aufgaben" /> : (
          <div className="flex flex-col gap-5">
            {[...subjects.map((s) => s.id), null].map((sid) => {
              const ts = groups.open.filter((t) => t.subjectId === sid)
              if (!ts.length) return null
              const s = subjectOf(sid)
              return (
                <section key={sid ?? 'none'} aria-label={s?.name ?? 'Ohne Fach'}>
                  <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><span className="size-2.5 rounded-full" style={{ background: s ? subjectColorVar(s.color) : 'var(--fg-subtle)' }} />{s?.name ?? 'Ohne Fach'} <Badge>{ts.length}</Badge></h2>
                  <ul className="stagger flex flex-col gap-1.5">{ts.map(row)}</ul>
                </section>
              )
            })}
          </div>
        )
      ) : list.length === 0 ? (
        <EmptyState icon={view === 'inbox' ? Inbox : view === 'done' ? CheckCircle2 : ListTodo} compact
          title={{ inbox: 'Eingang ist leer', today: 'Für heute und morgen ist nichts fällig', upcoming: 'Keine anstehenden Aufgaben', overdue: 'Nichts überfällig', done: 'Noch nichts erledigt', subjects: '' }[view]}
          description={view === 'inbox' ? 'Aufgaben ohne Datum und ohne geplante Zeit landen hier.' : view === 'overdue' ? 'Sehr gut – alles im Plan.' : undefined} />
      ) : (
        <ul className="stagger flex flex-col gap-1.5">{list.slice(0, view === 'done' ? 50 : undefined).map(row)}</ul>
      )}

      <Dialog open={!!schedule} onClose={() => setSchedule(null)} title="Arbeitszeit einplanen" description={schedule ? `„${schedule.task.title}“ – erscheint als Block im Kalender und bleibt mit der Aufgabe verbunden.` : undefined} size="sm"
        footer={<><Button onClick={() => setSchedule(null)}>Abbrechen</Button><Button variant="primary" onClick={async () => {
          if (!schedule) return
          try {
            await scheduleTask(schedule.task.id, schedule.date, schedule.start, schedule.minutes)
            toast({ title: 'Eingeplant', description: `${parseDay(schedule.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}, ${schedule.start} Uhr`, tone: 'success', action: undo })
            setSchedule(null)
          } catch (e) {
            fail(e)
          }
        }}>Einplanen</Button></>}>
        {schedule && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tag" htmlFor="sch-d"><Input id="sch-d" type="date" value={schedule.date} onChange={(e) => setSchedule({ ...schedule, date: e.target.value })} /></Field>
            <Field label="Beginn" htmlFor="sch-s"><Input id="sch-s" type="time" value={schedule.start} onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} /></Field>
            <Field label="Minuten" htmlFor="sch-m"><Input id="sch-m" type="number" min={5} max={240} step={5} value={schedule.minutes} onChange={(e) => setSchedule({ ...schedule, minutes: Number(e.target.value) })} /></Field>
          </div>
        )}
      </Dialog>
      <EntryEditor target={editor} onClose={() => setEditor(null)} onSaved={(m) => toast({ title: m, tone: 'success', action: undo })} />
    </div>
  )
}

