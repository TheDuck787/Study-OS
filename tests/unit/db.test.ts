import { beforeEach, describe, expect, it } from 'vitest'
import { useTestDatabase, db } from '@/db/index'
import * as repo from '@/db/repo'
import { removeExampleContent, seedLibrary, subjectIdFor } from '@/db/seed'
import { seedDemo } from '@/db/demo'
import { ALL_LIBRARY_QUESTIONS } from '@/content/questions'
import { CURRICULUM, flattenTopics } from '@/content/curriculum'
import { checkAnswer } from '@/lib/answerCheck'
import { checkBackup, exportBackup, restoreBackup } from '@/lib/backup'
import { generateQuestion } from '@/lib/mathgen'

let n = 0
beforeEach(async () => {
  useTestDatabase(`test-${n++}`)
  await repo.saveProfile({ name: 'Test' })
})

describe('library content', () => {
  it('every library question accepts its own answer and points to an existing topic', () => {
    const topicKeys = new Set(CURRICULUM.flatMap((s) => flattenTopics(s.topics).map((t) => t.key)))
    const keys = new Set<string>()
    for (const q of ALL_LIBRARY_QUESTIONS) {
      expect(keys.has(q.key), `duplicate key ${q.key}`).toBe(false)
      keys.add(q.key)
      expect(topicKeys.has(q.topic), `${q.key} → unknown topic ${q.topic}`).toBe(true)
      const given = q.type === 'mc' ? String(q.correctIndex) : q.type === 'tf' ? String(q.correctBool) : q.answer
      const r = checkAnswer({ ...q, id: q.key, subjectId: 's', topicId: q.topic, source: 'library', createdAt: '' }, given)
      expect(r.correct, `${q.key}: ${r.status} ${r.feedback}`).toBe(true)
      if (q.type === 'mc') expect(q.optionFeedback === undefined || q.optionFeedback.length === q.options!.length, `${q.key} feedback length`).toBe(true)
    }
    expect(ALL_LIBRARY_QUESTIONS.length).toBeGreaterThan(150)
  })
  it('prerequisites reference existing topics', () => {
    for (const s of CURRICULUM) {
      const keys = new Set(flattenTopics(s.topics).map((t) => t.key))
      for (const t of flattenTopics(s.topics)) for (const p of t.prereq ?? []) expect(keys.has(p), `${t.key} → ${p}`).toBe(true)
    }
  })
})

describe('seeding', () => {
  it('seeds subjects, unverified topics, questions and decks; re-running adds nothing', async () => {
    const a = await seedLibrary(['ma', 'en'])
    expect(a.subjects).toBe(2)
    expect(a.topics).toBeGreaterThan(10)
    expect(a.cards).toBeGreaterThan(20)
    const topics = await db.topics.toArray()
    expect(topics.every((t) => t.curriculum === 'example-unverified')).toBe(true)
    const b = await seedLibrary(['ma', 'en'])
    expect(b).toEqual({ subjects: 0, topics: 0, questions: 0, cards: 0 })
  })
  it('does not duplicate a subject the student already created with the same name', async () => {
    await repo.createSubject('Mathematik')
    await seedLibrary(['ma'])
    expect((await db.subjects.toArray()).filter((s) => s.name === 'Mathematik')).toHaveLength(1)
  })
})

describe('removing example content', () => {
  it('deletes example topics, questions and vocab but keeps everything the student made', async () => {
    await seedLibrary(['ma', 'en'])
    const sid = subjectIdFor('ma')
    const exampleTopics = await db.topics.where('subjectId').equals(sid).toArray()
    const leaf = exampleTopics.find((t) => !exampleTopics.some((c) => c.parentId === t.id))!
    const ownTopic = await repo.createTopic(sid, 'Mein eigenes Thema')
    await repo.saveNote({ title: 'Meine Notiz', content: 'Text', subjectId: sid, topicId: leaf.id })
    const deck = (await db.decks.toArray())[0]
    await repo.addCards(deck.id, [{ front: 'eigene Karte', back: 'own card' }])
    const ownDeck = await repo.saveDeck({ name: 'Mein Stapel', subjectId: sid })
    await repo.addCards(ownDeck, [{ front: 'a', back: 'b' }])

    const r = await removeExampleContent()
    expect(r.topics).toBeGreaterThan(5)
    expect(r.questions).toBeGreaterThan(10)
    expect(r.keptTopics).toBeGreaterThanOrEqual(1)

    expect(await db.questions.where('source').equals('library').count()).toBe(0)
    expect(await db.subjects.count()).toBe(2) // subjects stay
    const enTopics = await db.topics.where('subjectId').equals(subjectIdFor('en')).toArray()
    // kept: the topic with the own note, the example deck's topic (it still holds an own card), their parents, the own topic
    const expected = new Set([ownTopic, ...collectParents(exampleTopics, leaf.id), ...(deck.topicId ? collectParents(enTopics, deck.topicId) : [])])
    const left = await db.topics.toArray()
    expect(left.map((t) => t.id).sort()).toEqual([...expected].sort())
    expect(left.every((t) => t.curriculum === 'own')).toBe(true)
    expect(left.flatMap((t) => t.prerequisiteIds).every((p) => left.some((t) => t.id === p))).toBe(true)
    // the example deck survives only because of the student's own card
    expect((await db.cards.where('deckId').equals(deck.id).toArray()).map((c) => c.front)).toEqual(['eigene Karte'])
    expect(await db.cards.where('deckId').equals(ownDeck).count()).toBe(1)
    expect(await db.notes.count()).toBe(1)
    // running it again changes nothing
    expect(await removeExampleContent()).toEqual({ topics: 0, questions: 0, cards: 0, decks: 0, keptTopics: 0 })
  })
})

function collectParents(topics: { id: string; parentId: string | null }[], id: string): string[] {
  const t = topics.find((x) => x.id === id)
  return t ? [id, ...(t.parentId ? collectParents(topics, t.parentId) : [])] : []
}

describe('subjects and topics', () => {
  it('validates names and prevents duplicates', async () => {
    await expect(repo.createSubject('  ')).rejects.toThrow(/leer/)
    await repo.createSubject('Kunst')
    await expect(repo.createSubject('kunst')).rejects.toThrow(/gibt es schon/)
  })
  it('deleting a topic removes subtopics, questions and answers but keeps notes', async () => {
    const s = await repo.createSubject('Physik')
    const t = await repo.createTopic(s, 'Optik')
    const sub = await repo.createTopic(s, 'Linsen', { parentId: t })
    const qid = await repo.saveQuestion({ subjectId: s, topicId: sub, type: 'tf', prompt: 'Licht ist schnell', correctBool: true, answer: 'Wahr', explanation: '', hints: [], difficulty: 1, points: 1, source: 'user' })
    const note = await repo.saveNote({ title: 'Notiz', content: 'x', subjectId: s, topicId: sub })
    expect((await repo.topicDeletionImpact(t)).subtopics).toBe(1)
    await repo.deleteTopic(t)
    expect(await db.topics.count()).toBe(0)
    expect(await db.questions.get(qid)).toBeUndefined()
    expect((await db.notes.get(note))?.topicId).toBeNull()
  })
  it('prevents topic cycles', async () => {
    const s = await repo.createSubject('Bio')
    const a = await repo.createTopic(s, 'A')
    const b = await repo.createTopic(s, 'B', { parentId: a })
    await expect(repo.updateTopic(a, { parentId: b })).rejects.toThrow(/Unterthema/)
  })
  it('deleting a subject cascades', async () => {
    await seedLibrary(['ma'])
    const sid = subjectIdFor('ma')
    const impact = await repo.subjectDeletionImpact(sid)
    expect(impact.topics).toBeGreaterThan(5)
    await repo.deleteSubject(sid)
    expect(await db.topics.where('subjectId').equals(sid).count()).toBe(0)
    expect(await db.questions.where('subjectId').equals(sid).count()).toBe(0)
  })
})

describe('quiz flow', () => {
  it('practice: answers, XP, score, grade, session, mistakes', async () => {
    await seedLibrary(['ma'])
    const qs = await db.questions.where('topicId').equals('ma-gleichungen').toArray()
    const id = await repo.createAttempt({ kind: 'practice', mode: 'practice', title: 'Test', subjectId: subjectIdFor('ma'), topicIds: ['ma-gleichungen'], questions: qs })
    for (const [i, q] of qs.entries()) {
      const given = i === 0 ? 'falsch' : q.type === 'mc' ? String(q.correctIndex) : q.answer
      await repo.recordAnswer(id, { question: q, given, check: checkAnswer(q, given), hintsUsed: 0, timeMs: 5000 })
    }
    const sum = await repo.finishAttempt(id)
    expect(sum.attempt.finishedAt).not.toBeNull()
    expect(sum.attempt.score).toBe(qs.length - 1)
    expect(sum.attempt.estimatedGrade).toBeGreaterThanOrEqual(1)
    expect(sum.xpGained).toBeGreaterThan(0)
    expect(await db.sessions.count()).toBe(1)
    // finishing twice is harmless
    const again = await repo.finishAttempt(id)
    expect(again.xpGained).toBe(0)
  })
  it('exam mode stores answers only at submission and handles generated questions', async () => {
    await seedLibrary(['ma'])
    const q = generateQuestion('lin-eq', 2, { subjectId: subjectIdFor('ma'), topicId: 'ma-gleichungen' }, 123)
    const id = await repo.createAttempt({ kind: 'exam', mode: 'exam', title: 'Probe', subjectId: subjectIdFor('ma'), topicIds: [], questions: [q] })
    expect(await db.questions.get(q.id)).toBeDefined()
    await repo.saveDraftAnswer(id, q.id, q.answer)
    expect((await db.attempts.get(id))?.draftAnswers?.[q.id]).toBe(q.answer)
    expect(await db.answers.count()).toBe(0)
    const sum = await repo.finishAttempt(id, [{ question: q, given: q.answer, check: checkAnswer(q, q.answer), hintsUsed: 0, timeMs: 1000 }])
    expect(sum.attempt.percent).toBe(100)
    expect(await db.answers.count()).toBe(1)
  })
  it('card rating schedules and gives XP only for due cards', async () => {
    const deck = await repo.saveDeck({ name: 'Vokabeln' })
    await repo.addCards(deck, [{ front: 'dog', back: 'Hund' }, { front: '', back: 'x' }])
    const [card] = await db.cards.toArray()
    expect(await db.cards.count()).toBe(1)
    await repo.rateCard(card.id, 'good')
    await repo.rateCard(card.id, 'good') // not due anymore → no XP
    expect((await db.xpEvents.toArray()).reduce((s, e) => s + e.amount, 0)).toBe(1)
    expect(await db.cardReviews.count()).toBe(2)
  })
})

describe('exams', () => {
  it('validates input and awards XP for plan sessions once', async () => {
    const s = await repo.createSubject('Chemie')
    await expect(repo.saveExam({ subjectId: s, title: 'KA', type: 'Test', date: 'kaputt', topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [1], notes: '', gradingScaleId: null })).rejects.toThrow(/Datum/)
    const id = await repo.saveExam({ subjectId: s, title: 'KA', type: 'Test', date: '2030-01-10', topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [1], notes: '', gradingScaleId: null })
    await repo.setExamPlan(id, [{ id: 'p1', date: '2030-01-05', type: 'learn', title: 'x', description: '', topicIds: [], minutes: 20, done: false, doneAt: null, attemptId: null }], [])
    await repo.markPlanSession(id, 'p1', true)
    await repo.markPlanSession(id, 'p1', true)
    expect(await db.xpEvents.count()).toBe(1)
    await repo.markPlanSession(id, 'p1', false)
    expect(await db.xpEvents.count()).toBe(0)
  })
  it('teacher grades are validated', async () => {
    const s = await repo.createSubject('Geo')
    await expect(repo.saveTeacherGrade({ subjectId: s, examId: null, title: 'Test', grade: '7', date: '2026-01-01', note: '' })).rejects.toThrow()
    await repo.saveTeacherGrade({ subjectId: s, examId: null, title: 'Test', grade: '2-', date: '2026-01-01', note: '' })
  })
})

describe('backup', () => {
  it('round-trips all data and rejects foreign files', async () => {
    await seedLibrary(['en'])
    const json = await exportBackup(false)
    const check = checkBackup(json)
    expect(check.ok).toBe(true)
    const before = await db.cards.count()
    await db.cards.clear()
    await restoreBackup(check.backup!)
    expect(await db.cards.count()).toBe(before)
    expect(checkBackup('{"foo":1}').ok).toBe(false)
    expect(checkBackup('nope').ok).toBe(false)
  })
})

describe('demo', () => {
  it('creates a plausible history with an exam plan', async () => {
    await seedDemo(new Date('2026-10-25T12:00:00'))
    expect(await db.answers.count()).toBeGreaterThan(50)
    const exams = await db.exams.toArray()
    expect(exams.some((e) => e.plan.length > 3)).toBe(true)
    expect(await db.materials.count()).toBe(1)
    expect((await repo.getProfile())?.name).toContain('Demo')
  })
})
