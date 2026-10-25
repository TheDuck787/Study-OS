import { db } from '@/db/index'
import type { Exam, PlanSession } from '@/db/types'
import { setExamPlan } from '@/db/repo'
import { computeTopicStats } from '@/lib/mastery'
import { generateStudyPlan } from '@/lib/studyplan'
import { dayKey } from '@/lib/dates'

/** (Re-)generates the plan from the current mastery data. Finished sessions are kept. */
export async function regeneratePlan(exam: Exam, opts: { keepDone: boolean } = { keepDone: true }) {
  const answers = await db.answers.toArray()
  const topics = (await db.topics.bulkGet(exam.topicIds)).filter((t): t is NonNullable<typeof t> => !!t)
  const result = generateStudyPlan({
    today: dayKey(),
    examDate: exam.date,
    minutesPerDay: exam.minutesPerDay,
    availableWeekdays: exam.availableWeekdays,
    difficulty: exam.difficulty,
    keep: opts.keepDone ? exam.plan.filter((p) => p.done) : [],
    topics: topics.map((t) => {
      const s = computeTopicStats(t.id, answers)
      return { id: t.id, name: t.name, mastery: s.mastery, level: s.level, prerequisiteIds: t.prerequisiteIds }
    }),
  })
  await setExamPlan(exam.id, result.sessions, result.warnings)
  return result
}

/** Link that starts the right quiz for a plan session (and marks the session done when finished). */
export function sessionHref(s: PlanSession, examId: string, subjectId: string): string {
  const base = `exam=${examId}&session=${s.id}&subject=${subjectId}`
  const topics = s.topicIds.join(',')
  switch (s.type) {
    case 'diagnostic':
      return `/quiz/neu?preset=diagnostic&${base}`
    case 'mock':
      return `/quiz/neu?preset=mock&${base}`
    case 'learn':
      return `/quiz/neu?preset=learn&topic=${s.topicIds[0] ?? ''}&${base}`
    case 'practice':
      return s.topicIds.length === 1 ? `/quiz/neu?preset=practice&topic=${s.topicIds[0]}&${base}` : `/quiz/neu?preset=practice&topics=${topics}&${base}`
    case 'analysis':
      return `/quiz/neu?preset=mistakes&${base}`
    case 'review':
    case 'final':
      return `/quiz/neu?preset=review&topics=${topics}&${base}`
  }
}
