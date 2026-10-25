import type { DayKey, Exam, Subject, Topic } from '@/db/types'
import { diffDays, relativeDay } from './dates'
import type { OpenMistake } from './mistakes'
import type { TopicStats } from './mastery'

export type ActionKind = 'mistakes' | 'practice' | 'learn' | 'challenge' | 'review'

export interface TopicRecommendation {
  topicId: string
  subjectId: string
  score: number
  reasons: string[]
  action: ActionKind
  actionLabel: string
  estMinutes: number
}

/**
 * Priority score per topic. Each part is a plain number so the result can be explained:
 * 1) repeated mistakes  2) upcoming tests  3) overdue review  4) missing foundations  5) mastered topics get less.
 */
export function recommendTopics(input: {
  topics: Topic[]
  subjects: Subject[]
  stats: Map<string, TopicStats>
  mistakes: OpenMistake[]
  exams: Exam[]
  today: DayKey
}): TopicRecommendation[] {
  const { topics, stats, mistakes, exams, today, subjects } = input
  const subjectIds = new Set(subjects.map((s) => s.id))
  const upcoming = exams.filter((e) => diffDays(today, e.date) >= 0 && diffDays(today, e.date) <= 28)
  const mistakesByTopic = new Map<string, number>()
  for (const m of mistakes) mistakesByTopic.set(m.topicId, (mistakesByTopic.get(m.topicId) ?? 0) + 1)

  // Topics that are needed soon or are hard right now – their prerequisites become more important.
  const neededSoon = new Set<string>()
  for (const e of upcoming) e.topicIds.forEach((t) => neededSoon.add(t))
  for (const [id, s] of stats) if (s.level === 'struggling') neededSoon.add(id)
  const byId = new Map(topics.map((t) => [t.id, t]))

  const out: TopicRecommendation[] = []
  for (const topic of topics) {
    if (!subjectIds.has(topic.subjectId)) continue
    const s = stats.get(topic.id)
    if (!s) continue
    const reasons: string[] = []
    let score = 0

    // 1) Repeated mistakes
    const open = mistakesByTopic.get(topic.id) ?? 0
    if (open > 0 || s.recentWrong >= 2) {
      score += Math.min(50, open * 10 + s.recentWrong * 5)
      if (open > 0) reasons.push(`${open} offene${open === 1 ? 'r' : ''} Fehler zum Wiederholen`)
      else reasons.push(`${s.recentWrong} Fehler in den letzten 14 Tagen`)
    }
    if (s.level === 'struggling') {
      score += 10
      reasons.push('Wird häufig falsch beantwortet')
    }

    // 2) Upcoming tests
    const exam = upcoming.filter((e) => e.topicIds.includes(topic.id)).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (exam) {
      const d = diffDays(today, exam.date)
      const urgency = 1 - Math.min(d, 28) / 28
      score += Math.round((8 + 25 * urgency) * (1 - s.mastery * 0.6))
      reasons.push(`${exam.type} ${relativeDay(exam.date, today)}`)
    }

    // 3) Not reviewed recently / overdue
    if (s.nextReview) {
      const overdue = diffDays(s.nextReview, today)
      if (overdue >= 0) {
        score += Math.min(20, 5 + overdue * 2)
        const since = s.lastPracticed ? diffDays(s.lastPracticed.slice(0, 10), today) : 0
        reasons.push(overdue === 0 ? 'Wiederholung ist heute fällig' : `Seit ${since} Tagen nicht wiederholt`)
      }
    }

    // 4) Foundation for something needed soon
    const dependents = topics.filter((t) => t.prerequisiteIds.includes(topic.id) && neededSoon.has(t.id))
    if (dependents.length > 0 && s.level !== 'solid' && s.level !== 'mastered') {
      score += 15
      reasons.push(`Grundlage für „${byId.get(dependents[0].id)?.name}“`)
    }

    // 5) Already understood → less often
    if (s.level === 'mastered') score -= 15
    if (s.level === 'solid') score -= 5

    // Challenge for solid topics without other pressure
    if (s.challengeReady && score <= 10) {
      score = Math.max(score, 6)
      reasons.push('Bereit für schwierigere Aufgaben')
    }

    if (score <= 0 || reasons.length === 0) continue

    let action: ActionKind
    let actionLabel: string
    if (open > 0) {
      action = 'mistakes'
      actionLabel = `${Math.min(open, 10)} Fehler wiederholen`
    } else if (s.level === 'new') {
      action = 'learn'
      actionLabel = 'Einstieg: kurze Lernrunde'
    } else if (s.challengeReady && !exam && s.recentWrong === 0) {
      action = 'challenge'
      actionLabel = 'Schwierigere Aufgaben probieren'
    } else if (s.level === 'mastered' || s.level === 'solid') {
      action = 'review'
      actionLabel = 'Kurz wiederholen'
    } else {
      action = 'practice'
      actionLabel = 'Gezielt üben'
    }
    const estMinutes = action === 'mistakes' ? Math.max(5, Math.min(open, 10)) : action === 'review' ? 5 : 10
    out.push({ topicId: topic.id, subjectId: topic.subjectId, score, reasons, action, actionLabel, estMinutes })
  }
  return out.sort((a, b) => b.score - a.score)
}

export interface TodayTask {
  key: string
  kind: 'plan' | 'mistakes' | 'cards' | 'topic' | 'onboarding'
  title: string
  detail: string
  minutes: number
  href: string
  reasons: string[]
}

/**
 * "Was soll ich heute lernen?" – fills the daily goal in a fixed, explainable order:
 * planned exam sessions → open mistakes → due flashcards → top topic recommendations.
 */
export function buildTodayTasks(input: {
  dailyGoalMinutes: number
  planSessionsToday: { examTitle: string; examId: string; sessionId: string; title: string; minutes: number }[]
  openMistakeCount: number
  dueCards: { deckId: string; deckName: string; count: number; fresh: number }[]
  recommendations: TopicRecommendation[]
  topicName: (id: string) => string
}): TodayTask[] {
  const tasks: TodayTask[] = []
  let budget = Math.max(5, input.dailyGoalMinutes)
  const take = (m: number) => {
    budget -= m
  }
  for (const p of input.planSessionsToday) {
    tasks.push({ key: `plan-${p.sessionId}`, kind: 'plan', title: p.title, detail: `Lernplan: ${p.examTitle}`, minutes: p.minutes, href: `/pruefungen/${p.examId}`, reasons: ['Steht heute in deinem Lernplan'] })
    take(p.minutes)
  }
  if (input.openMistakeCount > 0 && budget > 0) {
    const n = Math.min(input.openMistakeCount, 10)
    tasks.push({ key: 'mistakes', kind: 'mistakes', title: `${n} Fehler wiederholen`, detail: 'Fragen, die du zuletzt falsch beantwortet hast', minutes: Math.max(3, n), href: '/fehler', reasons: ['Fehler zu wiederholen festigt am meisten'] })
    take(Math.max(3, n))
  }
  const totalReviews = input.dueCards.reduce((s, d) => s + d.count, 0)
  const totalNew = input.dueCards.reduce((s, d) => s + d.fresh, 0)
  if (totalReviews + totalNew > 0 && budget > 0) {
    const minutes = Math.max(2, Math.round(totalReviews * 0.25 + totalNew * 0.5))
    const top = [...input.dueCards].sort((a, b) => b.count + b.fresh - (a.count + a.fresh))[0]
    const title = totalReviews > 0
      ? `${totalReviews} Karteikarte${totalReviews === 1 ? '' : 'n'} wiederholen${totalNew ? ` + ${totalNew} neue` : ''}`
      : `${totalNew} neue Karteikarte${totalNew === 1 ? '' : 'n'} lernen`
    tasks.push({
      key: 'cards', kind: 'cards', title,
      detail: input.dueCards.length === 1 ? top.deckName : `${input.dueCards.length} Stapel, z. B. ${top.deckName}`,
      minutes, href: '/karteikarten/lernen', reasons: [totalReviews ? 'Heute fällig laut Wiederholungsplan' : 'Höchstens 10 neue Karten pro Tag'],
    })
    take(minutes)
  }
  for (const r of input.recommendations) {
    if (budget <= 0 || tasks.filter((t) => t.kind === 'topic').length >= 3) break
    if (r.action === 'mistakes' && tasks.some((t) => t.kind === 'mistakes')) continue
    tasks.push({ key: `topic-${r.topicId}`, kind: 'topic', title: `${input.topicName(r.topicId)}: ${r.actionLabel}`, detail: r.reasons.join(' · '), minutes: r.estMinutes, href: `/quiz/neu?topic=${r.topicId}&preset=${r.action}`, reasons: r.reasons })
    take(r.estMinutes)
  }
  return tasks
}
