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
