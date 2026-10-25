import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight, BookOpen, CalendarClock, CalendarPlus, ClipboardCheck, Flame, Layers, ListChecks, RotateCcw, Sparkles, Target, Timer, TrendingUp,
} from 'lucide-react'
import { db } from '@/db/index'
import { useDueCards, useExams, useOpenMistakes, useProfile, useSubjects, useTopicStats, useTopics } from '@/hooks/data'
import { buildTodayTasks, recommendTopics } from '@/lib/recommend'
import { summarizeProgress } from '@/lib/progress'
import { addDays, dayKey, diffDays, formatDayLong, formatMinutes, relativeDay } from '@/lib/dates'
import { averageMastery, LEVEL_LABELS, type TopicStats } from '@/lib/mastery'
import { Badge, ButtonLink, Card, cn, EmptyState, LoadingBlock, ProgressBar, Ring, SectionHeader, StatTile, SubjectDot } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { DayStrip } from '@/features/calendar/DayStrip'
import { TodaySchool } from '@/features/timetable/TodaySchool'

function greeting() {
  const h = new Date().getHours()
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend'
}

export function Dashboard() {
  const profile = useProfile()
  const subjects = useSubjects()
  const topics = useTopics()
  const { stats, answers, ready } = useTopicStats()
  const mistakes = useOpenMistakes()
  const due = useDueCards()
  const exams = useExams()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const questionCount = useLiveQuery(() => db.questions.count(), []) ?? 0
  const xp = useLiveQuery(() => db.xpEvents.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const attempts = useLiveQuery(() => db.attempts.toArray(), [])
  const cardReviews = useLiveQuery(() => db.cardReviews.toArray(), [])
  const upcomingCards = useLiveQuery(async () => {
    const end = new Date()
    end.setDate(end.getDate() + 7)
    return db.cards.where('srs.due').below(end.toISOString()).count()
  }, [])
  const today = dayKey()

  const recs = useMemo(() => (ready && topics && subjects && mistakes && exams ? recommendTopics({ topics, subjects, stats, mistakes, exams, today }) : []), [ready, topics, subjects, stats, mistakes, exams, today])
  const upcoming = useMemo(() => (exams ?? []).filter((e) => diffDays(today, e.date) >= 0).slice(0, 4), [exams, today])
  const planToday = useMemo(
    () => upcoming.flatMap((e) => e.plan.filter((p) => p.date <= today && !p.done).map((p) => ({ examTitle: e.title, examId: e.id, sessionId: p.id, title: p.title, minutes: p.minutes }))).slice(0, 3),
    [upcoming, today],
  )
  const tasks = useMemo(() => {
    if (!profile || !due || !mistakes || !decks) return []
    return buildTodayTasks({
      dailyGoalMinutes: profile.dailyGoalMinutes,
      planSessionsToday: planToday,
      openMistakeCount: mistakes.length,
      dueCards: [...due.byDeck.entries()].map(([deckId, c]) => ({ deckId, deckName: decks.find((d) => d.id === deckId)?.name ?? 'Stapel', count: c.reviews, fresh: c.fresh })),
      recommendations: recs,
      topicName: (id) => topics?.find((t) => t.id === id)?.name ?? 'Thema',
    })
  }, [profile, due, mistakes, decks, planToday, recs, topics])
  const summary = useMemo(
    () => (profile && xp && sessions && attempts && cardReviews ? summarizeProgress({ xpEvents: xp, sessions, attempts, answers, cardReviews, stats: [...stats.values()], restDays: profile.restDays, pausedUntil: profile.pausedUntil, weeklyGoalDays: profile.weeklyGoalDays, today }) : null),
    [profile, xp, sessions, attempts, cardReviews, answers, stats, today],
  )

  if (!subjects || !topics || !ready || !summary || !mistakes || !due || !exams) return <LoadingBlock />
  const hasHistory = answers.length > 0 || cardReviews!.length > 0
  const taskMinutes = tasks.reduce((s, t) => s + t.minutes, 0)
  const nextExam = upcoming[0]

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-1.5">{formatDayLong(today)}</div>
          <h1 className="text-2xl font-semibold">
            {greeting()}
            {profile?.name ? `, ${profile.name.replace(/\s*\(Demo\)$/, '')}` : ''}
          </h1>
        </div>
        {/* Quiz shortcuts only make sense once there are questions to ask. */}
        {questionCount > 0 && <div className="flex flex-wrap gap-2">
          <ButtonLink to="/quiz/neu?preset=quick" variant="primary" icon={Timer}>
            5-Minuten-Runde
          </ButtonLink>
          <ButtonLink to={nextExam && nextExam.topicIds.length ? `/quiz/neu?preset=mock&exam=${nextExam.id}` : '/quiz/neu?mode=exam'} icon={ClipboardCheck}>
            Prüfung simulieren
          </ButtonLink>
        </div>}
      </header>

      <DayStrip />

      {/* renders only once the timetable has lessons */}
      <TodaySchool compact />

      {/* Was soll ich heute lernen? */}
      <section aria-labelledby="today">
        <SectionHeader
          id="today"
          title="Was soll ich heute lernen?"
          description={tasks.length ? `Vorschlag für etwa ${formatMinutes(taskMinutes)} – dein Tagesziel sind ${profile?.dailyGoalMinutes ?? 20} Min. Begründung steht bei jeder Aufgabe.` : undefined}
        />
        {!hasHistory ? (
          <StartHere hasSubjects={subjects.length > 0} hasTopics={(topics?.length ?? 0) > 0} hasQuestions={questionCount > 0} />
        ) : tasks.length === 0 ? (
          hasHistory ? (
            <EmptyState icon={Sparkles} title="Für heute ist nichts fällig" description="Keine offenen Fehler, keine fälligen Karten, keine dringenden Themen. Du kannst dir eine Pause gönnen oder ein neues Thema anfangen." action={<ButtonLink to="/faecher">Thema auswählen</ButtonLink>} />
          ) : (
            <StartHere hasSubjects={subjects.length > 0} hasTopics={(topics?.length ?? 0) > 0} hasQuestions={questionCount > 0} />
          )
        ) : (
          <ol className="flex flex-col gap-2">
            {tasks.map((t, i) => (
              <li key={t.key}>
                <Link to={t.href} className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs font-semibold text-fg-muted tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium group-hover:text-accent">{t.title}</span>
                    <span className="block truncate text-sm text-fg-muted">{t.detail}</span>
                  </span>
                  <span className="hidden shrink-0 text-sm text-fg-subtle tabular sm:block">≈ {t.minutes} Min.</span>
                  <ArrowRight className="size-4 shrink-0 text-fg-subtle group-hover:text-accent" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Key figures */}
      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Flame} label="Lernserie" value={`${summary.streak} ${summary.streak === 1 ? 'Tag' : 'Tage'}`} sub={profile?.restDays.length ? 'Ruhetage zählen nicht dagegen' : `Rekord: ${summary.longestStreak}`} />
        <StatTile icon={CalendarClock} label="Diese Woche" value={formatMinutes(summary.weekMinutes)} sub={`${summary.weekActiveDays} von ${summary.weeklyGoalDays} Lerntagen`} />
        <StatTile icon={TrendingUp} label="Lern-XP" value={summary.totalXp.toLocaleString('de-DE')} sub={`heute +${summary.xpToday}`} />
        <StatTile icon={RotateCcw} label="Offene Fehler" value={mistakes.length} sub={mistakes.length ? 'werden wiederholt, bis sie sitzen' : 'alles nachgearbeitet'} />
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="flex flex-col gap-8 lg:col-span-3">
          <SubjectsAttention subjects={subjects} topics={topics} stats={stats} />
          <MasteryOverview topics={topics} stats={stats} hasHistory={answers.length > 0} />
        </div>
        <div className="flex flex-col gap-8 lg:col-span-2">
          <section aria-labelledby="exams">
            <SectionHeader id="exams" title="Anstehende Prüfungen" action={<ButtonLink to="/pruefungen?neu=1" size="sm" variant="ghost" icon={CalendarPlus}>Eintragen</ButtonLink>} />
            {upcoming.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title="Keine Prüfung eingetragen" description="Trag deine nächste Klassenarbeit ein – du bekommst einen Lernplan bis zum Termin." />
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map((e) => {
                  const done = e.plan.filter((p) => p.done).length
                  const subject = subjects.find((s) => s.id === e.subjectId)
                  const d = diffDays(today, e.date)
                  return (
                    <Link key={e.id} to={`/pruefungen/${e.id}`} className="group rounded-lg border border-border bg-surface px-4 py-3 hover:border-border-strong">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-fg-subtle">
                            {subject && <SubjectDot color={subject.color} />}
                            {subject?.name} · {e.type}
                          </div>
                          <div className="mt-0.5 truncate font-medium group-hover:text-accent">{e.title}</div>
                        </div>
                        <Badge tone={d <= 3 ? 'warn' : 'neutral'}>{relativeDay(e.date, today)}</Badge>
                      </div>
                      {e.plan.length > 0 && <ProgressBar className="mt-2.5" value={done / e.plan.length} label="Lernplan erledigt" showValue />}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="reviews">
            <SectionHeader id="reviews" title="Wiederholungen" />
            <Card className="divide-y divide-border">
              <Link to="/karteikarten/lernen" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <Layers className="size-4 text-fg-muted" aria-hidden />
                <span className="flex-1 text-sm">Karteikarten heute fällig</span>
                <span className="font-semibold tabular">{due.reviewCount}{due.newCount ? <span className="font-normal text-fg-subtle"> + {due.newCount} neu</span> : null}</span>
              </Link>
              <div className="flex items-center gap-3 px-4 py-3">
                <CalendarClock className="size-4 text-fg-muted" aria-hidden />
                <span className="flex-1 text-sm">Karten in den nächsten 7 Tagen</span>
                <span className="font-semibold tabular">{upcomingCards ?? '–'}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <BookOpen className="size-4 text-fg-muted" aria-hidden />
                <span className="flex-1 text-sm">Themen zur Wiederholung fällig</span>
                <span className="font-semibold tabular">{[...stats.values()].filter((s) => s.nextReview && s.nextReview <= today).length}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <BookOpen className="size-4 text-fg-muted" aria-hidden />
                <span className="flex-1 text-sm">Themen bis {formatDayLong(addDays(today, 7)).split(',')[1]?.trim()}</span>
                <span className="font-semibold tabular">{[...stats.values()].filter((s) => s.nextReview && s.nextReview > today && s.nextReview <= addDays(today, 7)).length}</span>
              </div>
            </Card>
          </section>

          <section aria-labelledby="mistakes">
            <SectionHeader id="mistakes" title="Zuletzt falsch beantwortet" action={mistakes.length > 0 && <ButtonLink to="/fehler" size="sm" variant="ghost">Alle</ButtonLink>} />
            <RecentMistakes ids={mistakes.slice(0, 4).map((m) => m.questionId)} />
          </section>
        </div>
      </div>
    </div>
  )
}

function StartHere({ hasSubjects, hasTopics, hasQuestions }: { hasSubjects: boolean; hasTopics: boolean; hasQuestions: boolean }) {
  const first = !hasSubjects
    ? { icon: BookOpen, title: 'Ein Fach anlegen', text: 'Lege das Fach an, für das du gerade lernst.', to: '/faecher' }
    : !hasTopics
      ? { icon: BookOpen, title: 'Themen eintragen', text: 'Deine Fächer sind noch leer. Trage die Themen aus deinem Unterricht ein.', to: '/faecher' }
      : { icon: BookOpen, title: 'Fächer und Themen prüfen', text: 'Ergänze Themen, Notizen und Material aus deinem Unterricht.', to: '/faecher' }
  const second = hasQuestions
    ? { icon: Timer, title: '5-Minuten-Runde machen', text: 'Ein paar Fragen zeigen, wo du stehst. Danach werden die Empfehlungen persönlich.', to: '/quiz/neu?preset=quick' }
    : { icon: Layers, title: 'Karteikarten oder Aufgaben erstellen', text: 'Schreib eigene Karten oder Fragen zu einem Thema – oder lass sie aus deinem Material erzeugen.', to: '/karteikarten' }
  const steps = [first, second, { icon: CalendarPlus, title: 'Nächste Prüfung eintragen', text: 'Study OS plant deine Lerneinheiten bis zum Termin.', to: '/pruefungen?neu=1' }]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((s, i) => (
        <Link key={s.title} to={s.to} className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 hover:border-border-strong">
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            <span className="tabular">Schritt {i + 1}</span>
          </div>
          <s.icon className="size-5 text-accent" aria-hidden />
          <div className="font-medium group-hover:text-accent">{s.title}</div>
          <p className="text-sm text-fg-muted">{s.text}</p>
        </Link>
      ))}
      <p className="text-sm text-fg-subtle sm:col-span-3">Noch keine Lerndaten – deshalb gibt es hier noch keine Statistik. Sobald du übst, erscheinen Empfehlungen, die auf deinen Antworten beruhen.</p>
    </div>
  )
}

function SubjectsAttention({ subjects, topics, stats }: { subjects: { id: string; name: string; color: number }[]; topics: { id: string; subjectId: string }[]; stats: Map<string, TopicStats> }) {
  const rows = subjects
    .map((s) => {
      const st = topics.filter((t) => t.subjectId === s.id).map((t) => stats.get(t.id)!).filter(Boolean)
      const practiced = st.filter((x) => x.answers > 0)
      const struggling = st.filter((x) => x.level === 'struggling').length
      const recentWrong = st.reduce((a, b) => a + b.recentWrong, 0)
      return { s, avg: averageMastery(practiced), practiced: practiced.length, total: st.length, struggling, recentWrong }
    })
    .filter((r) => r.practiced > 0)
    .sort((a, b) => b.struggling - a.struggling || b.recentWrong - a.recentWrong || a.avg - b.avg)
  return (
    <section aria-labelledby="attention">
      <SectionHeader id="attention" title="Fächer, die Aufmerksamkeit brauchen" description="Sortiert nach häufigen Fehlern und niedrigem Stand." />
      {rows.length === 0 ? (
        <EmptyState compact icon={Target} title="Noch keine Einschätzung möglich" description="Sobald du in einem Fach Fragen beantwortet hast, siehst du hier, wo es hakt." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.slice(0, 4).map((r) => (
            <Link key={r.s.id} to={`/faecher/${r.s.id}`} className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-strong">
              <Ring value={r.avg} size={46} stroke={4} label={`Stand ${r.s.name}`} tone={r.struggling ? 'warn' : 'accent'} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium group-hover:text-accent">
                  <SubjectDot color={r.s.color} />
                  <span className="truncate">{r.s.name}</span>
                </div>
                <div className="text-xs text-fg-muted">
                  {r.struggling > 0 ? `${r.struggling} ${r.struggling === 1 ? 'Thema' : 'Themen'} häufig falsch` : r.recentWrong > 0 ? `${r.recentWrong} Fehler in 14 Tagen` : 'läuft gut'} · {r.practiced}/{r.total} Themen geübt
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function MasteryOverview({ topics, stats, hasHistory }: { topics: { id: string; name: string; subjectId: string }[]; stats: Map<string, TopicStats>; hasHistory: boolean }) {
  const practiced = topics.map((t) => ({ t, s: stats.get(t.id)! })).filter((x) => x.s && x.s.answers > 0)
  const groups = ([
    { key: 'struggling', label: LEVEL_LABELS.struggling, tone: 'warn', items: practiced.filter((x) => x.s.level === 'struggling') },
    { key: 'practicing', label: LEVEL_LABELS.practicing, tone: 'accent', items: practiced.filter((x) => x.s.level === 'practicing') },
    { key: 'challenge', label: 'Bereit für schwierigere Aufgaben', tone: 'success', items: practiced.filter((x) => x.s.challengeReady) },
    { key: 'mastered', label: LEVEL_LABELS.mastered, tone: 'success', items: practiced.filter((x) => x.s.level === 'mastered') },
  ] as { key: string; label: string; tone: 'warn' | 'accent' | 'success'; items: typeof practiced }[]).filter((g) => g.items.length > 0)
  return (
    <section aria-labelledby="mastery">
      <SectionHeader id="mastery" title="Stand je Thema" description="Beherrschung aus deinen Antworten – neuere zählen mehr. Eine richtige Antwort allein reicht nie für „gefestigt“." action={<ButtonLink to="/fortschritt" size="sm" variant="ghost">Details</ButtonLink>} />
      {!hasHistory ? (
        <EmptyState compact icon={ListChecks} title="Noch keine Antworten" description="Beantworte ein paar Fragen, dann wird hier dein Stand pro Thema sichtbar." />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <Badge tone={g.tone}>{g.label}</Badge>
                <span className="text-xs text-fg-subtle">{g.items.length}</span>
              </div>
              <Card className="divide-y divide-border">
                {g.items.slice(0, 5).map(({ t, s }) => (
                  <Link key={t.id} to={`/faecher/${t.subjectId}/themen/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                    <ProgressBar className="w-32 shrink-0 sm:w-40" value={s.mastery} label={`Beherrschung ${t.name}`} tone={g.tone === 'warn' ? 'warn' : g.tone === 'success' ? 'success' : 'accent'} showValue />
                  </Link>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function RecentMistakes({ ids }: { ids: string[] }) {
  const qs = useLiveQuery(() => db.questions.bulkGet(ids), [ids.join(',')])
  if (ids.length === 0) return <EmptyState compact icon={RotateCcw} title="Keine offenen Fehler" description="Falsch beantwortete Fragen erscheinen hier, bis du sie zweimal richtig beantwortet hast." />
  return (
    <Card className="divide-y divide-border">
      {(qs ?? []).filter(Boolean).map((q) => (
        <Link key={q!.id} to="/fehler" className={cn('block px-4 py-2.5 text-sm hover:bg-surface-2')}>
          <span className="line-clamp-2 text-fg-muted">
            <Markdown inline>{q!.prompt.replace(/\n+/g, ' ')}</Markdown>
          </span>
        </Link>
      ))}
    </Card>
  )
}
