import { db } from './index'
import type { Answer, CardReview, Question, QuizAttempt, StudySession, XpEvent } from './types'
import { seedLibrary, subjectIdFor } from './seed'
import { saveProfile, saveNote, addMaterial, saveExam, setExamPlan, saveTeacherGrade, setMeta } from './repo'
import { CURRICULUM } from '@/content/curriculum'
import { seededRandom, shuffle, uid } from '@/lib/id'
import { addDays, dayKey } from '@/lib/dates'
import { reviewCard, newSrs } from '@/lib/srs'
import { percentToGrade, BUILTIN_SCALES } from '@/lib/grading'
import { XP_RULES } from '@/lib/progress'
import { computeTopicStats } from '@/lib/mastery'
import { generateStudyPlan } from '@/lib/studyplan'
import { extractSections, extractiveSummary } from '@/lib/docs/structure'

/** How well the fictional demo student knows each topic (probability of a correct answer). */
const SKILL: Record<string, number> = {
  'ma-brueche': 0.9, 'ma-terme': 0.75, 'ma-gleichungen': 0.85, 'ma-linfkt': 0.7, 'ma-potenzen': 0.55, 'ma-pythagoras': 0.35,
  'ma-prozent': 0.6, 'ma-quadgl': 0.3, 'en-tenses': 0.8, 'en-conditionals': 0.45, 'en-passive': 0.65,
  'bio-hormone': 0.7, 'bio-immun': 0.5, 'ch-atombau': 0.55, 'ch-saeuren': 0.4, 'ge-weimar': 0.85, 'ge-ns': 0.75, 'ph-ohm': 0.6,
}

/**
 * Fills the separate demo database with a fictional student "Alex" and three weeks of
 * simulated learning history, so every screen can be explored. Never touches real data.
 */
export async function seedDemo(now: Date = new Date()) {
  const rand = seededRandom(20261025)
  await seedLibrary(CURRICULUM.map((c) => c.key))
  await saveProfile({ name: 'Alex (Demo)', grade: 9, dailyGoalMinutes: 25, weeklyGoalDays: 4, restDays: [0] })

  const questions = await db.questions.toArray()
  const byTopic = new Map<string, Question[]>()
  for (const q of questions) byTopic.set(q.topicId, [...(byTopic.get(q.topicId) ?? []), q])

  const answers: Answer[] = []
  const attempts: QuizAttempt[] = []
  const sessions: StudySession[] = []
  const xp: XpEvent[] = []
  const today = dayKey(now)
  const topicKeys = Object.keys(SKILL)

  for (let back = 21; back >= 1; back--) {
    const day = addDays(today, -back)
    const date = new Date(`${day}T16:30:00`)
    if (date.getDay() === 0 || rand() < 0.3) continue // Sundays off, some free days
    const nTopics = 1 + Math.floor(rand() * 2)
    for (const topicId of shuffle(topicKeys, rand).slice(0, nTopics)) {
      const pool = byTopic.get(topicId) ?? []
      if (pool.length === 0) continue
      // the student gets a bit better over time
      const p = Math.min(0.97, SKILL[topicId] + (21 - back) * 0.008)
      const picked = shuffle(pool, rand).slice(0, Math.min(pool.length, 4 + Math.floor(rand() * 3)))
      const attemptId = uid('att')
      const start = new Date(date.getTime() + Math.floor(rand() * 3) * 3600_000)
      let score = 0
      let t = start.getTime()
      for (const q of picked) {
        t += 40_000 + Math.floor(rand() * 60_000)
        const correct = rand() < p
        const at = new Date(t).toISOString()
        answers.push({
          id: uid('ans'), attemptId, questionId: q.id, subjectId: q.subjectId, topicId: q.topicId, given: correct ? q.answer : '(Demo-Antwort)',
          correct, score: correct ? 1 : 0, at, hintsUsed: 0, timeMs: 50_000, mode: 'practice', selfAssessed: false,
          feedback: correct ? 'Richtig!' : 'Demo: falsch beantwortet', errorTag: !correct && q.type === 'math' && rand() < 0.4 ? 'sign-error' : null,
        })
        if (correct) {
          score += q.points
          xp.push({ id: uid('xp'), at, day, amount: XP_RULES.correctAnswer(q.difficulty, 0), reason: 'Richtige Antwort', refId: null })
        }
      }
      const max = picked.reduce((s, q) => s + q.points, 0)
      const percent = (score / max) * 100
      const end = new Date(t + 20_000)
      attempts.push({
        id: attemptId, kind: 'practice', mode: 'practice', title: `Übung: ${topicId}`, subjectId: picked[0].subjectId, topicIds: [topicId],
        questionIds: picked.map((q) => q.id), questionSnapshots: picked, startedAt: start.toISOString(), finishedAt: end.toISOString(),
        score, maxScore: max, percent, gradingScaleId: 'scale-standard', estimatedGrade: percentToGrade(percent, BUILTIN_SCALES[0]).grade,
        examId: null, planSessionId: null, durationSec: Math.round((end.getTime() - start.getTime()) / 1000),
      })
      sessions.push({ id: uid('ses'), day, startedAt: start.toISOString(), durationSec: Math.round((end.getTime() - start.getTime()) / 1000), activity: 'quiz', subjectId: picked[0].subjectId, items: picked.length, refId: attemptId })
      if (picked.length >= 5) xp.push({ id: uid('xp'), at: end.toISOString(), day, amount: XP_RULES.quizFinished, reason: 'Quiz beendet', refId: attemptId })
    }
  }
  await db.answers.bulkAdd(answers)
  await db.attempts.bulkAdd(attempts)

  // Flashcards: simulate reviews for the jobs deck so some cards are due and retention can be shown
  const cards = await db.cards.where('deckId').equals('deck-en-jobs').toArray()
  const reviews: CardReview[] = []
  for (const c of cards.slice(0, 16)) {
    let srs = newSrs(new Date(`${addDays(today, -14)}T17:00:00`))
    let d = -14
    while (d < 0) {
      const at = new Date(`${addDays(today, d)}T17:${String(10 + Math.floor(rand() * 40)).padStart(2, '0')}:00`)
      const r = rand()
      const rating = r < 0.15 ? 'again' : r < 0.3 ? 'hard' : r < 0.85 ? 'good' : 'easy'
      const next = reviewCard(srs, rating, at)
      reviews.push({ id: uid('rev'), cardId: c.id, deckId: c.deckId, rating, at: at.toISOString(), wasDue: true, intervalBefore: srs.intervalDays, intervalAfter: next.intervalDays })
      xp.push({ id: uid('xp'), at: at.toISOString(), day: dayKey(at), amount: 1, reason: 'Karteikarte', refId: c.id })
      srs = next
      d += Math.max(1, next.intervalDays)
    }
    await db.cards.update(c.id, { srs })
  }
  await db.cardReviews.bulkAdd(reviews)
  await db.sessions.bulkAdd(sessions)
  await db.xpEvents.bulkAdd(xp)

  // Notes and a material
  const maSid = subjectIdFor('ma')
  await saveNote({
    title: 'Merkzettel: Satz des Pythagoras', subjectId: maSid, topicId: 'ma-pythagoras', tags: ['Merkzettel'],
    content: '## Satz des Pythagoras\n\nIm **rechtwinkligen** Dreieck gilt: $a^2 + b^2 = c^2$\n\n- $c$ ist die **Hypotenuse** – sie liegt gegenüber vom rechten Winkel und ist die längste Seite.\n- $a$ und $b$ sind die **Katheten**.\n\n**Typischer Fehler:** Bei einer gesuchten Kathete muss man subtrahieren: $b^2 = c^2 - a^2$.',
  })
  await saveNote({
    title: 'if-clauses – Übersicht', subjectId: subjectIdFor('en'), topicId: 'en-conditionals', tags: ['Grammatik'],
    content: '| Typ | if-Satz | Hauptsatz | Bedeutung |\n|---|---|---|---|\n| I | simple present | will + Infinitiv | real möglich |\n| II | simple past | would + Infinitiv | unwahrscheinlich |\n| III | past perfect | would have + Partizip | Vergangenheit, nicht mehr änderbar |',
  })
  const text = 'Hormone\n\nHormone sind Botenstoffe. Sie werden in Hormondrüsen gebildet und mit dem Blut im Körper verteilt.\n\nBlutzuckerregulation\n\nInsulin: Hormon aus der Bauchspeicheldrüse, senkt den Blutzuckerspiegel.\nGlukagon: Gegenspieler des Insulins, erhöht den Blutzuckerspiegel.\nDiabetes Typ 1: Die Bauchspeicheldrüse bildet kaum oder kein Insulin.\n\nRegelkreis\n\nDer Blutzuckerspiegel wird über einen Regelkreis konstant gehalten: Steigt der Wert, wird mehr Insulin ausgeschüttet.'
  const sections = extractSections(text)
  await addMaterial({
    subjectId: subjectIdFor('bio'), topicId: 'bio-hormone', title: 'Arbeitsblatt Hormone (Demo)', fileName: 'hormone.txt', mimeType: 'text/plain',
    size: text.length, text, sections, extraction: { status: 'complete', method: 'plain-text', warnings: [] },
    summary: extractiveSummary(sections), summarySource: 'extractive', tags: ['Arbeitsblatt'],
  })

  // Upcoming exam with a generated plan
  const examDate = addDays(today, 9)
  const examTopics = ['ma-potenzen', 'ma-pythagoras', 'ma-quadgl']
  const examId = await saveExam({
    subjectId: maSid, title: 'Klassenarbeit Pythagoras & Wurzeln', type: 'Klassenarbeit', date: examDate, topicIds: examTopics, materialIds: [],
    difficulty: 2, minutesPerDay: 30, availableWeekdays: [1, 2, 3, 4, 5, 6], notes: 'Taschenrechner erlaubt.', gradingScaleId: null,
  })
  const allAnswers = await db.answers.toArray()
  const topicRows = await db.topics.bulkGet(examTopics)
  const plan = generateStudyPlan({
    today, examDate, minutesPerDay: 30, availableWeekdays: [1, 2, 3, 4, 5, 6], difficulty: 2,
    topics: topicRows.filter(Boolean).map((t) => {
      const s = computeTopicStats(t!.id, allAnswers, now)
      return { id: t!.id, name: t!.name, mastery: s.mastery, level: s.level, prerequisiteIds: t!.prerequisiteIds }
    }),
  })
  await setExamPlan(examId, plan.sessions, plan.warnings)
  await saveExam({
    subjectId: subjectIdFor('en'), title: 'Vokabeltest Unit 2', type: 'Vokabeltest', date: addDays(today, 16), topicIds: ['en-vocab-jobs'], materialIds: [],
    difficulty: 1, minutesPerDay: 15, availableWeekdays: [1, 2, 3, 4, 5], notes: '', gradingScaleId: null,
  })
  await saveTeacherGrade({ subjectId: maSid, examId: null, title: 'Test Lineare Funktionen', grade: '2-', date: addDays(today, -20), note: 'Echte Note vom Lehrer (Demo)' })
  await saveTeacherGrade({ subjectId: subjectIdFor('en'), examId: null, title: 'Klassenarbeit Unit 1', grade: '3', date: addDays(today, -30), note: '' })
  await setMeta('demoSeededAt', now.toISOString())
}
