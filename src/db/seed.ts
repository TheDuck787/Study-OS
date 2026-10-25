import { db } from './index'
import type { Card, Deck, Question, Subject, Topic } from './types'
import { CURRICULUM, flattenTopics } from '@/content/curriculum'
import { ALL_LIBRARY_QUESTIONS } from '@/content/questions'
import { VOCAB_DECKS } from '@/content/vocab'
import { newSrs } from '@/lib/srs'
import { nowIso } from '@/lib/id'
import { ensureGradingScales, setMeta } from './repo'

export const subjectIdFor = (key: string) => `sub-${key}`
export const libQuestionId = (key: string) => `lib-${key}`

/**
 * Adds the example curriculum (marked as unverified), the matching library questions and
 * example vocabulary decks for the chosen subjects. Existing items are never overwritten,
 * so running it again only adds what is missing (e.g. after deleting by accident).
 */
export async function seedLibrary(subjectKeys: string[], opts: { includeTopics?: boolean; includeQuestions?: boolean; includeVocab?: boolean } = {}) {
  const { includeTopics = true, includeQuestions = true, includeVocab = true } = opts
  await ensureGradingScales()
  const now = nowIso()
  const existingSubjects = await db.subjects.toArray()
  let order = existingSubjects.length
  const added = { subjects: 0, topics: 0, questions: 0, cards: 0 }

  await db.transaction('rw', [db.subjects, db.topics, db.questions, db.decks, db.cards], async () => {
    for (const cs of CURRICULUM.filter((c) => subjectKeys.includes(c.key))) {
      const sid = subjectIdFor(cs.key)
      const byName = existingSubjects.find((s) => s.name.toLowerCase() === cs.name.toLowerCase() && s.id !== sid)
      if (byName) continue // student already has their own subject with this name – don't duplicate
      if (!(await db.subjects.get(sid))) {
        const subject: Subject = { id: sid, name: cs.name, color: cs.color, order: order++, createdAt: now }
        await db.subjects.add(subject)
        added.subjects++
      }
      if (includeTopics) {
        const flat = flattenTopics(cs.topics)
        for (let i = 0; i < flat.length; i++) {
          const t = flat[i]
          if (await db.topics.get(t.key)) continue
          const topic: Topic = {
            id: t.key, subjectId: sid, parentId: t.parent, name: t.name, description: t.description, order: i,
            prerequisiteIds: t.prereq ?? [], curriculum: 'example-unverified', createdAt: now,
          }
          await db.topics.add(topic)
          added.topics++
        }
      }
      if (includeQuestions) {
        for (const lq of ALL_LIBRARY_QUESTIONS.filter((q) => q.topic.startsWith(`${cs.key}-`))) {
          const id = libQuestionId(lq.key)
          if (await db.questions.get(id)) continue
          if (!(await db.topics.get(lq.topic))) continue
          const { key: _key, topic, ...rest } = lq
          const q: Question = { ...rest, id, subjectId: sid, topicId: topic, source: 'library', createdAt: now }
          await db.questions.add(q)
          added.questions++
        }
      }
      if (includeVocab) {
        for (const vd of VOCAB_DECKS.filter((v) => v.subject === cs.key)) {
          if (await db.decks.get(vd.key)) continue
          const deck: Deck = {
            id: vd.key, subjectId: sid, topicId: (await db.topics.get(vd.topic)) ? vd.topic : null, name: vd.name,
            description: vd.description, frontLang: vd.frontLang, backLang: vd.backLang, createdAt: now,
          }
          await db.decks.add(deck)
          const cards: Card[] = vd.cards.map(([front, back, example], i) => ({
            id: `${vd.key}-${i}`, deckId: vd.key, topicId: deck.topicId, front, back, example, tags: [], srs: newSrs(new Date()),
            sourceMaterialId: null, createdAt: now, updatedAt: now,
          }))
          await db.cards.bulkAdd(cards)
          added.cards += cards.length
        }
      }
    }
  })
  await setMeta('librarySeededAt', now)
  return added
}

/**
 * Removes the example content again: library questions (with their answers), unchanged example
 * vocabulary cards and example topics. Everything the student made stays. An example topic that
 * still holds own notes, cards, questions, materials or own subtopics is kept (and marked as own).
 */
export async function removeExampleContent() {
  const removed = { topics: 0, questions: 0, cards: 0, decks: 0, keptTopics: 0 }
  const tables = [db.topics, db.questions, db.answers, db.decks, db.cards, db.cardReviews, db.notes, db.materials, db.exams]
  await db.transaction('rw', tables, async () => {
    const libIds = (await db.questions.where('source').equals('library').primaryKeys()) as string[]
    await db.answers.where('questionId').anyOf(libIds).delete()
    await db.questions.bulkDelete(libIds)
    removed.questions = libIds.length

    for (const vd of VOCAB_DECKS) {
      const deck = await db.decks.get(vd.key)
      if (!deck) continue
      const exampleCards = await db.cards.where('deckId').equals(vd.key).filter((c) => c.id.startsWith(`${vd.key}-`)).primaryKeys()
      await db.cards.bulkDelete(exampleCards as string[])
      await db.cardReviews.where('cardId').anyOf(exampleCards as string[]).delete()
      removed.cards += exampleCards.length
      if ((await db.cards.where('deckId').equals(vd.key).count()) === 0) {
        await db.decks.delete(vd.key)
        removed.decks++
      }
    }

    const examples = (await db.topics.toArray()).filter((t) => t.curriculum === 'example-unverified')
    const remaining = new Set(examples.map((t) => t.id))
    // deepest topics first, so a parent only goes once its subtopics are gone
    const depth = (id: string | null, d = 0): number => (id ? depth(examples.find((t) => t.id === id)?.parentId ?? null, d + 1) : d)
    for (const t of [...examples].sort((a, b) => depth(b.parentId) - depth(a.parentId))) {
      const [questions, notes, cards, decks, materials, children] = await Promise.all([
        db.questions.where('topicId').equals(t.id).count(),
        db.notes.where('topicId').equals(t.id).count(),
        db.cards.where('topicId').equals(t.id).count(),
        db.decks.where('topicId').equals(t.id).count(),
        db.materials.where('topicId').equals(t.id).count(),
        db.topics.where('parentId').equals(t.id).filter((c) => remaining.has(c.id) || c.curriculum !== 'example-unverified').count(),
      ])
      if (questions + notes + cards + decks + materials + children > 0) {
        await db.topics.update(t.id, { curriculum: 'own' })
        remaining.delete(t.id)
        removed.keptTopics++
        continue
      }
      await db.answers.where('topicId').equals(t.id).delete()
      await db.topics.delete(t.id)
      remaining.delete(t.id)
      removed.topics++
    }
    const gone = new Set(examples.map((t) => t.id).filter((id) => !remaining.has(id)))
    const kept = await db.topics.toArray()
    for (const t of kept) if (t.prerequisiteIds.some((p) => gone.has(p))) await db.topics.update(t.id, { prerequisiteIds: t.prerequisiteIds.filter((p) => !gone.has(p)) })
    await db.exams.toCollection().modify((e) => {
      e.topicIds = e.topicIds.filter((id) => !gone.has(id))
      e.plan = e.plan.map((p) => ({ ...p, topicIds: p.topicIds.filter((id) => !gone.has(id)) }))
    })
  })
  return removed
}
