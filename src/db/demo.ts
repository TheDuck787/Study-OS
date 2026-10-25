import { db } from './index'
import type { Answer, CalendarEvent, CardReview, Question, QuizAttempt, StudySession, Task, XpEvent } from './types'
import { seedLibrary, subjectIdFor } from './seed'
import { saveProfile, saveNote, addMaterial, saveExam, setExamPlan, saveTeacherGrade, setMeta } from './repo'
import { CURRICULUM } from '@/content/curriculum'
import { seededRandom, shuffle, uid } from '@/lib/id'
import { addDays, dayKey, startOfWeek } from '@/lib/dates'
import { reviewCard, newSrs, selectDueCards } from '@/lib/srs'
import { applyProposal, DEFAULT_PLANNER_SETTINGS, proposeFullPlan } from '@/lib/calendar/planner'
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
  await seedDemoCalendar(today, now)
  await setMeta('demoSeededAt', now.toISOString())
}

/** Timetable, homework, appointments and a planner run, so the calendar can be explored in the demo. */
async function seedDemoCalendar(today: string, now: Date) {
  const sid = (k: string) => subjectIdFor(k)
  const slots = [['07:45', '08:30'], ['08:35', '09:20'], ['09:40', '10:25'], ['10:30', '11:15'], ['11:35', '12:20'], ['12:25', '13:10'], ['13:30', '14:15']]
  const timetable: Record<number, [string, string, string][]> = {
    1: [['ma', 'A 2.14', 'Fr. Krüger'], ['ma', 'A 2.14', 'Fr. Krüger'], ['de', 'B 1.03', 'Hr. Lenz'], ['en', 'B 1.03', 'Fr. Okafor'], ['bio', 'NW 2', 'Hr. Schulz'], ['ge', 'B 1.03', 'Fr. Brandt']],
    2: [['en', 'B 1.03', 'Fr. Okafor'], ['ph', 'NW 1', 'Hr. Wendt'], ['ph', 'NW 1', 'Hr. Wendt'], ['de', 'B 1.03', 'Hr. Lenz'], ['geo', 'B 2.07', 'Fr. Möller'], ['ma', 'A 2.14', 'Fr. Krüger']],
    3: [['ch', 'NW 3', 'Fr. Yilmaz'], ['ch', 'NW 3', 'Fr. Yilmaz'], ['ma', 'A 2.14', 'Fr. Krüger'], ['en', 'B 1.03', 'Fr. Okafor'], ['de', 'B 1.03', 'Hr. Lenz'], ['ge', 'B 1.03', 'Fr. Brandt'], ['bio', 'NW 2', 'Hr. Schulz']],
    4: [['de', 'B 1.03', 'Hr. Lenz'], ['ma', 'A 2.14', 'Fr. Krüger'], ['en', 'B 1.03', 'Fr. Okafor'], ['geo', 'B 2.07', 'Fr. Möller'], ['bio', 'NW 2', 'Hr. Schulz'], ['ph', 'NW 1', 'Hr. Wendt']],
    5: [['en', 'B 1.03', 'Fr. Okafor'], ['de', 'B 1.03', 'Hr. Lenz'], ['ma', 'A 2.14', 'Fr. Krüger'], ['ch', 'NW 3', 'Fr. Yilmaz'], ['ge', 'B 1.03', 'Fr. Brandt']],
  }
  const weekStart = startOfWeek(addDays(today, -14))
  const iso = now.toISOString()
  const ev = (p: Partial<CalendarEvent> & Pick<CalendarEvent, 'title' | 'category' | 'date'>): CalendarEvent => ({
    id: uid('ev'), customCategoryId: null, subjectId: null, endDate: null, allDay: false, start: null, end: null, priority: 'medium', status: 'planned', description: '', location: '', teacher: '',
    topicIds: [], materialIds: [], deckId: null, taskId: null, examId: null, workloadMinutes: null, reminderMinutes: null, checklist: [], recurrence: null, completedDates: [], seriesId: null,
    originalDate: null, source: 'manual', pinned: false, blocksStudy: false, createdAt: iso, updatedAt: iso, ...p,
  })
  const weekly = (wd: number) => ({ freq: 'weekly' as const, interval: 1, byWeekday: [wd], until: null, count: null, exceptions: [] })
  const events: CalendarEvent[] = []
  for (const [wdStr, lessons] of Object.entries(timetable)) {
    const wd = Number(wdStr)
    const date = addDays(weekStart, wd - 1)
    for (let i = 0; i < lessons.length; i++) {
      const [key, room, teacher] = lessons[i]
      if (i > 0 && lessons[i - 1][0] === key) continue // double lesson: merged below
      const double = lessons[i + 1]?.[0] === key
      const name = CURRICULUM.find((c) => c.key === key)?.name ?? key
      events.push(ev({ title: name, category: 'lesson', subjectId: sid(key), date, start: slots[i][0], end: slots[double ? i + 1 : i][1], location: room, teacher, recurrence: weekly(wd) }))
    }
  }
  const chor = uid('cat')
  await db.eventCategories.add({ id: chor, name: 'Chor', color: 3, createdAt: iso })
  events.push(
    ev({ title: 'Fußballtraining', category: 'appointment', date: addDays(weekStart, 1), start: '17:00', end: '18:30', location: 'Sportplatz Nord', recurrence: { ...weekly(2), byWeekday: [2, 4] } }),
    ev({ title: 'Schulchor', category: 'custom', customCategoryId: chor, date: addDays(weekStart, 2), start: '14:30', end: '15:30', location: 'Aula', recurrence: weekly(3) }),
    ev({ title: 'Zahnarzt', category: 'appointment', date: addDays(today, 2), start: '16:00', end: '16:45', location: 'Praxis Dr. Albers', reminderMinutes: 60 }),
    ev({ title: 'Betriebspraktikum', category: 'internship', date: addDays(today, 24), endDate: addDays(today, 28), allDay: true, blocksStudy: true, location: 'Stadtwerke', description: 'Praktikumsmappe mitnehmen.' }),
    ev({ title: 'Oma Geburtstag', category: 'break', date: addDays(today, 5), allDay: true, blocksStudy: true }),
  )
  await db.events.bulkAdd(events)
  const task = (p: Partial<Task> & Pick<Task, 'title'>): Task => ({ id: uid('task'), description: '', kind: 'homework', subjectId: null, topicIds: [], materialId: null, dueDate: null, dueTime: null, priority: 'medium', estimateMinutes: null, status: 'open', doneAt: null, subtasks: [], reminderMinutes: null, createdAt: iso, updatedAt: iso, ...p })
  await db.tasks.bulkAdd([
    task({ title: 'Mathe S. 112 Nr. 4–7', subjectId: sid('ma'), topicIds: ['ma-pythagoras'], dueDate: addDays(today, 1), dueTime: '07:45', estimateMinutes: 30, priority: 'high' }),
    task({ title: 'Englisch: Text „Jobs of the future“ lesen', subjectId: sid('en'), dueDate: addDays(today, 2), estimateMinutes: 20 }),
    task({ title: 'Deutsch: Erörterung Gliederung', subjectId: sid('de'), dueDate: addDays(today, -1), estimateMinutes: 40, priority: 'high' }),
    task({ title: 'Bio-Referat Immunsystem', kind: 'project', subjectId: sid('bio'), topicIds: ['bio-immun'], dueDate: addDays(today, 11), estimateMinutes: 180, priority: 'high', subtasks: [
      { id: uid('chk'), text: 'Quellen suchen', done: true }, { id: uid('chk'), text: 'Gliederung', done: false }, { id: uid('chk'), text: 'Folien erstellen', done: false }, { id: uid('chk'), text: 'Vortrag üben', done: false },
    ] }),
    task({ title: 'Chemie Protokoll Versuch 3', subjectId: sid('ch'), dueDate: addDays(today, -4), status: 'done', doneAt: iso }),
    task({ title: 'Sportsachen waschen', kind: 'todo' }),
    task({ title: 'Geschichte: Quellen zur Weimarer Republik sammeln', subjectId: sid('ge') }),
  ])
  const maExam = (await db.exams.toArray()).find((x) => x.subjectId === sid('ma'))
  if (maExam) await db.exams.update(maExam.id, { startTime: '07:45', endTime: '09:20', location: 'A 2.14', estimatedPrepMinutes: 300, topicConfidence: { 'ma-potenzen': 3, 'ma-pythagoras': 2, 'ma-quadgl': 2 } })
  // let the planner lay out the next two weeks, exactly as "Lernplan automatisch erstellen" would
  const [allEvents, exams, tasks, topics, answers, cards, cardReviews] = await Promise.all([db.events.toArray(), db.exams.toArray(), db.tasks.toArray(), db.topics.toArray(), db.answers.toArray(), db.cards.toArray(), db.cardReviews.toArray()])
  const due = selectDueCards(cards, cardReviews, now)
  const proposal = proposeFullPlan({
    today, nowMin: 0, settings: DEFAULT_PLANNER_SETTINGS, restDays: [0], events: allEvents, exams, tasks, topics, cardsDueByDay: new Map([[today, due.reviews.length + due.fresh.length]]),
    topicState: (id) => {
      const st = computeTopicStats(id, answers, now)
      return { mastery: st.mastery, level: st.level }
    },
  })
  const applied = applyProposal(proposal, new Set(proposal.changes.map((c) => c.id)), exams)
  for (const [id, plan] of applied.examPlans) await db.exams.update(id, { plan })
  await db.events.bulkPut(applied.putEvents)
}
