import { db } from '@/db/index'
import { getPackageRegistry } from '@/db/packages'
import { ValidationError } from '@/db/repo'
import { saveFile } from '@/lib/download'
import { topicToPackage } from '@/lib/packages/build'
import { packageToMarkdown } from '@/lib/packages/markdown'
import { slugify } from '@/lib/packages/validate'

/** Downloads a topic (notes, questions, exercises, flashcards) as a learning package. */
export async function exportTopicPackage(topicId: string, format: 'json' | 'markdown') {
  const topic = await db.topics.get(topicId)
  const subject = topic ? await db.subjects.get(topic.subjectId) : undefined
  if (!topic || !subject) throw new ValidationError('Thema nicht gefunden.')
  const decks = await db.decks.where('topicId').equals(topicId).toArray()
  const cards = [...(await db.cards.where('topicId').equals(topicId).toArray()), ...(await db.cards.where('deckId').anyOf(decks.map((d) => d.id)).toArray())]
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()]
  const rec = Object.values(await getPackageRegistry()).find((r) => r.topicId === topicId)
  const pkg = topicToPackage({
    subject, topic, notes: await db.notes.where('topicId').equals(topicId).toArray(), questions: await db.questions.where('topicId').equals(topicId).toArray(), cards: unique,
    packageId: rec?.id, level: rec?.level, examTitle: rec?.examTitle, timeLimitMinutes: rec?.timeLimitMinutes,
  })
  const name = `lernpaket-${slugify(`${subject.name}-${topic.name}`) || 'thema'}`
  if (format === 'json') await saveFile(`${name}.json`, `${JSON.stringify(pkg, null, 2)}\n`, 'application/json')
  else await saveFile(`${name}.md`, packageToMarkdown(pkg), 'text/markdown;charset=utf-8')
  return pkg
}
