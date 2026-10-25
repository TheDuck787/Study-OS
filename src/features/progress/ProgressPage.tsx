import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Award, CalendarDays, Flame, Info, Lock, Medal, Target, TrendingUp } from 'lucide-react'
import { db } from '@/db/index'
import { ACHIEVEMENTS, ACTIVE_DAY_XP, XP_EXPLANATION, summarizeProgress, xpByDay } from '@/lib/progress'
import { LEVEL_LABELS, HALF_LIFE_DAYS, PRIOR } from '@/lib/mastery'
import { addDays, dayKey, formatDate, formatDayShort, formatMinutes, startOfWeek, WEEKDAYS_SHORT, parseDay } from '@/lib/dates'
import { Badge, Card, cn, LoadingBlock, PageHeader, ProgressBar, SectionHeader, StatTile, SubjectDot } from '@/components/ui'
import { useProfile, useSubjects, useTopicStats, useTopics } from '@/hooks/data'
import { TeacherGrades } from '@/features/exams/ExamsPage'

export default function ProgressPage() {
  const profile = useProfile()
  const subjects = useSubjects()
  const topics = useTopics()
  const { stats, answers, ready } = useTopicStats()
  const xp = useLiveQuery(() => db.xpEvents.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const attempts = useLiveQuery(() => db.attempts.toArray(), [])
  const cardReviews = useLiveQuery(() => db.cardReviews.toArray(), [])
  const unlocked = useLiveQuery(() => db.achievements.toArray(), [])
  const today = dayKey()

  const summary = useMemo(
    () => (profile && xp && sessions && attempts && cardReviews && ready ? summarizeProgress({ xpEvents: xp, sessions, attempts, answers, cardReviews, stats: [...stats.values()], restDays: profile.restDays, pausedUntil: profile.pausedUntil, weeklyGoalDays: profile.weeklyGoalDays, today }) : null),
    [profile, xp, sessions, attempts, cardReviews, answers, stats, ready, today],
  )
  const calendar = useMemo(() => {
    if (!xp || !sessions) return null
    const xpDay = xpByDay(xp)
    const minDay = new Map<string, number>()
    for (const s of sessions) minDay.set(s.day, (minDay.get(s.day) ?? 0) + s.durationSec / 60)
    const weeks = 18
    const start = addDays(startOfWeek(today), -7 * (weeks - 1))
    const cols: { day: string; xp: number; min: number }[][] = []
    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d)
        col.push({ day, xp: xpDay.get(day) ?? 0, min: minDay.get(day) ?? 0 })
      }
      cols.push(col)
    }
    return cols
  }, [xp, sessions, today])
  const minutesBySubject = useMemo(() => {
    if (!sessions || !subjects) return []
    const since = addDays(today, -30)
    const m = new Map<string, number>()
    for (const s of sessions) if (s.day >= since) m.set(s.subjectId ?? 'none', (m.get(s.subjectId ?? 'none') ?? 0) + s.durationSec / 60)
    return [...m.entries()].map(([id, min]) => ({ id, name: subjects.find((s) => s.id === id)?.name ?? 'Gemischt / ohne Fach', color: subjects.find((s) => s.id === id)?.color ?? 7, min })).sort((a, b) => b.min - a.min)
  }, [sessions, subjects, today])

  if (!summary || !calendar || !subjects || !topics || !unlocked || !profile) return <LoadingBlock />
  const weekStart = startOfWeek(today)
  const xpDay = xpByDay(xp!)
  const maxMin = Math.max(1, ...minutesBySubject.map((x) => x.min))

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Fortschritt" title="Dein Fortschritt" description="Alles hier wird aus deinen gespeicherten Antworten, Wiederholungen und Lerneinheiten berechnet. Es gibt keine geschätzten oder erfundenen Werte." />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Überblick">
        <StatTile icon={Flame} label="Aktuelle Lernserie" value={`${summary.streak} ${summary.streak === 1 ? 'Tag' : 'Tage'}`} sub={`Längste: ${summary.longestStreak}`} />
        <StatTile icon={Target} label="Wochenziel" value={`${summary.weekActiveDays}/${summary.weeklyGoalDays}`} sub="Lerntage diese Woche" />
        <StatTile icon={TrendingUp} label="Lern-XP gesamt" value={summary.totalXp.toLocaleString('de-DE')} sub={`heute +${summary.xpToday}`} />
        <StatTile icon={Medal} label="Gefestigte Themen" value={summary.levelCounts.mastered} sub={`${summary.levelCounts.solid} gut verstanden`} />
      </section>

      <section aria-labelledby="week">
        <SectionHeader id="week" title="Diese Woche" description={`Ein Lerntag zählt ab ${ACTIVE_DAY_XP} XP – also nach echtem Üben, nicht nach Zeit auf der Seite. Ruhetage (${profile.restDays.map((d) => WEEKDAYS_SHORT[d]).join(', ') || 'keine'}) unterbrechen die Serie nie.`} />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
            const v = xpDay.get(d) ?? 0
            const active = v >= ACTIVE_DAY_XP
            const rest = profile.restDays.includes(parseDay(d).getDay())
            return (
              <div key={d} className={cn('pop-in flex w-16 flex-col items-center gap-1 rounded-lg border py-2 transition-transform duration-[var(--dur-2)] hover:-translate-y-0.5', active ? 'border-success/50 bg-success-soft' : d === today ? 'border-accent/50' : 'border-border')} style={{ animationDelay: `${i * 45}ms` }}>
                <span className="text-xs text-fg-subtle">{WEEKDAYS_SHORT[parseDay(d).getDay()]}</span>
                <span className="text-sm font-semibold tabular">{v > 0 ? v : rest ? 'Ruhe' : '–'}</span>
              </div>
            )
          })}
          <div className="flex flex-col justify-center pl-2 text-sm text-fg-muted">
            <span>{formatMinutes(summary.weekMinutes)} gelernt</span>
            <span className="text-xs">{summary.weekActiveDays >= summary.weeklyGoalDays ? 'Wochenziel erreicht.' : `Noch ${summary.weeklyGoalDays - summary.weekActiveDays} Lerntag${summary.weeklyGoalDays - summary.weekActiveDays === 1 ? '' : 'e'} bis zum Ziel – wenn es passt.`}</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="calendar">
        <SectionHeader id="calendar" title="Lernkalender" description="Die letzten 18 Wochen. Dunkler = mehr Lern-XP an diesem Tag." />
        {/* columns appear left to right – one short animation per column, nothing runs afterwards */}
        <Card className="overflow-x-auto p-4">
          <div className="flex gap-1">
            <div className="mr-1 flex flex-col gap-1 pt-0 text-[10px] text-fg-subtle">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d} className="flex h-3.5 items-center">{d % 2 ? WEEKDAYS_SHORT[d] : ''}</span>)}
            </div>
            {calendar.map((col, i) => (
              <div key={i} className="cell-in flex flex-col gap-1" style={{ animationDelay: `${i * 18}ms` }}>
                {col.map((c) => {
                  const future = c.day > today
                  const level = c.xp === 0 ? 0 : c.xp < ACTIVE_DAY_XP ? 1 : c.xp < 20 ? 2 : c.xp < 45 ? 3 : 4
                  const bg = ['var(--surface-3)', 'color-mix(in srgb, var(--accent-solid) 30%, var(--surface-3))', 'color-mix(in srgb, var(--accent-solid) 55%, var(--surface-3))', 'color-mix(in srgb, var(--accent-solid) 78%, var(--surface-3))', 'var(--accent-solid)'][level]
                  return <span key={c.day} title={`${formatDayShort(c.day)}: ${c.xp} XP, ${Math.round(c.min)} Min.`} className={cn('size-3.5 rounded-[3px] transition-transform hover:scale-125', future && 'opacity-0')} style={{ background: bg }} />
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
            weniger
            {[0, 1, 2, 3, 4].map((l) => <span key={l} className="size-3 rounded-[3px]" style={{ background: ['var(--surface-3)', 'color-mix(in srgb, var(--accent-solid) 30%, var(--surface-3))', 'color-mix(in srgb, var(--accent-solid) 55%, var(--surface-3))', 'color-mix(in srgb, var(--accent-solid) 78%, var(--surface-3))', 'var(--accent-solid)'][l] }} />)}
            mehr
          </div>
        </Card>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="time">
          <SectionHeader id="time" title="Lernzeit nach Fach" description="Letzte 30 Tage, gemessen in Quiz-, Karten- und Mathe-Einheiten." />
          {minutesBySubject.length === 0 ? <p className="text-sm text-fg-muted">Noch keine Lerneinheiten.</p> : (
            <div className="flex flex-col gap-2.5">
              {minutesBySubject.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="flex w-36 shrink-0 items-center gap-2 truncate"><SubjectDot color={s.color} />{s.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full origin-left rounded-full [animation:grow-x_var(--dur-4)_var(--ease-out)_backwards]" style={{ width: `${(s.min / maxMin) * 100}%`, background: `var(--s${s.color % 10})` }} /></div>
                  <span className="w-28 shrink-0 text-right text-fg-muted tabular">{formatMinutes(s.min)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section aria-labelledby="bests">
          <SectionHeader id="bests" title="Persönliche Bestwerte" />
          <Card className="divide-y divide-border">
            {summary.personalBests.map((b) => (
              <div key={b.label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-fg-muted">{b.label}</span>
                <span className="font-semibold tabular">{b.value}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <section aria-labelledby="mastery">
        <SectionHeader id="mastery" title="Beherrschung je Thema" description="Für jedes Thema aus deinen Antworten berechnet." />
        <details className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium"><Info className="size-4" /> Wie wird das berechnet?</summary>
          <div className="mt-2 flex flex-col gap-1.5 text-fg-muted">
            <p>Jede Antwort zählt, neuere stärker: Das Gewicht halbiert sich alle {HALF_LIFE_DAYS} Tage. Zum Start zählen {PRIOR} „Platzhalter-Fehlversuche“ mit – deshalb ergibt eine einzige richtige Antwort nur etwa 33 %.</p>
            <p><strong className="text-fg">Gut verstanden:</strong> mindestens 60 %, 5 Antworten an 2 verschiedenen Tagen. <strong className="text-fg">Gefestigt:</strong> mindestens 75 %, 8 Antworten an 3 Tagen und die letzten 3 richtig. <strong className="text-fg">Häufig falsch:</strong> weniger als die Hälfte richtig (ab 3 Antworten).</p>
            <p>Wiederholung: Häufig falsch nach 1 Tag, braucht Übung nach 2, gut verstanden nach 5, gefestigt nach 14 bis 45 Tagen.</p>
          </div>
        </details>
        <div className="grid gap-4 lg:grid-cols-2">
          {subjects.map((s) => {
            const ts = topics.filter((t) => t.subjectId === s.id)
            const practiced = ts.filter((t) => (stats.get(t.id)?.answers ?? 0) > 0)
            if (ts.length === 0) return null
            return (
              <Card key={s.id} className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Link to={`/faecher/${s.id}`} className="flex items-center gap-2 font-semibold hover:text-accent"><SubjectDot color={s.color} />{s.name}</Link>
                  <span className="text-xs text-fg-subtle">{practiced.length}/{ts.length} geübt</span>
                </div>
                {practiced.length === 0 ? <p className="text-sm text-fg-muted">Noch keine Antworten in diesem Fach.</p> : (
                  <ul className="stagger flex flex-col gap-2">
                    {practiced.map((t) => {
                      const st = stats.get(t.id)!
                      return (
                        <li key={t.id}>
                          <Link to={`/faecher/${s.id}/themen/${t.id}`} className="block" title={st.explanation}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{t.name}</span>
                              <Badge tone={st.level === 'struggling' ? 'warn' : st.level === 'mastered' ? 'success' : st.level === 'solid' ? 'success' : 'neutral'}>{LEVEL_LABELS[st.level]}</Badge>
                            </div>
                            <ProgressBar className="mt-1" value={st.mastery} label={`Beherrschung ${t.name}`} tone={st.level === 'struggling' ? 'warn' : st.level === 'mastered' ? 'success' : 'accent'} showValue />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="badges">
        <SectionHeader id="badges" title="Abzeichen" description={`${unlocked.length} von ${ACHIEVEMENTS.length} – für echtes Lernen, nicht fürs Herumklicken.`} />
        <ul className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const u = unlocked.find((x) => x.id === a.key)
            return (
              <li key={a.key} className={cn('flex items-start gap-3 rounded-lg border p-3', u ? 'lift surface-raised border-border bg-surface' : 'border-dashed border-border')}>
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', u ? 'bg-[linear-gradient(135deg,var(--accent-soft),color-mix(in_oklab,var(--s3)_22%,transparent))] text-accent ring-1 ring-accent/25' : 'bg-surface-2 text-fg-subtle')}>{u ? <Award className="size-4" /> : <Lock className="size-4" />}</span>
                <span className="min-w-0">
                  <span className={cn('block text-sm font-semibold', !u && 'text-fg-muted')}>{a.title}</span>
                  <span className="block text-xs text-fg-subtle">{a.description}</span>
                  {u && <span className="block text-xs text-fg-subtle">seit {formatDate(u.unlockedAt)}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="xp">
        <SectionHeader id="xp" title="So gibt es XP" />
        <ul className="stagger grid gap-1.5 text-sm text-fg-muted sm:grid-cols-2">
          {XP_EXPLANATION.map((x) => <li key={x} className="flex gap-2"><CalendarDays className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />{x}</li>)}
        </ul>
      </section>

      <section aria-labelledby="grades">
        <SectionHeader id="grades" title="Echte Noten" />
        <TeacherGrades />
      </section>
    </div>
  )
}
