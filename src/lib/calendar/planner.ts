import type { CalendarEvent, DayKey, Exam, PlanSession, PlannerSettings, Task, Topic } from '@/db/types'
import { addDays, diffDays, formatDayShort, rangeDays, weekday } from '../dates'
import { generateStudyPlan, type PlanTopic } from '../studyplan'
import { uid } from '../id'
import { buildItems, type CalItem } from './items'
import { KIND_META } from './meta'
import { fromMin, roundUpTo, toMin } from './time'

/**
 * Smart study scheduler – works completely without AI.
 *
 * 1. Demand: exam plans (existing generator, weakest topics first), open homework/projects split into
 *    sessions, flashcard reviews on days with due cards.
 * 2. Supply: the student's study windows per weekday minus lessons/appointments (+ buffer), minus rest
 *    days and days blocked by all-day entries, limited by the daily maximum.
 * 3. Placement: earliest deadline first; each item goes to its preferred day if possible, otherwise later
 *    (but before its deadline), otherwise earlier. Breaks between sessions, no overlaps.
 * 4. The result is a proposal. Manual entries, done sessions and sessions moved by hand are never touched.
 */

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = {
  windows: [
    { from: '15:00', to: '19:00' },
    { from: '15:30', to: '19:30' },
    { from: '15:30', to: '19:30' },
    { from: '15:30', to: '19:30' },
    { from: '15:30', to: '19:30' },
    { from: '15:00', to: '18:30' },
    { from: '10:00', to: '13:00' },
  ],
  school: [null, { from: '07:45', to: '14:30' }, { from: '07:45', to: '14:30' }, { from: '07:45', to: '14:30' }, { from: '07:45', to: '14:30' }, { from: '07:45', to: '13:00' }, null],
  maxDailyMinutes: 90,
  sessionMaxMinutes: 45,
  breakMinutes: 10,
  bufferMinutes: 15,
  horizonDays: 14,
  includeFlashcards: true,
}

export const TASK_DEFAULT_MINUTES = { homework: 30, project: 120, todo: 20 } as const

// ───────────────────────── Placement (pure) ─────────────────────────

export interface Demand {
  id: string
  title: string
  minutes: number
  /** Never before this day. */
  earliest: DayKey
  /** Day suggested by the content logic (e.g. spaced repetition). */
  preferred: DayKey
  /** Must be finished by this day (inclusive). */
  latest: DayKey
  /** Lower = more important when days are full. */
  urgency: number
  /** Tie-breaker that keeps a content order (e.g. diagnosis before practice). */
  seq?: number
}

export interface DaySupply {
  date: DayKey
  /** Free intervals in minutes since midnight. */
  free: [number, number][]
  /** Study minutes still allowed this day. */
  capacity: number
}

export interface Placement {
  demandId: string
  date: DayKey
  start: string
  end: string
}

export interface PlaceResult {
  placements: Placement[]
  unplaced: Demand[]
}

function takeSlot(day: DaySupply, minutes: number, breakMin: number): [number, number] | null {
  if (day.capacity < minutes) return null
  for (let i = 0; i < day.free.length; i++) {
    const [a, b] = day.free[i]
    if (b - a >= minutes) {
      const slot: [number, number] = [a, a + minutes]
      const next = a + minutes + breakMin
      if (next < b) day.free[i] = [next, b]
      else day.free.splice(i, 1)
      day.capacity -= minutes
      return slot
    }
  }
  return null
}

/** Order in which days are tried: preferred → later (until deadline) → earlier (not before earliest). */
export function candidateDays(d: Demand, firstDay: DayKey): DayKey[] {
  const lo = d.earliest > firstDay ? d.earliest : firstDay
  if (d.latest < lo) return [lo] // overdue: as soon as possible
  const pref = d.preferred < lo ? lo : d.preferred > d.latest ? d.latest : d.preferred
  const out = rangeDays(pref, d.latest)
  for (let x = addDays(pref, -1); x >= lo; x = addDays(x, -1)) out.push(x)
  return out
}

export function placeDemands(demands: Demand[], supply: DaySupply[], breakMin: number): PlaceResult {
  const byDay = new Map(supply.map((s) => [s.date, { ...s, free: s.free.map((f) => [...f] as [number, number]) }]))
  const firstDay = supply[0]?.date ?? '9999-12-31'
  const ordered = [...demands].sort((a, b) => a.latest.localeCompare(b.latest) || a.urgency - b.urgency || a.preferred.localeCompare(b.preferred) || (a.seq ?? 0) - (b.seq ?? 0) || a.id.localeCompare(b.id))
  const placements: Placement[] = []
  const unplaced: Demand[] = []
  for (const d of ordered) {
    let done = false
    for (const day of candidateDays(d, firstDay)) {
      const s = byDay.get(day)
      if (!s) continue
      const slot = takeSlot(s, d.minutes, breakMin)
      if (slot) {
        placements.push({ demandId: d.id, date: day, start: fromMin(slot[0]), end: fromMin(slot[1]) })
        done = true
        break
      }
    }
    if (!done) unplaced.push(d)
  }
  placements.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
  return { placements, unplaced }
}

/** Subtracts busy blocks from a window. */
export function freeIntervals(window: [number, number], busy: [number, number][]): [number, number][] {
  let free: [number, number][] = [window]
  for (const [bs, be] of [...busy].sort((a, b) => a[0] - b[0])) {
    const next: [number, number][] = []
    for (const [fs, fe] of free) {
      if (be <= fs || bs >= fe) next.push([fs, fe])
      else {
        if (bs > fs) next.push([fs, bs])
        if (be < fe) next.push([be, fe])
      }
    }
    free = next
  }
  return free.filter(([a, b]) => b - a >= 5)
}

export interface SupplyInput {
  days: DayKey[]
  settings: PlannerSettings
  restDays: number[]
  /** Fixed entries (anything the planner may not move). */
  fixed: CalItem[]
  today: DayKey
  nowMin: number
}

export function buildSupply({ days, settings, restDays, fixed, today, nowMin }: SupplyInput): DaySupply[] {
  return days.map((date) => {
    const w = settings.windows[weekday(date)]
    const onDay = fixed.filter((i) => i.date <= date && i.endDate >= date && !i.cancelled)
    const blocked = onDay.some((i) => i.allDay && i.blocksStudy)
    if (!w || restDays.includes(weekday(date)) || blocked) return { date, free: [], capacity: 0 }
    let from = toMin(w.from)
    const to = toMin(w.to)
    if (date === today) from = Math.max(from, roundUpTo(nowMin + 5, 15))
    const busy: [number, number][] = []
    let used = 0
    for (const i of onDay) {
      const study = KIND_META[i.kind].study
      if (study) used += i.minutes
      if (!i.start || i.allDay || !KIND_META[i.kind].busy) continue
      const s = toMin(i.start)
      const e = i.end ? toMin(i.end) : s + 30
      const pad = study ? 0 : settings.bufferMinutes
      busy.push([s - pad, e + (study ? settings.breakMinutes : pad)])
    }
    return { date, free: from < to ? freeIntervals([from, to], busy) : [], capacity: Math.max(0, settings.maxDailyMinutes - used) }
  })
}

// ───────────────────────── Proposal (orchestration) ─────────────────────────

export interface PlannerData {
  today: DayKey
  nowMin: number
  settings: PlannerSettings
  restDays: number[]
  events: CalendarEvent[]
  exams: Exam[]
  tasks: Task[]
  topics: Topic[]
  topicState: (topicId: string) => { mastery: number; level: PlanTopic['level'] }
  /** Number of flashcards due on each day of the horizon (today includes overdue + today's new cards). */
  cardsDueByDay: Map<DayKey, number>
}

export type ChangeAction = 'add' | 'move' | 'remove' | 'keep'

export interface PlanChange {
  id: string
  action: ChangeAction
  title: string
  subjectId: string | null
  kind: 'study' | 'flashcards'
  minutes: number
  date: DayKey
  start: string | null
  end: string | null
  /** Previous position for moves/removals. */
  from?: { date: DayKey; start: string | null }
  reason: string
  target: { type: 'plan'; examId: string; session: PlanSession } | { type: 'event'; event: CalendarEvent }
}

export interface PlanProposal {
  mode: 'full' | 'today'
  changes: PlanChange[]
  warnings: string[]
  /** Exam plan sessions beyond the horizon that get a date but no time yet. */
  untimedCount: number
}

const EXAM_LOOKAHEAD_DAYS = 60

const sameSession = (a: PlanSession, b: PlanSession) => a.type === b.type && a.title === b.title && a.topicIds.join() === b.topicIds.join()

/** Planner events and plan sessions the planner may still change. */
const replaceableEvent = (e: CalendarEvent) => e.source === 'planner' && !e.pinned && e.status === 'planned' && !e.recurrence
const replaceableSession = (s: PlanSession) => !s.done && !s.pinned

function newPlannerEvent(base: Partial<CalendarEvent> & Pick<CalendarEvent, 'title' | 'category' | 'date'>): CalendarEvent {
  const now = new Date().toISOString()
  return {
    id: uid('ev'), customCategoryId: null, subjectId: null, endDate: null, allDay: false, start: null, end: null, priority: 'medium', status: 'planned',
    description: '', location: '', teacher: '', topicIds: [], materialIds: [], deckId: null, taskId: null, examId: null, workloadMinutes: null,
    reminderMinutes: null, checklist: [], recurrence: null, completedDates: [], seriesId: null, originalDate: null, source: 'planner', pinned: false,
    blocksStudy: false, createdAt: now, updatedAt: now, ...base,
  }
}

interface DemandRef {
  demand: Demand
  make: (p: Placement | null) => PlanChange
}

const fixedItems = (data: PlannerData, from: DayKey, to: DayKey, isReplaced: (i: CalItem) => boolean): CalItem[] =>
  buildItems({ events: data.events, exams: data.exams, tasks: [], from, to }).filter((i) => !isReplaced(i))

/** Planned length of an event in minutes (timed: duration, otherwise its workload). */
export const eventMinutes = (e: CalendarEvent) => (e.start && e.end ? toMin(e.end) - toMin(e.start) : (e.workloadMinutes ?? 0))

/** Full plan for the horizon: "Lernplan automatisch erstellen" / "Plan neu berechnen". */
export function proposeFullPlan(data: PlannerData): PlanProposal {
  const { today, settings } = data
  const horizonEnd = addDays(today, Math.max(1, settings.horizonDays) - 1)
  const warnings: string[] = []
  const refs: DemandRef[] = []
  const changes: PlanChange[] = []
  let untimedCount = 0

  // 1) Exams: regenerate plans from real mastery; keep done/pinned sessions; match new sessions with old ones.
  for (const exam of data.exams) {
    const days = diffDays(today, exam.date)
    if (days <= 0 || days > EXAM_LOOKAHEAD_DAYS) continue
    const topics = exam.topicIds.map((id) => data.topics.find((t) => t.id === id)).filter((t): t is Topic => !!t)
    const kept = exam.plan.filter((s) => !replaceableSession(s))
    const gen = generateStudyPlan({
      today, examDate: exam.date, minutesPerDay: exam.minutesPerDay, availableWeekdays: exam.availableWeekdays, difficulty: exam.difficulty,
      keep: kept, skipDiagnostic: exam.plan.some((s) => s.type === 'diagnostic' && s.done),
      topics: topics.map((t) => ({ id: t.id, name: t.name, prerequisiteIds: t.prerequisiteIds, ...data.topicState(t.id) })),
    })
    warnings.push(...gen.warnings.map((w) => `${exam.title}: ${w}`))
    const fresh = gen.sessions.filter((s) => !kept.some((k) => k.id === s.id)).filter((s) => !kept.some((k) => !k.done && sameSession(k, s)))
    const old = exam.plan.filter(replaceableSession)
    const usedOld = new Set<string>()
    for (const [seq, s] of fresh.entries()) {
      const match = old.find((o) => !usedOld.has(o.id) && sameSession(o, s))
      if (match) usedOld.add(match.id)
      const session: PlanSession = { ...s, id: match?.id ?? s.id, start: null, pinned: false }
      const latest = addDays(exam.date, -1)
      const base = { title: s.title, subjectId: exam.subjectId, kind: 'study' as const, minutes: s.minutes, target: { type: 'plan' as const, examId: exam.id, session } }
      if (s.date > horizonEnd) {
        untimedCount++
        changes.push({ ...base, id: `plan:${exam.id}:${session.id}`, action: match ? (match.date === s.date && !match.start ? 'keep' : 'move') : 'add', date: s.date, start: null, end: null, from: match ? { date: match.date, start: match.start ?? null } : undefined, reason: `Lernplan „${exam.title}“ (Uhrzeit folgt bei späterer Planung)`, target: { ...base.target, session: { ...session, date: s.date } } })
        continue
      }
      refs.push({
        demand: { id: `plan:${exam.id}:${session.id}`, title: s.title, minutes: s.minutes, earliest: today, preferred: s.date, latest, urgency: days * 10 + (s.type === 'final' ? 0 : 5), seq },
        make: (p) => {
          const date = p?.date ?? s.date
          const start = p?.start ?? null
          const unchanged = !!match && match.date === date && (match.start ?? null) === start
          return {
            ...base, id: `plan:${exam.id}:${session.id}`, action: match ? (unchanged ? 'keep' : 'move') : 'add', date, start, end: p?.end ?? null,
            from: match ? { date: match.date, start: match.start ?? null } : undefined,
            reason: `Vorbereitung „${exam.title}“ – noch ${days} Tag${days === 1 ? '' : 'e'}`,
            target: { ...base.target, session: { ...session, date, start } },
          }
        },
      })
    }
    for (const o of old) {
      if (usedOld.has(o.id)) continue
      changes.push({ id: `plan:${exam.id}:${o.id}`, action: 'remove', title: o.title, subjectId: exam.subjectId, kind: 'study', minutes: o.minutes, date: o.date, start: o.start ?? null, end: null, reason: 'Nicht mehr nötig nach Neuberechnung', target: { type: 'plan', examId: exam.id, session: o } })
    }
  }

  // 2) Tasks with a due date: remaining effort → sessions spread before the deadline.
  // oldest first, so part 1 keeps matching part 1 and re-planning does not shuffle the parts
  const oldTaskEvents = data.events.filter((e) => replaceableEvent(e) && e.taskId).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
  const usedTaskEvents = new Set<string>()
  for (const t of data.tasks) {
    if (t.status === 'done' || !t.dueDate) continue
    const sessions = data.events.filter((e) => e.taskId === t.id)
    // done sessions and sessions placed by hand already cover part of the effort
    const keptMinutes = sessions.filter((e) => !replaceableEvent(e)).reduce((s, e) => s + eventMinutes(e), 0)
    const total = t.estimateMinutes ?? TASK_DEFAULT_MINUTES[t.kind]
    let remaining = total - keptMinutes
    if (remaining < 10) continue
    const latest = t.dueDate <= today ? today : addDays(t.dueDate, -1)
    if (t.dueDate < today) warnings.push(`„${t.title}“ ist seit ${formatDayShort(t.dueDate)} überfällig – wird so bald wie möglich eingeplant.`)
    const chunk = Math.max(15, settings.sessionMaxMinutes)
    const n = Math.ceil(remaining / chunk)
    const spreadEnd = latest < horizonEnd ? latest : horizonEnd
    const span = Math.max(0, diffDays(today, spreadEnd))
    for (let i = 0; i < n; i++) {
      const minutes = Math.min(chunk, remaining)
      remaining -= minutes
      if (minutes < 10) break
      const preferred = addDays(today, Math.floor((i * (span + 1)) / n))
      const old = oldTaskEvents.find((e) => e.taskId === t.id && !usedTaskEvents.has(e.id))
      if (old) usedTaskEvents.add(old.id)
      const ev = old ? { ...old } : newPlannerEvent({ title: `${t.title}${n > 1 ? ` (Teil ${i + 1}/${n})` : ''}`, category: 'study', date: preferred, subjectId: t.subjectId, taskId: t.id, topicIds: t.topicIds, priority: t.priority })
      ev.title = `${t.title}${n > 1 ? ` (Teil ${i + 1}/${n})` : ''}`
      const prioRank = t.priority === 'high' ? 0 : t.priority === 'medium' ? 1 : 2
      refs.push({
        demand: { id: `task:${t.id}:${i}`, title: ev.title, minutes, earliest: today, preferred, latest, urgency: Math.max(0, diffDays(today, t.dueDate)) * 10 + prioRank },
        make: (p) => {
          const date = p?.date ?? preferred
          const unchanged = !!old && old.date === date && old.start === (p?.start ?? null)
          return {
            id: `task:${t.id}:${i}`, action: old ? (unchanged ? 'keep' : 'move') : 'add', title: ev.title, subjectId: t.subjectId, kind: 'study', minutes, date,
            start: p?.start ?? null, end: p?.end ?? null, from: old ? { date: old.date, start: old.start } : undefined,
            reason: `Für „${t.title}“ (fällig ${formatDayShort(t.dueDate!)})`,
            target: { type: 'event', event: { ...ev, date, start: p?.start ?? null, end: p?.end ?? null, allDay: false } },
          }
        },
      })
    }
  }
  for (const e of oldTaskEvents) {
    if (usedTaskEvents.has(e.id)) continue
    changes.push({ id: `ev:${e.id}`, action: 'remove', title: e.title, subjectId: e.subjectId, kind: 'study', minutes: eventMinutes(e), date: e.date, start: e.start, end: e.end, reason: 'Aufgabe erledigt oder Aufwand schon eingeplant', target: { type: 'event', event: e } })
  }

  // 3) Flashcard reviews on days with due cards.
  const oldCardEvents = data.events.filter((e) => replaceableEvent(e) && e.category === 'flashcards')
  const usedCard = new Set<string>()
  if (settings.includeFlashcards) {
    for (const day of rangeDays(today, horizonEnd)) {
      const count = data.cardsDueByDay.get(day) ?? 0
      if (count < (day === today ? 1 : 5)) continue
      if (!settings.windows[weekday(day)] || data.restDays.includes(weekday(day))) continue // no study time that day
      if (data.events.some((e) => e.category === 'flashcards' && e.date === day && !replaceableEvent(e))) continue
      const minutes = Math.min(20, Math.max(5, Math.ceil(count * 0.5)))
      const old = oldCardEvents.find((e) => e.date === day && !usedCard.has(e.id))
      if (old) usedCard.add(old.id)
      const ev = old ? { ...old } : newPlannerEvent({ title: 'Karteikarten wiederholen', category: 'flashcards', date: day })
      ev.description = `${count} Karte${count === 1 ? '' : 'n'} fällig`
      refs.push({
        demand: { id: `cards:${day}`, title: ev.title, minutes, earliest: day, preferred: day, latest: day, urgency: 50 },
        make: (p) => ({
          id: `cards:${day}`, action: old ? (old.start === (p?.start ?? null) ? 'keep' : 'move') : 'add', title: ev.title, subjectId: null, kind: 'flashcards', minutes, date: day,
          start: p?.start ?? null, end: p?.end ?? null, from: old ? { date: old.date, start: old.start } : undefined, reason: `${count} Karte${count === 1 ? '' : 'n'} fällig (verteilte Wiederholung)`,
          target: { type: 'event', event: { ...ev, start: p?.start ?? null, end: p?.end ?? null } },
        }),
      })
    }
  }
  for (const e of oldCardEvents) if (!usedCard.has(e.id) && e.date >= today) changes.push({ id: `ev:${e.id}`, action: 'remove', title: e.title, subjectId: null, kind: 'flashcards', minutes: 0, date: e.date, start: e.start, end: e.end, reason: 'Keine fälligen Karten mehr', target: { type: 'event', event: e } })

  // 4) Place everything into free time.
  const replacedKeys = new Set<string>()
  for (const e of data.events) if (replaceableEvent(e)) replacedKeys.add(`ev:${e.id}`)
  for (const x of data.exams) for (const s of x.plan) if (replaceableSession(s)) replacedKeys.add(`plan:${x.id}:${s.id}`)
  const days = rangeDays(today, horizonEnd)
  const fixed = fixedItems(data, today, horizonEnd, (i) => replacedKeys.has(i.key))
  const supply = buildSupply({ days, settings, restDays: data.restDays, fixed, today, nowMin: data.nowMin })
  const { placements, unplaced } = placeDemands(refs.map((r) => r.demand), supply, settings.breakMinutes)
  const byId = new Map(placements.map((p) => [p.demandId, p]))
  for (const r of refs) {
    const p = byId.get(r.demand.id)
    if (p) changes.push(r.make(p))
  }
  if (unplaced.length) {
    warnings.push(
      `${unplaced.length} Einheit${unplaced.length === 1 ? '' : 'en'} passt nicht mehr in deine freie Lernzeit: ${unplaced.slice(0, 4).map((d) => d.title).join(', ')}${unplaced.length > 4 ? ' …' : ''}. ` +
        'Mehr Lernzeit pro Tag, größere Lernfenster oder weniger Termine würden helfen.',
    )
    // keep their old entries instead of silently dropping them
    for (const d of unplaced) {
      const ref = refs.find((r) => r.demand.id === d.id)!
      const c = ref.make(null)
      if (c.action === 'add') continue
      const prev = c.from
      if (prev) changes.push({ ...c, action: 'keep', date: prev.date, start: prev.start })
    }
  }
  return { mode: 'full', changes: sortChanges(changes), warnings, untimedCount }
}

/** "Plan für heute optimieren": moves today's open and overdue planner items into the remaining free time. */
export function proposeTodayPlan(data: PlannerData): PlanProposal {
  const { today, settings } = data
  const changes: PlanChange[] = []
  const warnings: string[] = []
  const refs: DemandRef[] = []
  const oldest = addDays(today, -14)
  for (const exam of data.exams) {
    if (exam.date <= today) continue
    for (const s of exam.plan) {
      if (!replaceableSession(s) || s.date > today || s.date < oldest) continue
      const days = diffDays(today, exam.date)
      refs.push({
        demand: { id: `plan:${exam.id}:${s.id}`, title: s.title, minutes: s.minutes, earliest: today, preferred: today, latest: addDays(exam.date, -1), urgency: days * 10 },
        make: (p) => ({
          id: `plan:${exam.id}:${s.id}`, action: p && (p.date !== s.date || p.start !== (s.start ?? null)) ? 'move' : 'keep', title: s.title, subjectId: exam.subjectId, kind: 'study',
          minutes: s.minutes, date: p?.date ?? s.date, start: p?.start ?? s.start ?? null, end: p?.end ?? null, from: { date: s.date, start: s.start ?? null },
          reason: s.date < today ? `Verpasst am ${formatDayShort(s.date)} – nachholen für „${exam.title}“` : `Heute geplant für „${exam.title}“`,
          target: { type: 'plan', examId: exam.id, session: { ...s, date: p?.date ?? s.date, start: p?.start ?? s.start ?? null } },
        }),
      })
    }
  }
  for (const e of data.events) {
    if (!replaceableEvent(e) || e.date > today || e.date < oldest) continue
    if (e.category === 'flashcards' && e.date < today) continue // old card blocks are replaced by today's due cards
    const task = e.taskId ? data.tasks.find((t) => t.id === e.taskId) : undefined
    if (task?.status === 'done') continue
    const minutes = Math.max(10, eventMinutes(e) || 30)
    const latest = task?.dueDate && task.dueDate > today ? addDays(task.dueDate, -1) : today
    refs.push({
      demand: { id: `ev:${e.id}`, title: e.title, minutes, earliest: today, preferred: today, latest, urgency: task?.dueDate ? Math.max(0, diffDays(today, task.dueDate)) * 10 : 40 },
      make: (p) => ({
        id: `ev:${e.id}`, action: p && (p.date !== e.date || p.start !== e.start) ? 'move' : 'keep', title: e.title, subjectId: e.subjectId, kind: e.category === 'flashcards' ? 'flashcards' : 'study',
        minutes, date: p?.date ?? e.date, start: p?.start ?? e.start, end: p?.end ?? e.end, from: { date: e.date, start: e.start },
        reason: e.date < today ? `Verpasst am ${formatDayShort(e.date)} – nachholen` : 'Heute geplant',
        target: { type: 'event', event: { ...e, date: p?.date ?? e.date, start: p?.start ?? e.start, end: p?.end ?? e.end } },
      }),
    })
  }
  const cardsToday = data.cardsDueByDay.get(today) ?? 0
  if (settings.includeFlashcards && cardsToday > 0 && !data.events.some((e) => e.category === 'flashcards' && e.date === today)) {
    const minutes = Math.min(20, Math.max(5, Math.ceil(cardsToday * 0.5)))
    const ev = newPlannerEvent({ title: 'Karteikarten wiederholen', category: 'flashcards', date: today, description: `${cardsToday} Karten fällig` })
    refs.push({
      demand: { id: `cards:${today}`, title: ev.title, minutes, earliest: today, preferred: today, latest: today, urgency: 50 },
      make: (p) => ({ id: `cards:${today}`, action: 'add', title: ev.title, subjectId: null, kind: 'flashcards', minutes, date: today, start: p?.start ?? null, end: p?.end ?? null, reason: `${cardsToday} Karten fällig`, target: { type: 'event', event: { ...ev, start: p?.start ?? null, end: p?.end ?? null } } }),
    })
  }
  if (refs.length === 0) return { mode: 'today', changes: [], warnings: ['Für heute ist nichts offen, das der Planer verschieben könnte. Eigene Termine bleiben immer, wie sie sind.'], untimedCount: 0 }
  const moving = new Set(refs.map((r) => r.demand.id))
  const end = addDays(today, settings.horizonDays - 1)
  const fixed = fixedItems(data, today, end, (i) => moving.has(i.key))
  const supply = buildSupply({ days: rangeDays(today, end), settings, restDays: data.restDays, fixed, today, nowMin: data.nowMin })
  const { placements, unplaced } = placeDemands(refs.map((r) => r.demand), supply, settings.breakMinutes)
  const byId = new Map(placements.map((p) => [p.demandId, p]))
  for (const r of refs) {
    const p = byId.get(r.demand.id)
    if (p) changes.push(r.make(p))
  }
  const tomorrowish = placements.filter((p) => p.date > today).length
  if (tomorrowish) warnings.push(`${tomorrowish} Einheit${tomorrowish === 1 ? ' passt' : 'en passen'} heute nicht mehr und ${tomorrowish === 1 ? 'wird' : 'werden'} auf die nächsten Tage verschoben.`)
  if (unplaced.length) warnings.push(`Für ${unplaced.map((d) => `„${d.title}“`).join(', ')} ist vor der Frist keine freie Zeit mehr. Plane dafür Zeit von Hand ein.`)
  return { mode: 'today', changes: sortChanges(changes), warnings, untimedCount: 0 }
}

function sortChanges(c: PlanChange[]): PlanChange[] {
  const rank: Record<ChangeAction, number> = { add: 0, move: 0, keep: 0, remove: 1 }
  return c.sort((a, b) => rank[a.action] - rank[b.action] || a.date.localeCompare(b.date) || (a.start ?? '99').localeCompare(b.start ?? '99'))
}

/** Applies the selected changes to exam plans and planner events (pure: returns what to write). */
export function applyProposal(p: PlanProposal, selected: Set<string>, exams: Exam[]): { examPlans: Map<string, PlanSession[]>; putEvents: CalendarEvent[]; deleteEventIds: string[] } {
  const examPlans = new Map<string, PlanSession[]>()
  const putEvents: CalendarEvent[] = []
  const deleteEventIds: string[] = []
  const planOf = (id: string) => {
    if (!examPlans.has(id)) examPlans.set(id, [...(exams.find((x) => x.id === id)?.plan ?? [])])
    return examPlans.get(id)!
  }
  for (const c of p.changes) {
    if (c.action === 'keep' || !selected.has(c.id)) continue
    const t = c.target
    if (t.type === 'plan') {
      const plan = planOf(t.examId)
      const idx = plan.findIndex((s) => s.id === t.session.id)
      if (c.action === 'remove') {
        if (idx >= 0) plan.splice(idx, 1)
      } else if (idx >= 0) plan[idx] = { ...t.session }
      else plan.push({ ...t.session })
    } else if (c.action === 'remove') deleteEventIds.push(t.event.id)
    else putEvents.push({ ...t.event, updatedAt: new Date().toISOString() })
  }
  for (const [id, plan] of examPlans) examPlans.set(id, plan.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '99').localeCompare(b.start ?? '99')))
  return { examPlans, putEvents, deleteEventIds }
}
