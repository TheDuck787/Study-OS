import { db } from './index'
import type {
  Answer, Card, CardRating, Deck, Exam, GradingScale, ID, Material, Note, PlanSession, Profile, Question, QuizAttempt,
  StudySession, Subject, TeacherGrade, Topic, TutorChat, ActivityKind,
} from './types'
import { uid, nowIso } from '@/lib/id'
import { dayKey } from '@/lib/dates'
import { newSrs, reviewCard as srsReview, isDue } from '@/lib/srs'
import { BUILTIN_SCALES, percentToGrade, validateScale } from '@/lib/grading'
import { computeTopicStats, type MasteryLevel } from '@/lib/mastery'
import { openMistakes } from '@/lib/mistakes'
import { XP_RULES } from '@/lib/progress'
import type { CheckResult } from '@/lib/answerCheck'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function requireText(value: string | undefined | null, field: string, max = 200): string {
  const v = (value ?? '').trim()
  if (!v) throw new ValidationError(`${field} darf nicht leer sein.`)
  if (v.length > max) throw new ValidationError(`${field} ist zu lang (höchstens ${max} Zeichen).`)
  return v
}

// ───────────────────────── Profile & settings ─────────────────────────

export const DEFAULT_PROFILE: Omit<Profile, 'createdAt' | 'updatedAt'> = {
  id: 'me',
  name: '',
  grade: 9,
  schoolType: 'Gesamtschule',
  region: 'Mecklenburg-Vorpommern',
  dailyGoalMinutes: 20,
  weeklyGoalDays: 4,
  explanationMode: 'normal',
  quizDifficulty: 'adaptive',
  gradingScaleId: 'scale-standard',
  restDays: [0],
  pausedUntil: null,
  notifications: { enabled: false, reminderTime: '16:00', examReminders: true },
}

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get('me')
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const existing = await db.profile.get('me')
  const now = nowIso()
  const next: Profile = { ...DEFAULT_PROFILE, createdAt: now, ...existing, ...patch, id: 'me', updatedAt: now }
  if (next.name.length > 60) throw new ValidationError('Der Name ist zu lang (höchstens 60 Zeichen).')
  if (!Number.isInteger(next.grade) || next.grade < 1 || next.grade > 13) throw new ValidationError('Die Klassenstufe muss zwischen 1 und 13 liegen.')
  if (next.dailyGoalMinutes < 5 || next.dailyGoalMinutes > 240) throw new ValidationError('Das Tagesziel muss zwischen 5 und 240 Minuten liegen.')
  if (next.weeklyGoalDays < 1 || next.weeklyGoalDays > 7) throw new ValidationError('Das Wochenziel muss zwischen 1 und 7 Tagen liegen.')
  await db.profile.put(next)
  return next
}

export async function ensureGradingScales() {
  await db.transaction('rw', db.gradingScales, async () => {
    for (const s of BUILTIN_SCALES) if (!(await db.gradingScales.get(s.id))) await db.gradingScales.put(s)
  })
}

export async function saveGradingScale(scale: Omit<GradingScale, 'id' | 'builtin'> & { id?: ID }): Promise<ID> {
  const name = requireText(scale.name, 'Name', 80)
  const err = validateScale(scale.thresholds)
  if (err) throw new ValidationError(err)
  const id = scale.id ?? uid('scale')
  const existing = await db.gradingScales.get(id)
  if (existing?.builtin) throw new ValidationError('Vorgegebene Notenschlüssel können nicht verändert werden. Lege eine Kopie an.')
  await db.gradingScales.put({ ...scale, name, id, builtin: false, thresholds: [...scale.thresholds].sort((a, b) => a.grade - b.grade) })
  return id
}

export async function deleteGradingScale(id: ID) {
  const s = await db.gradingScales.get(id)
  if (!s || s.builtin) throw new ValidationError('Dieser Notenschlüssel kann nicht gelöscht werden.')
  await db.transaction('rw', db.gradingScales, db.profile, db.exams, async () => {
    await db.gradingScales.delete(id)
    const p = await db.profile.get('me')
    if (p?.gradingScaleId === id) await db.profile.put({ ...p, gradingScaleId: 'scale-standard' })
    await db.exams.where('id').notEqual('').modify((e) => {
      if (e.gradingScaleId === id) e.gradingScaleId = null
    })
  })
}

export async function getScale(id: ID | null | undefined): Promise<GradingScale> {
  const p = await db.profile.get('me')
  return (
    (id ? await db.gradingScales.get(id) : undefined) ??
    (p ? await db.gradingScales.get(p.gradingScaleId) : undefined) ??
    BUILTIN_SCALES[0]
  )
}

// ───────────────────────── Subjects & topics ─────────────────────────

export async function createSubject(name: string, color?: number): Promise<ID> {
  const n = requireText(name, 'Der Fachname', 60)
  const all = await db.subjects.toArray()
  if (all.some((s) => s.name.toLowerCase() === n.toLowerCase())) throw new ValidationError(`Das Fach „${n}“ gibt es schon.`)
  const id = uid('sub')
  await db.subjects.add({ id, name: n, color: color ?? all.length % 10, order: all.length, createdAt: nowIso() })
  return id
}

export async function updateSubject(id: ID, patch: Partial<Pick<Subject, 'name' | 'color' | 'icon' | 'short'>>) {
  const s = await db.subjects.get(id)
  if (!s) throw new ValidationError('Fach nicht gefunden.')
  const name = patch.name !== undefined ? requireText(patch.name, 'Der Fachname', 60) : s.name
  if (patch.name !== undefined) {
    const dup = (await db.subjects.toArray()).some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())
    if (dup) throw new ValidationError(`Das Fach „${name}“ gibt es schon.`)
  }
  const short = patch.short !== undefined ? patch.short?.trim().slice(0, 8) || null : undefined
  await db.subjects.update(id, { ...patch, name, ...(short !== undefined ? { short } : {}) })
}

export async function reorderSubjects(ids: ID[]) {
  await db.transaction('rw', db.subjects, async () => {
    for (let i = 0; i < ids.length; i++) await db.subjects.update(ids[i], { order: i })
  })
}

export async function subjectDeletionImpact(id: ID) {
  const [topics, notes, materials, decks, questions, exams, answers] = await Promise.all([
    db.topics.where('subjectId').equals(id).count(),
    db.notes.where('subjectId').equals(id).count(),
    db.materials.where('subjectId').equals(id).count(),
    db.decks.where('subjectId').equals(id).count(),
    db.questions.where('subjectId').equals(id).count(),
    db.exams.where('subjectId').equals(id).count(),
    db.answers.where('subjectId').equals(id).count(),
  ])
  return { topics, notes, materials, decks, questions, exams, answers }
}

/** Deletes a subject with everything that belongs to it. Materials are kept but unassigned. */
export async function deleteSubject(id: ID) {
  await db.transaction('rw', [db.subjects, db.topics, db.notes, db.materials, db.decks, db.cards, db.cardReviews, db.questions, db.exams, db.answers, db.teacherGrades, db.tutorChats, db.events, db.tasks], async () => {
    // calendar entries and tasks are the student's own plans – they stay, just without subject
    await db.events.where('subjectId').equals(id).modify({ subjectId: null, topicIds: [] })
    await db.tasks.where('subjectId').equals(id).modify({ subjectId: null, topicIds: [] })
    const examIds = (await db.exams.where('subjectId').equals(id).primaryKeys()) as string[]
    await db.events.where('examId').anyOf(examIds).modify({ examId: null })
    const deckIds = (await db.decks.where('subjectId').equals(id).toArray()).map((d) => d.id)
    await db.cards.where('deckId').anyOf(deckIds).delete()
    await db.cardReviews.where('deckId').anyOf(deckIds).delete()
    await db.decks.bulkDelete(deckIds)
    await db.topics.where('subjectId').equals(id).delete()
    await db.notes.where('subjectId').equals(id).delete()
    await db.materials.where('subjectId').equals(id).modify({ subjectId: null, topicId: null })
    await db.questions.where('subjectId').equals(id).delete()
    await db.exams.where('subjectId').equals(id).delete()
    await db.answers.where('subjectId').equals(id).delete()
    await db.teacherGrades.where('subjectId').equals(id).delete()
    await db.tutorChats.where('subjectId').equals(id).modify({ subjectId: null, topicId: null })
    await db.subjects.delete(id)
  })
}

export async function createTopic(subjectId: ID, name: string, opts: { parentId?: ID | null; description?: string; curriculum?: Topic['curriculum'] } = {}): Promise<ID> {
  const n = requireText(name, 'Der Themenname', 120)
  if (!(await db.subjects.get(subjectId))) throw new ValidationError('Fach nicht gefunden.')
  const siblings = await db.topics.where('subjectId').equals(subjectId).filter((t) => t.parentId === (opts.parentId ?? null)).count()
  const id = uid('top')
  await db.topics.add({
    id, subjectId, parentId: opts.parentId ?? null, name: n, description: (opts.description ?? '').trim(), order: siblings,
    prerequisiteIds: [], curriculum: opts.curriculum ?? 'own', createdAt: nowIso(),
  })
  return id
}

export async function updateTopic(id: ID, patch: Partial<Pick<Topic, 'name' | 'description' | 'prerequisiteIds' | 'parentId' | 'curriculum'>>) {
  const t = await db.topics.get(id)
  if (!t) throw new ValidationError('Thema nicht gefunden.')
  const next = { ...patch }
  if (patch.name !== undefined) next.name = requireText(patch.name, 'Der Themenname', 120)
  if (patch.prerequisiteIds) next.prerequisiteIds = patch.prerequisiteIds.filter((p) => p !== id)
  if (patch.parentId !== undefined && patch.parentId !== null) {
    // prevent cycles
    let cur: Topic | undefined = await db.topics.get(patch.parentId)
    while (cur) {
      if (cur.id === id) throw new ValidationError('Ein Thema kann nicht sein eigenes Unterthema werden.')
      cur = cur.parentId ? await db.topics.get(cur.parentId) : undefined
    }
  }
  await db.topics.update(id, next)
}

export async function reorderTopics(ids: ID[]) {
  await db.transaction('rw', db.topics, async () => {
    for (let i = 0; i < ids.length; i++) await db.topics.update(ids[i], { order: i })
  })
}

async function collectTopicTree(id: ID): Promise<ID[]> {
  const out = [id]
  const children = await db.topics.where('parentId').equals(id).toArray()
  for (const c of children) out.push(...(await collectTopicTree(c.id)))
  return out
}

export async function topicDeletionImpact(id: ID) {
  const ids = await collectTopicTree(id)
  const [questions, answers, notes, cards] = await Promise.all([
    db.questions.where('topicId').anyOf(ids).count(),
    db.answers.where('topicId').anyOf(ids).count(),
    db.notes.where('topicId').anyOf(ids).count(),
    db.cards.where('topicId').anyOf(ids).count(),
  ])
  return { subtopics: ids.length - 1, questions, answers, notes, cards }
}

/** Deletes a topic and its subtopics. Questions and answers go; notes and cards are kept (unassigned). */
export async function deleteTopic(id: ID) {
  const ids = await collectTopicTree(id)
  await db.transaction('rw', [db.topics, db.questions, db.answers, db.notes, db.cards, db.materials, db.exams, db.decks, db.events, db.tasks], async () => {
    const dropTopics = (x: { topicIds: ID[] }) => {
      if (x.topicIds.some((tid) => ids.includes(tid))) x.topicIds = x.topicIds.filter((tid) => !ids.includes(tid))
    }
    await db.events.toCollection().modify(dropTopics)
    await db.tasks.toCollection().modify(dropTopics)
    await db.exams.toCollection().modify((e) => {
      if (e.topicConfidence) for (const tid of ids) delete e.topicConfidence[tid]
    })
    await db.questions.where('topicId').anyOf(ids).delete()
    await db.answers.where('topicId').anyOf(ids).delete()
    await db.notes.where('topicId').anyOf(ids).modify({ topicId: null })
    await db.cards.where('topicId').anyOf(ids).modify({ topicId: null })
    await db.decks.where('topicId').anyOf(ids).modify({ topicId: null })
    await db.materials.where('topicId').anyOf(ids).modify({ topicId: null })
    await db.exams.toCollection().modify((e) => {
      e.topicIds = e.topicIds.filter((t) => !ids.includes(t))
      e.plan = e.plan.map((p) => ({ ...p, topicIds: p.topicIds.filter((t) => !ids.includes(t)) }))
    })
    await db.topics.toCollection().modify((t) => {
      if (t.prerequisiteIds.some((p) => ids.includes(p))) t.prerequisiteIds = t.prerequisiteIds.filter((p) => !ids.includes(p))
    })
    await db.topics.bulkDelete(ids)
  })
}

// ───────────────────────── Notes & materials ─────────────────────────

export async function saveNote(note: Partial<Note> & { title: string; content: string }): Promise<ID> {
  const title = requireText(note.title, 'Der Titel', 150)
  if (note.content.length > 200_000) throw new ValidationError('Die Notiz ist zu lang.')
  const now = nowIso()
  const id = note.id ?? uid('note')
  const existing = note.id ? await db.notes.get(note.id) : undefined
  await db.notes.put({
    id, title, content: note.content, subjectId: note.subjectId ?? existing?.subjectId ?? null, topicId: note.topicId ?? existing?.topicId ?? null,
    tags: (note.tags ?? existing?.tags ?? []).map((t) => t.trim()).filter(Boolean), sourceMaterialId: note.sourceMaterialId ?? existing?.sourceMaterialId ?? null,
    createdAt: existing?.createdAt ?? now, updatedAt: now,
  })
  return id
}

export async function deleteNote(id: ID) {
  await db.notes.delete(id)
}

export async function addMaterial(m: Omit<Material, 'id' | 'createdAt' | 'hasBlob'>, blob?: Blob): Promise<ID> {
  const id = uid('mat')
  requireText(m.title, 'Der Titel', 200)
  await db.transaction('rw', db.materials, db.materialBlobs, async () => {
    await db.materials.add({ ...m, id, hasBlob: !!blob, createdAt: nowIso() })
    if (blob) await db.materialBlobs.put({ id, blob })
  })
  return id
}

export async function updateMaterial(id: ID, patch: Partial<Material>) {
  if (patch.title !== undefined) patch.title = requireText(patch.title, 'Der Titel', 200)
  await db.materials.update(id, patch)
}

export async function deleteMaterial(id: ID) {
  await db.transaction('rw', [db.materials, db.materialBlobs, db.notes, db.cards, db.questions, db.exams, db.tutorChats, db.events, db.tasks], async () => {
    await db.events.filter((e) => e.materialIds.includes(id)).modify((e) => {
      e.materialIds = e.materialIds.filter((x) => x !== id)
    })
    await db.tasks.filter((t) => t.materialId === id).modify({ materialId: null })
    await db.materials.delete(id)
    await db.materialBlobs.delete(id)
    // generated content stays, but loses the (now dead) reference
    await db.notes.filter((n) => n.sourceMaterialId === id).modify({ sourceMaterialId: null })
    await db.cards.filter((c) => c.sourceMaterialId === id).modify({ sourceMaterialId: null })
    await db.questions.filter((q) => q.sourceMaterialId === id).modify({ sourceMaterialId: null })
    await db.exams.toCollection().modify((e) => {
      e.materialIds = e.materialIds.filter((x) => x !== id)
    })
    await db.tutorChats.toCollection().modify((c) => {
      c.materialIds = c.materialIds.filter((x) => x !== id)
    })
  })
}

// ───────────────────────── Decks & cards ─────────────────────────

export async function saveDeck(d: Partial<Deck> & { name: string }): Promise<ID> {
  const name = requireText(d.name, 'Der Stapelname', 100)
  const id = d.id ?? uid('deck')
  const existing = d.id ? await db.decks.get(d.id) : undefined
  await db.decks.put({
    id, name, description: (d.description ?? existing?.description ?? '').trim(), subjectId: d.subjectId !== undefined ? d.subjectId : existing?.subjectId ?? null,
    topicId: d.topicId !== undefined ? d.topicId : existing?.topicId ?? null, frontLang: d.frontLang !== undefined ? d.frontLang : existing?.frontLang ?? null,
    backLang: d.backLang !== undefined ? d.backLang : existing?.backLang ?? 'de-DE', createdAt: existing?.createdAt ?? nowIso(),
  })
  return id
}

export async function deleteDeck(id: ID) {
  await db.transaction('rw', db.decks, db.cards, db.cardReviews, db.events, async () => {
    await db.events.filter((e) => e.deckId === id).modify({ deckId: null })
    await db.cards.where('deckId').equals(id).delete()
    await db.cardReviews.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}

export interface CardInput {
  front: string
  back: string
  example?: string
  tags?: string[]
  topicId?: ID | null
  sourceMaterialId?: ID | null
}

export async function addCards(deckId: ID, inputs: CardInput[]): Promise<number> {
  if (!(await db.decks.get(deckId))) throw new ValidationError('Stapel nicht gefunden.')
  const now = new Date()
  const cards: Card[] = []
  for (const c of inputs) {
    const front = (c.front ?? '').trim()
    const back = (c.back ?? '').trim()
    if (!front || !back) continue
    if (front.length > 2000 || back.length > 4000) throw new ValidationError('Eine Karte ist zu lang.')
    cards.push({
      id: uid('card'), deckId, topicId: c.topicId ?? null, front, back, example: (c.example ?? '').trim(), tags: c.tags ?? [],
      srs: newSrs(now), sourceMaterialId: c.sourceMaterialId ?? null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    })
  }
  await db.cards.bulkAdd(cards)
  return cards.length
}

export async function updateCard(id: ID, patch: Partial<Pick<Card, 'front' | 'back' | 'example' | 'tags' | 'topicId'>>) {
  if (patch.front !== undefined) patch.front = requireText(patch.front, 'Die Vorderseite', 2000)
  if (patch.back !== undefined) patch.back = requireText(patch.back, 'Die Rückseite', 4000)
  await db.cards.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteCard(id: ID) {
  await db.transaction('rw', db.cards, db.cardReviews, async () => {
    await db.cards.delete(id)
    await db.cardReviews.where('cardId').equals(id).delete()
  })
}

export async function resetCardProgress(id: ID) {
  await db.cards.update(id, { srs: newSrs() })
}

/** Rates a card, schedules the next review and gives XP for due reviews (capped per day). */
export async function rateCard(cardId: ID, rating: CardRating, now: Date = new Date()): Promise<Card> {
  return db.transaction('rw', db.cards, db.cardReviews, db.xpEvents, async () => {
    const card = await db.cards.get(cardId)
    if (!card) throw new ValidationError('Karte nicht gefunden.')
    const wasDue = isDue(card.srs, now)
    const srs = srsReview(card.srs, rating, now)
    await db.cards.update(cardId, { srs, updatedAt: now.toISOString() })
    await db.cardReviews.add({ id: uid('rev'), cardId, deckId: card.deckId, rating, at: now.toISOString(), wasDue, intervalBefore: card.srs.intervalDays, intervalAfter: srs.intervalDays })
    if (wasDue) {
      const today = dayKey(now)
      const cardXpToday = (await db.xpEvents.where('day').equals(today).filter((e) => e.reason === 'Karteikarte').toArray()).reduce((s, e) => s + e.amount, 0)
      if (cardXpToday < XP_RULES.dailyCardXpCap) await db.xpEvents.add({ id: uid('xp'), at: now.toISOString(), day: today, amount: XP_RULES.dueCardReview, reason: 'Karteikarte', refId: cardId })
    }
    return { ...card, srs }
  })
}

// ───────────────────────── Questions ─────────────────────────

export async function saveQuestion(q: Omit<Question, 'id' | 'createdAt'> & { id?: ID }): Promise<ID> {
  requireText(q.prompt, 'Die Frage', 4000)
  if (q.type === 'mc') {
    if (!q.options || q.options.filter((o) => o.trim()).length < 2) throw new ValidationError('Eine Auswahlfrage braucht mindestens zwei Antworten.')
    if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) throw new ValidationError('Bitte markiere die richtige Antwort.')
  } else if (q.type === 'tf') {
    if (typeof q.correctBool !== 'boolean') throw new ValidationError('Bitte wähle, ob die Aussage wahr oder falsch ist.')
  } else {
    requireText(q.answer, 'Die Lösung', 4000)
  }
  const id = q.id ?? uid('q')
  const existing = q.id ? await db.questions.get(q.id) : undefined
  await db.questions.put({ ...q, id, createdAt: existing?.createdAt ?? nowIso() })
  return id
}

export async function deleteQuestion(id: ID) {
  await db.questions.delete(id)
}

// ───────────────────────── Quiz attempts ─────────────────────────

export interface NewAttempt {
  kind: QuizAttempt['kind']
  mode: QuizAttempt['mode']
  title: string
  subjectId: ID | null
  topicIds: ID[]
  questions: Question[]
  examId?: ID | null
  planSessionId?: ID | null
  timeLimitMin?: number
}

export async function createAttempt(a: NewAttempt): Promise<ID> {
  if (a.questions.length === 0) throw new ValidationError('Für diese Auswahl gibt es noch keine Fragen.')
  const profile = await db.profile.get('me')
  const exam = a.examId ? await db.exams.get(a.examId) : undefined
  const id = uid('att')
  await db.transaction('rw', db.questions, db.attempts, async () => {
    // generated questions are persisted so history and mistake review can find them again
    const missing: Question[] = []
    for (const q of a.questions) if (!(await db.questions.get(q.id))) missing.push(q)
    if (missing.length) await db.questions.bulkPut(missing)
    await db.attempts.add({
      id, kind: a.kind, mode: a.mode, title: a.title, subjectId: a.subjectId, topicIds: a.topicIds,
      questionIds: a.questions.map((q) => q.id), questionSnapshots: a.questions, startedAt: nowIso(), finishedAt: null,
      score: 0, maxScore: a.questions.reduce((s, q) => s + q.points, 0), percent: 0,
      gradingScaleId: exam?.gradingScaleId ?? profile?.gradingScaleId ?? 'scale-standard', estimatedGrade: null,
      examId: a.examId ?? null, planSessionId: a.planSessionId ?? null, durationSec: 0, draftAnswers: {}, timeLimitMin: a.timeLimitMin,
    })
  })
  return id
}

export async function saveDraftAnswer(attemptId: ID, questionId: ID, value: string) {
  const att = await db.attempts.get(attemptId)
  if (!att || att.finishedAt) return
  await db.attempts.update(attemptId, { draftAnswers: { ...(att.draftAnswers ?? {}), [questionId]: value } })
}

export interface AnswerInput {
  question: Question
  given: string
  check: CheckResult
  hintsUsed: number
  timeMs: number
  selfAssessed?: boolean
  /** override for self-assessment: student says correct/partial/wrong */
  selfScore?: number
}

/** Stores one answer. In practice mode XP is granted immediately. */
export async function recordAnswer(attemptId: ID, input: AnswerInput, now: Date = new Date()): Promise<Answer> {
  const att = await db.attempts.get(attemptId)
  if (!att) throw new ValidationError('Quiz nicht gefunden.')
  const q = input.question
  const score = input.selfScore ?? input.check.score
  const answer: Answer = {
    id: uid('ans'), attemptId, questionId: q.id, subjectId: q.subjectId, topicId: q.topicId, given: input.given,
    correct: input.selfScore !== undefined ? input.selfScore >= 1 : input.check.correct, score, at: now.toISOString(),
    hintsUsed: input.hintsUsed, timeMs: Math.min(input.timeMs, 10 * 60_000), mode: att.mode, selfAssessed: !!input.selfAssessed,
    feedback: input.check.feedback, errorTag: input.check.errorTag,
  }
  await db.transaction('rw', db.answers, db.xpEvents, async () => {
    const previous = await db.answers.where('questionId').equals(q.id).toArray()
    const wasOpen = openMistakes(previous).length > 0
    await db.answers.add(answer)
    if (att.mode === 'practice') await grantAnswerXp(answer, q, wasOpen, now)
  })
  return answer
}

async function grantAnswerXp(answer: Answer, q: Question, wasOpenMistake: boolean, now: Date) {
  if (!answer.correct) return
  let amount = answer.selfAssessed ? 1 : XP_RULES.correctAnswer(q.difficulty, answer.hintsUsed)
  let reason = 'Richtige Antwort'
  if (wasOpenMistake) {
    amount += XP_RULES.fixedMistake
    reason = 'Fehler korrigiert'
  }
  await db.xpEvents.add({ id: uid('xp'), at: now.toISOString(), day: dayKey(now), amount, reason, refId: answer.id })
}

export interface AttemptSummary {
  attempt: QuizAttempt
  answers: Answer[]
  xpGained: number
  levelChanges: { topicId: string; from: MasteryLevel; to: MasteryLevel }[]
}

/** Finishes an attempt: scores it, estimates a grade, records study time, XP and level-ups. */
export async function finishAttempt(attemptId: ID, examAnswers: AnswerInput[] = [], now: Date = new Date()): Promise<AttemptSummary> {
  const att = await db.attempts.get(attemptId)
  if (!att) throw new ValidationError('Quiz nicht gefunden.')
  if (att.finishedAt) {
    const answers = await db.answers.where('attemptId').equals(attemptId).toArray()
    return { attempt: att, answers, xpGained: 0, levelChanges: [] }
  }
  const topicIds = [...new Set(att.questionSnapshots.map((q) => q.topicId))]
  const before = new Map<string, MasteryLevel>()
  for (const t of topicIds) {
    const prev = await db.answers.where('topicId').equals(t).toArray()
    before.set(t, computeTopicStats(t, prev.filter((a) => a.attemptId !== attemptId), now).level)
  }

  // exam mode: answers are only stored (and judged) at submission
  const xpBefore = (await db.xpEvents.where('day').equals(dayKey(now)).toArray()).reduce((s, e) => s + e.amount, 0)
  for (const input of examAnswers) {
    const previous = await db.answers.where('questionId').equals(input.question.id).toArray()
    const wasOpen = openMistakes(previous).length > 0
    const ans = await recordAnswer(attemptId, input, now)
    await grantAnswerXp(ans, input.question, wasOpen, now)
  }

  const answers = await db.answers.where('attemptId').equals(attemptId).toArray()
  // the latest answer per question counts
  const latest = new Map<string, Answer>()
  for (const a of answers.sort((x, y) => x.at.localeCompare(y.at))) latest.set(a.questionId, a)
  let score = 0
  for (const q of att.questionSnapshots) {
    const a = latest.get(q.id)
    if (a) score += a.score * q.points
  }
  score = Math.round(score * 2) / 2 // half points, like in school
  const percent = att.maxScore > 0 ? (score / att.maxScore) * 100 : 0
  const scale = await getScale(att.gradingScaleId)
  const grade = percentToGrade(percent, scale)
  const durationSec = Math.max(1, Math.round((now.getTime() - new Date(att.startedAt).getTime()) / 1000))
  const activeSec = Math.min(durationSec, answers.reduce((s, a) => s + a.timeMs, 0) / 1000 + 30)

  const levelChanges: AttemptSummary['levelChanges'] = []
  const order: MasteryLevel[] = ['new', 'struggling', 'practicing', 'solid', 'mastered']
  for (const t of topicIds) {
    const all = await db.answers.where('topicId').equals(t).toArray()
    const after = computeTopicStats(t, all, now).level
    const from = before.get(t) ?? 'new'
    if (order.indexOf(after) > order.indexOf(from) && (after === 'solid' || after === 'mastered')) levelChanges.push({ topicId: t, from, to: after })
  }

  const updated: QuizAttempt = { ...att, finishedAt: now.toISOString(), score, percent, estimatedGrade: grade.grade, durationSec, draftAnswers: {} }
  await db.transaction('rw', [db.attempts, db.xpEvents, db.sessions, db.exams], async () => {
    await db.attempts.put(updated)
    const day = dayKey(now)
    if (att.questionIds.length >= XP_RULES.quizFinishedMinQuestions && latest.size >= XP_RULES.quizFinishedMinQuestions) {
      await db.xpEvents.add({ id: uid('xp'), at: now.toISOString(), day, amount: XP_RULES.quizFinished, reason: 'Quiz beendet', refId: attemptId })
    }
    for (const c of levelChanges) {
      await db.xpEvents.add({ id: uid('xp'), at: now.toISOString(), day, amount: c.to === 'mastered' ? XP_RULES.levelMastered : XP_RULES.levelSolid, reason: c.to === 'mastered' ? 'Thema gefestigt' : 'Thema gut verstanden', refId: c.topicId })
    }
    await db.sessions.add({ id: uid('ses'), day, startedAt: att.startedAt, durationSec: Math.round(activeSec), activity: att.kind === 'math' ? 'math' : 'quiz', subjectId: att.subjectId, items: latest.size, refId: attemptId })
    if (att.examId && att.planSessionId) await markPlanSessionInternal(att.examId, att.planSessionId, true, attemptId, now)
  })
  const xpAfter = (await db.xpEvents.where('day').equals(dayKey(now)).toArray()).reduce((s, e) => s + e.amount, 0)
  return { attempt: updated, answers, xpGained: Math.max(0, xpAfter - xpBefore), levelChanges }
}

export async function deleteAttempt(id: ID) {
  await db.transaction('rw', db.attempts, db.answers, async () => {
    await db.answers.where('attemptId').equals(id).delete()
    await db.attempts.delete(id)
  })
}

// ───────────────────────── Study sessions & XP ─────────────────────────

export async function recordStudySession(s: { activity: ActivityKind; startedAt: Date; durationSec: number; subjectId?: ID | null; items: number; refId?: ID | null }) {
  if (s.durationSec < 5 || s.items <= 0) return
  const session: StudySession = {
    id: uid('ses'), day: dayKey(s.startedAt), startedAt: s.startedAt.toISOString(), durationSec: Math.min(Math.round(s.durationSec), 3 * 3600),
    activity: s.activity, subjectId: s.subjectId ?? null, items: s.items, refId: s.refId ?? null,
  }
  await db.sessions.add(session)
}

// ───────────────────────── Exams & study plans ─────────────────────────

export async function saveExam(e: Omit<Exam, 'id' | 'createdAt' | 'plan' | 'planWarnings' | 'planGeneratedAt'> & { id?: ID }): Promise<ID> {
  const title = requireText(e.title, 'Der Titel', 120)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new ValidationError('Bitte gib ein gültiges Datum an.')
  if (!(await db.subjects.get(e.subjectId))) throw new ValidationError('Bitte wähle ein Fach.')
  if (e.minutesPerDay < 10 || e.minutesPerDay > 240) throw new ValidationError('Die Lernzeit pro Tag muss zwischen 10 und 240 Minuten liegen.')
  if (e.availableWeekdays.length === 0) throw new ValidationError('Wähle mindestens einen Wochentag, an dem du lernen kannst.')
  const id = e.id ?? uid('exam')
  const existing = e.id ? await db.exams.get(e.id) : undefined
  await db.exams.put({
    ...e, id, title, notes: e.notes.trim(), plan: existing?.plan ?? [], planWarnings: existing?.planWarnings ?? [],
    planGeneratedAt: existing?.planGeneratedAt ?? null, createdAt: existing?.createdAt ?? nowIso(),
  })
  return id
}

export async function deleteExam(id: ID) {
  await db.transaction('rw', db.exams, db.teacherGrades, db.events, async () => {
    // planner blocks for this exam go with it; the student's own entries stay (unlinked)
    await db.events.where('examId').equals(id).filter((e) => e.source === 'planner' && !e.pinned).delete()
    await db.events.where('examId').equals(id).modify({ examId: null })
    await db.exams.delete(id)
    await db.teacherGrades.filter((g) => g.examId === id).modify({ examId: null })
  })
}

export async function setExamPlan(id: ID, plan: PlanSession[], warnings: string[]) {
  await db.exams.update(id, { plan, planWarnings: warnings, planGeneratedAt: nowIso() })
}

async function markPlanSessionInternal(examId: ID, sessionId: ID, done: boolean, attemptId: ID | null, now: Date) {
  const exam = await db.exams.get(examId)
  if (!exam) return
  const s = exam.plan.find((p) => p.id === sessionId)
  if (!s) return
  const becameDone = done && !s.done
  const plan = exam.plan.map((p) => (p.id === sessionId ? { ...p, done, doneAt: done ? now.toISOString() : null, attemptId: attemptId ?? p.attemptId } : p))
  await db.exams.update(examId, { plan })
  if (becameDone) await db.xpEvents.add({ id: uid('xp'), at: now.toISOString(), day: dayKey(now), amount: XP_RULES.planSession, reason: 'Lernplan-Einheit', refId: sessionId })
  if (!done) await db.xpEvents.filter((x) => x.refId === sessionId && x.reason === 'Lernplan-Einheit').delete()
}

export async function markPlanSession(examId: ID, sessionId: ID, done: boolean, now: Date = new Date()) {
  await db.transaction('rw', db.exams, db.xpEvents, () => markPlanSessionInternal(examId, sessionId, done, null, now))
}

export async function saveTeacherGrade(g: Omit<TeacherGrade, 'id' | 'createdAt'> & { id?: ID }): Promise<ID> {
  const title = requireText(g.title, 'Die Bezeichnung', 120)
  const grade = requireText(g.grade, 'Die Note', 10)
  if (!/^([1-6][+-]?|[1-6][.,]\d{1,2})$/.test(grade.replace(/\s/g, ''))) throw new ValidationError('Bitte gib eine Note von 1 bis 6 an (z. B. „2-“ oder „3“).')
  const id = g.id ?? uid('grade')
  const existing = g.id ? await db.teacherGrades.get(g.id) : undefined
  await db.teacherGrades.put({ ...g, id, title, grade: grade.replace(/\s/g, ''), createdAt: existing?.createdAt ?? nowIso() })
  return id
}

export async function deleteTeacherGrade(id: ID) {
  await db.teacherGrades.delete(id)
}

// ───────────────────────── Tutor chats ─────────────────────────

export async function saveChat(chat: TutorChat) {
  await db.tutorChats.put({ ...chat, updatedAt: nowIso() })
}

export async function deleteChat(id: ID) {
  await db.tutorChats.delete(id)
}

// ───────────────────────── Achievements ─────────────────────────

export async function unlockAchievements(keys: string[]): Promise<string[]> {
  const fresh: string[] = []
  await db.transaction('rw', db.achievements, async () => {
    for (const k of keys) {
      if (!(await db.achievements.get(k))) {
        await db.achievements.add({ id: k, unlockedAt: nowIso() })
        fresh.push(k)
      }
    }
  })
  return fresh
}

// ───────────────────────── Meta ─────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}

/** Self-assessment after an exam: the student judges a free-text answer; the attempt score is recalculated. */
export async function regradeAnswer(answerId: ID, score: 0 | 0.5 | 1) {
  await db.transaction('rw', db.answers, db.attempts, async () => {
    const a = await db.answers.get(answerId)
    if (!a) throw new ValidationError('Antwort nicht gefunden.')
    await db.answers.update(answerId, { score, correct: score >= 1, selfAssessed: true })
    const att = await db.attempts.get(a.attemptId)
    if (!att) return
    const answers = await db.answers.where('attemptId').equals(att.id).toArray()
    const latest = new Map<string, Answer>()
    for (const x of answers.sort((p, q) => p.at.localeCompare(q.at))) latest.set(x.questionId, x)
    let total = 0
    for (const q of att.questionSnapshots) total += (latest.get(q.id)?.score ?? 0) * q.points
    total = Math.round(total * 2) / 2
    const percent = att.maxScore > 0 ? (total / att.maxScore) * 100 : 0
    const scale = await getScale(att.gradingScaleId)
    await db.attempts.update(att.id, { score: total, percent, estimatedGrade: percentToGrade(percent, scale).grade })
  })
}
