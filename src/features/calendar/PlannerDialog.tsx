import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarCheck2, Minus, MoveRight, Plus, Settings2, Sparkles } from 'lucide-react'
import { db } from '@/db/index'
import type { DayKey, PlannerSettings } from '@/db/types'
import { commitProposal, getPlannerSettings, savePlannerSettings } from '@/db/calendar'
import { ValidationError } from '@/db/repo'
import { Badge, Button, cn, Dialog, Field, Input, Notice, Switch, useToast } from '@/components/ui'
import { dayKey, parseDay, WEEKDAYS_LONG } from '@/lib/dates'
import { computeTopicStats } from '@/lib/mastery'
import { selectDueCards } from '@/lib/srs'
import { proposeFullPlan, proposeTodayPlan, type PlanChange, type PlannerData, type PlanProposal } from '@/lib/calendar/planner'
import { nowMinutes } from '@/lib/calendar/time'
import { subjectColorVar } from '@/lib/colors'
import { undoLast } from '@/lib/undo'

export type PlannerMode = 'create' | 'recalc' | 'today'

async function loadPlannerData(settings: PlannerSettings): Promise<PlannerData> {
  const now = new Date()
  const today = dayKey(now)
  const [events, exams, tasks, topics, answers, cards, reviews, profile] = await Promise.all([
    db.events.toArray(), db.exams.toArray(), db.tasks.toArray(), db.topics.toArray(), db.answers.toArray(), db.cards.toArray(), db.cardReviews.toArray(), db.profile.get('me'),
  ])
  const cardsDueByDay = new Map<DayKey, number>()
  const due = selectDueCards(cards, reviews, now)
  cardsDueByDay.set(today, due.reviews.length + due.fresh.length)
  for (const c of cards) {
    if (c.srs.state === 'new') continue
    const d = dayKey(c.srs.due)
    if (d > today) cardsDueByDay.set(d, (cardsDueByDay.get(d) ?? 0) + 1)
  }
  const cache = new Map<string, { mastery: number; level: ReturnType<typeof computeTopicStats>['level'] }>()
  return {
    today, nowMin: nowMinutes(now), settings, restDays: profile?.restDays ?? [], events, exams, tasks, topics, cardsDueByDay,
    topicState: (id) => {
      if (!cache.has(id)) {
        const s = computeTopicStats(id, answers, now)
        cache.set(id, { mastery: s.mastery, level: s.level })
      }
      return cache.get(id)!
    },
  }
}

const ACTION_META: Record<PlanChange['action'], { label: string; icon: typeof Plus; tone: 'success' | 'accent' | 'danger' | 'neutral' }> = {
  add: { label: 'Neu', icon: Plus, tone: 'success' },
  move: { label: 'Verschoben', icon: MoveRight, tone: 'accent' },
  remove: { label: 'Entfällt', icon: Minus, tone: 'danger' },
  keep: { label: 'Unverändert', icon: ArrowRight, tone: 'neutral' },
}

export function PlannerDialog({ mode, onClose, subjects }: { mode: PlannerMode | null; onClose: () => void; subjects: { id: string; name: string; color: number }[] }) {
  const toast = useToast()
  const [step, setStep] = useState<'settings' | 'review'>('settings')
  const [settings, setSettings] = useState<PlannerSettings | null>(null)
  const [proposal, setProposal] = useState<PlanProposal | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKeep, setShowKeep] = useState(false)

  const compute = async (s: PlannerSettings, m: PlannerMode) => {
    setBusy(true)
    setError(null)
    try {
      const data = await loadPlannerData(s)
      const p = m === 'today' ? proposeTodayPlan(data) : proposeFullPlan(data)
      setProposal(p)
      setSelected(new Set(p.changes.filter((c) => c.action !== 'keep').map((c) => c.id)))
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!mode) return
    setProposal(null)
    setShowKeep(false)
    getPlannerSettings().then((s) => {
      setSettings(s)
      if (mode === 'create') setStep('settings')
      else compute(s, mode)
    })
  }, [mode])

  const changes = useMemo(() => proposal?.changes ?? [], [proposal])
  const actionable = changes.filter((c) => c.action !== 'keep')
  const byDay = useMemo(() => {
    const m = new Map<DayKey, PlanChange[]>()
    for (const c of changes) if (c.action !== 'keep' || showKeep) m.set(c.date, [...(m.get(c.date) ?? []), c])
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [changes, showKeep])
  const subjectOf = (id: string | null) => subjects.find((s) => s.id === id)

  const apply = async () => {
    if (!proposal) return
    setBusy(true)
    try {
      const r = await commitProposal(proposal, selected)
      toast({ title: 'Lernplan übernommen', description: `${selected.size} Änderung${selected.size === 1 ? '' : 'en'} gespeichert${r.exams ? `, ${r.exams} Prüfungsplan${r.exams === 1 ? '' : 'e'} aktualisiert` : ''}.`, tone: 'success', action: { label: 'Rückgängig', onClick: () => undoLast() } })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const saveSettingsAndCompute = async () => {
    if (!settings) return
    try {
      await savePlannerSettings(settings)
      await compute(settings, mode === 'today' ? 'today' : 'create')
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }

  const title = mode === 'today' ? 'Plan für heute optimieren' : mode === 'recalc' ? 'Plan neu berechnen' : 'Lernplan automatisch erstellen'
  return (
    <Dialog
      open={!!mode}
      onClose={onClose}
      size="xl"
      title={title}
      description={step === 'settings' ? 'Wann kannst du lernen? Der Planer nutzt nur diese Zeiten und lässt Unterricht und Termine frei.' : 'Vorschlag prüfen – erst mit „Übernehmen“ wird etwas gespeichert. Eigene Einträge bleiben immer unverändert.'}
      footer={step === 'settings' ? (
        <><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" icon={Sparkles} onClick={saveSettingsAndCompute} loading={busy}>Vorschlag berechnen</Button></>
      ) : (
        <>
          {mode !== 'today' && <Button icon={Settings2} onClick={() => setStep('settings')} className="mr-auto">Lernzeiten anpassen</Button>}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" icon={CalendarCheck2} onClick={apply} loading={busy} disabled={selected.size === 0}>Übernehmen ({selected.size})</Button>
        </>
      )}
    >
      {error && <Notice tone="danger" className="mb-3">{error}</Notice>}
      {step === 'settings' && settings && <SettingsForm value={settings} onChange={setSettings} />}
      {step === 'review' && !proposal && <div className="h-40 animate-pulse rounded-lg bg-surface-2" />}
      {step === 'review' && proposal && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(['add', 'move', 'remove', 'keep'] as const).map((a) => {
              const n = changes.filter((c) => c.action === a).length
              const M = ACTION_META[a]
              return <Badge key={a} tone={n ? M.tone : 'neutral'}>{M.label}: {n}</Badge>
            })}
            {proposal.untimedCount > 0 && <Badge>{proposal.untimedCount} spätere Einheiten noch ohne Uhrzeit</Badge>}
          </div>
          {proposal.warnings.map((w, i) => <Notice key={i} tone="warn" icon={AlertTriangle}>{w}</Notice>)}
          {actionable.length === 0 ? (
            <Notice tone="success" title="Nichts zu ändern">Dein Plan ist aktuell. {changes.length > 0 && 'Alle geplanten Einheiten bleiben, wo sie sind.'}</Notice>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">{selected.size} von {actionable.length} Änderungen ausgewählt</span>
              <span className="flex gap-3">
                <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setSelected(new Set(actionable.map((c) => c.id)))}>Alle</button>
                <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setSelected(new Set())}>Keine</button>
                {changes.some((c) => c.action === 'keep') && <button type="button" className="cursor-pointer text-accent hover:underline" onClick={() => setShowKeep((v) => !v)}>{showKeep ? 'Unveränderte ausblenden' : 'Unveränderte zeigen'}</button>}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {byDay.map(([day, list]) => (
              <section key={day}>
                <h4 className="mb-1 text-sm font-semibold">{parseDay(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
                <ul className="stagger flex flex-col gap-1">
                  {list.map((c) => {
                    const M = ACTION_META[c.action]
                    const s = subjectOf(c.subjectId)
                    const on = selected.has(c.id)
                    return (
                      <li key={c.id}>
                        <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2', c.action === 'keep' ? 'cursor-default border-transparent opacity-60' : on ? 'border-border-strong bg-surface-2' : 'border-border')}>
                          {c.action !== 'keep' ? (
                            <input type="checkbox" checked={on} onChange={() => setSelected((x) => { const n = new Set(x); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} className="size-4 accent-[var(--accent-solid)]" aria-label={`${M.label}: ${c.title}`} />
                          ) : <span className="size-4" />}
                          <span className="w-24 shrink-0 text-xs tabular text-fg-muted">{c.start ? `${c.start}–${c.end ?? ''}` : 'ohne Uhrzeit'}</span>
                          <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: s ? subjectColorVar(s.color) : c.kind === 'flashcards' ? 'var(--s5)' : 'var(--accent)' }} />
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-sm font-medium', c.action === 'remove' && 'line-through')}>{c.title}</span>
                            <span className="block truncate text-xs text-fg-muted">{c.reason}{c.action === 'move' && c.from ? ` · vorher ${parseDay(c.from.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}${c.from.start ? ` ${c.from.start}` : ''}` : ''}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular text-fg-subtle">{c.minutes} Min.</span>
                          <Badge tone={M.tone}>{M.label}</Badge>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          <p className="text-xs text-fg-subtle">So plant Study OS: Prüfungen und Fristen, die zuerst kommen, haben Vorrang. Themen mit wenig Beherrschung bekommen mehr Zeit. Fällige Karteikarten werden eingeplant. Unterricht, Termine und Pausen bleiben frei, zwischen Einheiten liegt eine Pause. Alles läuft lokal ohne KI.</p>
        </div>
      )}
    </Dialog>
  )
}

export function SettingsForm({ value, onChange }: { value: PlannerSettings; onChange: (s: PlannerSettings) => void }) {
  const setWindow = (kind: 'windows' | 'school', d: number, w: { from: string; to: string } | null) => onChange({ ...value, [kind]: value[kind].map((x, i) => (i === d ? w : x)) })
  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-subtle">
              <th className="py-1 font-medium">Tag</th>
              <th className="py-1 font-medium">Lernen möglich</th>
              <th className="py-1 font-medium">Schulzeit (nur Anzeige)</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const w = value.windows[d]
              const s = value.school[d]
              return (
                <tr key={d} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{WEEKDAYS_LONG[d]}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Switch label={`Lernen am ${WEEKDAYS_LONG[d]}`} checked={!!w} onChange={(v) => setWindow('windows', d, v ? { from: '15:30', to: '19:00' } : null)} />
                      {w && <><Input type="time" aria-label={`Lernen ab, ${WEEKDAYS_LONG[d]}`} value={w.from} onChange={(e) => setWindow('windows', d, { ...w, from: e.target.value })} className="h-8 w-28" /><span className="text-fg-subtle">–</span><Input type="time" aria-label={`Lernen bis, ${WEEKDAYS_LONG[d]}`} value={w.to} onChange={(e) => setWindow('windows', d, { ...w, to: e.target.value })} className="h-8 w-28" /></>}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Switch label={`Schule am ${WEEKDAYS_LONG[d]}`} checked={!!s} onChange={(v) => setWindow('school', d, v ? { from: '07:45', to: '14:30' } : null)} />
                      {s && <><Input type="time" aria-label={`Schule ab, ${WEEKDAYS_LONG[d]}`} value={s.from} onChange={(e) => setWindow('school', d, { ...s, from: e.target.value })} className="h-8 w-28" /><span className="text-fg-subtle">–</span><Input type="time" aria-label={`Schule bis, ${WEEKDAYS_LONG[d]}`} value={s.to} onChange={(e) => setWindow('school', d, { ...s, to: e.target.value })} className="h-8 w-28" /></>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Höchstens lernen pro Tag (Min.)" htmlFor="pl-max"><Input id="pl-max" type="number" min={10} max={600} step={5} value={value.maxDailyMinutes} onChange={(e) => onChange({ ...value, maxDailyMinutes: Number(e.target.value) })} /></Field>
        <Field label="Längste Einheit am Stück (Min.)" htmlFor="pl-sess"><Input id="pl-sess" type="number" min={10} max={180} step={5} value={value.sessionMaxMinutes} onChange={(e) => onChange({ ...value, sessionMaxMinutes: Number(e.target.value) })} /></Field>
        <Field label="Pause zwischen Einheiten (Min.)" htmlFor="pl-break"><Input id="pl-break" type="number" min={0} max={60} step={5} value={value.breakMinutes} onChange={(e) => onChange({ ...value, breakMinutes: Number(e.target.value) })} /></Field>
        <Field label="Puffer um Termine (Min.)" htmlFor="pl-buffer" hint="Zeit für Heimweg, Essen …"><Input id="pl-buffer" type="number" min={0} max={120} step={5} value={value.bufferMinutes} onChange={(e) => onChange({ ...value, bufferMinutes: Number(e.target.value) })} /></Field>
        <Field label="Planungszeitraum (Tage)" htmlFor="pl-horizon"><Input id="pl-horizon" type="number" min={1} max={42} value={value.horizonDays} onChange={(e) => onChange({ ...value, horizonDays: Number(e.target.value) })} /></Field>
        <div className="flex items-end pb-2"><Switch label="Karteikarten-Wiederholung einplanen" checked={value.includeFlashcards} onChange={(v) => onChange({ ...value, includeFlashcards: v })} /></div>
      </div>
      <p className="text-xs text-fg-subtle">Feste Ruhetage (Einstellungen → Lernen) plant Study OS nie ein. Ganztägige Einträge mit „An diesen Tagen nicht lernen“ ebenfalls.</p>
    </div>
  )
}
