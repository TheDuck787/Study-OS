import { db } from '@/db/index'
import type { Exam } from '@/db/types'
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
