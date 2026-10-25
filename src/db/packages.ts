import { db } from './index'
import type { Card, Deck, ID, Note, Question, Subject, Topic } from './types'
import { createAttempt, getMeta, ValidationError } from './repo'
import { nowIso, uid } from '@/lib/id'
import { newSrs } from '@/lib/srs'
import { pushUndo } from '@/lib/undo'
import { DIFFICULTY_NUM, LEVEL_LABEL, countPackage, type LearningPackage, type PkgDifficulty, type PkgExample } from '@/lib/packages/schema'
import type { Extra } from '@/lib/packages/validate'

/**
 * Imports a learning package into the normal Study OS records – so quizzes, flashcards, notes, the study planner
 * and the cloud sync work without any special cases:
 *   notes/examples/key terms/mistakes/summary → notes of the topic · questions + exercises → questions of the topic
 *   flashcards (+ key terms if wanted) → one deck of the topic · exam questions → tag "pruefung" (exam mode)
 * Every record gets a stable ID derived from the package ID and the item, so importing the same package again
 * creates nothing twice and never overwrites what the student changed.
 */

export const PACKAGE_REGISTRY_KEY = 'learningPackages'

export interface PackageRecord {
  id: string
  title: string
  subject: string
  topic: string
  subjectId: ID
  topicId: ID
  level?: string
  examTitle?: string
  timeLimitMinutes?: number
  firstImportedAt: string
  lastImportedAt: string
  imports: number
}

export async function getPackageRegistry(): Promise<Record<string, PackageRecord>> {
  return (await getMeta<Record<string, PackageRecord>>(PACKAGE_REGISTRY_KEY)) ?? {}
}

// ───────────────────────── Stable IDs ─────────────────────────

/** FNV-1a (two seeds → ~64 bit) in base 36 – short, stable, no crypto needed. */
export function stableHash(s: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x9e3779b9
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0
  }
  return a.toString(36) + b.toString(36)
}
const rid = (pkgId: string, kind: string, key: string) => `lp_${stableHash(pkgId)}_${kind}_${stableHash(key)}`

// ───────────────────────── Notes (Markdown) ─────────────────────────

function exampleMarkdown(e: PkgExample): string {
  const out: string[] = []
  if (e.task) out.push('**Aufgabe**', '', e.task, '')
  if (e.steps?.length) {
    out.push('**Lösungsweg – Schritt für Schritt**', '')
    e.steps.forEach((s, i) => out.push(`${i + 1}. ${s.step}${s.why ? `  \n   *Warum das stimmt:* ${s.why}` : ''}`))
    out.push('')
  }
  if (e.result) out.push('**Ergebnis**', '', e.result, '')
  if (e.content) out.push(e.content)
  return out.join('\n').trim()
}

function overviewMarkdown(p: LearningPackage): string {
  const c = countPackage(p)
  const out: string[] = []
  if (p.description) out.push(p.description, '')
  const meta = [p.level && `**Stufe:** ${p.level}`, p.author && `**Autor:** ${p.author}`].filter(Boolean)
  if (meta.length) out.push(meta.join(' · '), '')
  if (p.objectives?.length) out.push('### Lernziele', 'Nach diesem Thema kannst du …', ...p.objectives.map((o) => `- ${o}`), '')
  const parts = [
    c.notes - c.examples && `${c.notes - c.examples} Erklärung${c.notes - c.examples === 1 ? '' : 'en'}`, c.examples && `${c.examples} Beispiel${c.examples === 1 ? '' : 'e'}`,
    c.keyTerms && `${c.keyTerms} Fachbegriffe`, c.questions && `${c.questions} Fragen`, c.exercises && `${c.exercises} Übungen`, c.flashcards && `${c.flashcards} Karteikarten`,
    c.mistakes && `${c.mistakes} typische Fehler`, c.hasSummary && 'Lernzettel',
  ].filter(Boolean)
  out.push('### Inhalt des Lernpakets', parts.join(' · '), '')
  if (p.sources?.length) out.push('### Quellen', ...p.sources.map((s) => `- ${s}`), '')
  out.push(`*Importiert aus dem Lernpaket „${p.title}“ (ID ${p.id}).*`)
  return out.join('\n').trim()
}

function exercisesMarkdown(p: LearningPackage): string {
  const ex = p.exercises ?? []
  const out: string[] = ['Die Aufgaben findest du auch im Quiz dieses Themas (Schwierigkeit leicht → schwer). Versuche sie erst selbst – die Lösungen stehen unten.', '']
  const levels: PkgDifficulty[] = ['easy', 'medium', 'hard']
  let n = 0
  const numbered = new Map<object, number>()
  for (const l of levels) {
    const list = ex.filter((e) => e.level === l)
    if (!list.length) continue
    out.push(`### ${LEVEL_LABEL[l][0].toUpperCase()}${LEVEL_LABEL[l].slice(1)}`, '')
    for (const e of list) {
      numbered.set(e, ++n)
      out.push(`**Aufgabe ${n}.** ${e.prompt}`, '')
    }
  }
  out.push('---', '', '### Lösungen', '')
  for (const e of ex) {
    out.push(`**Aufgabe ${numbered.get(e)}** (${LEVEL_LABEL[e.level]})`, '', e.solution, '')
    if (e.steps?.length) out.push(...e.steps.map((s, i) => `${i + 1}. ${s}`), '')
    out.push(`*Erklärung:* ${e.explanation}`, '')
  }
  return out.join('\n').trim()
}

// ───────────────────────── Import ─────────────────────────

export interface ImportTarget {
  subject: { id: ID } | { create: string }
  topic: { id: ID } | { create: string }
}

export interface ImportOptions {
  /** Also turn key terms into flashcards. */
  termsAsCards: boolean
  /** Add the topic to this exam, so the study plan covers it. */
  examId?: ID | null
  extras?: Extra[]
}

export interface ImportCounts {
  notes: number
  questions: number
  exercises: number
  flashcards: number
}

export interface ImportSummary {
  packageId: string
  subjectId: ID
  topicId: ID
  deckId: ID | null
  subjectCreated: boolean
  topicCreated: boolean
  created: ImportCounts
  skipped: ImportCounts
  examQuestionIds: ID[]
  addedToExam: boolean
  alreadyImported: boolean
}

export async function importPackage(p: LearningPackage, target: ImportTarget, opts: ImportOptions): Promise<ImportSummary> {
  if (!p.id) throw new ValidationError('Das Paket hat keine ID.')
  const registry = await getPackageRegistry()
  const now = Date.now()
  const iso = (offsetMs = 0) => new Date(now - offsetMs).toISOString()
  const created: ImportCounts = { notes: 0, questions: 0, exercises: 0, flashcards: 0 }
  const skipped: ImportCounts = { notes: 0, questions: 0, exercises: 0, flashcards: 0 }
  const createdIds: { table: 'notes' | 'questions' | 'cards' | 'decks' | 'topics' | 'subjects'; id: ID }[] = []
  let summary: ImportSummary | null = null
  const before = { exam: opts.examId ? await db.exams.get(opts.examId) : undefined, registry }

  await db.transaction('rw', [db.subjects, db.topics, db.notes, db.questions, db.decks, db.cards, db.exams, db.meta], async () => {
    // ── subject & topic ──
    let subjectCreated = false
    let subject: Subject | undefined
    if ('id' in target.subject) subject = await db.subjects.get(target.subject.id)
    else {
      const name = target.subject.create.trim()
      if (!name) throw new ValidationError('Bitte gib einen Namen für das Fach an.')
      const all = await db.subjects.toArray()
      subject = all.find((s) => s.name.toLowerCase() === name.toLowerCase())
      if (!subject) {
        subject = { id: uid('sub'), name: name.slice(0, 60), color: all.length % 10, order: all.length, createdAt: nowIso() }
        await db.subjects.add(subject)
        createdIds.push({ table: 'subjects', id: subject.id })
        subjectCreated = true
      }
    }
    if (!subject) throw new ValidationError('Das gewählte Fach gibt es nicht mehr.')
    let topicCreated = false
    let topic: Topic | undefined
    if ('id' in target.topic) {
      topic = await db.topics.get(target.topic.id)
      if (topic && topic.subjectId !== subject.id) throw new ValidationError('Das gewählte Thema gehört zu einem anderen Fach.')
      if (topic && !topic.description && p.description) await db.topics.update(topic.id, { description: p.description.slice(0, 2000) })
    } else {
      const name = target.topic.create.trim().slice(0, 120)
      if (!name) throw new ValidationError('Bitte gib einen Namen für das Thema an.')
      const siblings = await db.topics.where('subjectId').equals(subject.id).filter((t) => t.parentId === null).count()
      topic = { id: uid('top'), subjectId: subject.id, parentId: null, name, description: (p.description ?? '').slice(0, 2000), order: siblings, prerequisiteIds: [], curriculum: 'own', createdAt: nowIso() }
      await db.topics.add(topic)
      createdIds.push({ table: 'topics', id: topic.id })
      topicCreated = true
    }
    if (!topic) throw new ValidationError('Das gewählte Thema gibt es nicht mehr.')
    const subjectId = subject.id
    const topicId = topic.id
    const baseTags = ['lernpaket', `lp:${p.id}`]

    // ── notes (newest first in lists → reading order via timestamps) ──
    const notes: Note[] = []
    const note = (kind: string, key: string, title: string, content: string, part: string) => {
      const t = iso(notes.length * 1000)
      notes.push({ id: rid(p.id, kind, key), subjectId, topicId, title: title.slice(0, 200), content, tags: [...baseTags, `lp-teil:${part}`], sourceMaterialId: null, createdAt: t, updatedAt: t })
    }
    note('ov', 'overview', `Überblick: ${p.topic}`, overviewMarkdown(p), 'ueberblick')
    if (p.summary) note('sum', 'summary', `Lernzettel: ${p.topic}`, p.summary, 'zusammenfassung')
    for (const n of p.notes ?? []) note('note', n.id ?? `${n.title}\n${n.content}`, n.title, n.content, 'notiz')
    for (const e of p.examples ?? []) note('ex', e.id ?? `${e.title}\n${exampleMarkdown(e)}`, `Beispiel: ${e.title}`, exampleMarkdown(e), 'beispiel')
    if (p.keyTerms?.length) note('terms', 'terms', `Fachbegriffe: ${p.topic}`, p.keyTerms.map((k) => `- **${k.term}:** ${k.definition}${k.example ? `  \n  *Beispiel:* ${k.example}` : ''}`).join('\n'), 'fachbegriffe')
    if (p.exercises?.length) note('exl', 'exercises', `Übungsaufgaben: ${p.topic}`, exercisesMarkdown(p), 'uebungen')
    if (p.mistakes?.length) note('mis', 'mistakes', `Typische Fehler: ${p.topic}`, p.mistakes.map((m) => `- **Fehler:** ${m.mistake}${m.why ? `  \n  *Warum:* ${m.why}` : ''}  \n  **So vermeidest du ihn:** ${m.fix}`).join('\n'), 'fehler')
    for (const [i, x] of (opts.extras ?? []).entries()) note('extra', `${x.where}\n${i}`, `Zusätzliche Angabe: ${x.where}`, `Dieses Feld gehört nicht zum Lernpaket-Format und wurde deshalb hier aufbewahrt:\n\n\`\`\`json\n${JSON.stringify(x.value, null, 2)}\n\`\`\``, 'zusatz')

    // ── questions & exercises ──
    const examIds = new Set(p.exam?.questionIds ?? [])
    const questions: Question[] = []
    const examQuestionIds: ID[] = []
    for (const q of p.questions ?? []) {
      const id = rid(p.id, 'q', q.id ?? JSON.stringify(q))
      const exam = !!q.exam || (!!q.id && examIds.has(q.id))
      if (exam) examQuestionIds.push(id)
      const base = {
        id, subjectId, topicId, prompt: q.prompt, explanation: q.explanation, hints: q.hints ?? [], difficulty: DIFFICULTY_NUM[q.difficulty ?? 'medium'],
        source: 'import' as const, tags: [...baseTags, ...(exam ? ['pruefung'] : [])], createdAt: iso(),
      }
      if (q.type === 'multiple-choice') questions.push({ ...base, type: 'mc', options: q.options, correctIndex: q.correct, optionFeedback: q.optionExplanations, answer: q.options[q.correct] ?? '', points: 1 })
      else if (q.type === 'true-false') questions.push({ ...base, type: 'tf', correctBool: q.correct, answer: q.correct ? 'Wahr' : 'Falsch', points: 1 })
      else if (q.type === 'open') questions.push({ ...base, type: 'text', answer: q.solution, keywords: q.keywords, steps: q.steps, points: 2 })
      else questions.push({ ...base, type: 'numeric', answer: String(q.answer), unit: q.unit, tolerance: q.tolerance, steps: q.steps, points: 2 })
    }
    const exerciseQs: Question[] = (p.exercises ?? []).map((e) => {
      const d = DIFFICULTY_NUM[e.level]
      const base = {
        id: rid(p.id, 'ue', e.id ?? JSON.stringify(e)), subjectId, topicId, prompt: e.prompt, explanation: e.explanation, hints: [], steps: e.steps, difficulty: d, points: d,
        source: 'import' as const, tags: [...baseTags, 'uebung', `stufe:${e.level}`], createdAt: iso(),
      }
      return e.answer !== undefined
        ? { ...base, type: 'numeric' as const, answer: String(e.answer), unit: e.unit, tolerance: e.tolerance, explanation: `${e.solution}\n\n${e.explanation}` }
        : { ...base, type: 'text' as const, answer: e.solution }
    })

    // ── flashcards ──
    const cardInputs = [
      ...(p.flashcards ?? []).map((f) => ({ key: `card\n${f.front}\n${f.back}`, front: f.front, back: f.back, example: f.example ?? '', tags: [...baseTags] })),
      ...(opts.termsAsCards ? (p.keyTerms ?? []).map((k) => ({ key: `term\n${k.term}`, front: k.term, back: k.definition, example: k.example ?? '', tags: [...baseTags, 'fachbegriff'] })) : []),
    ]
    let deckId: ID | null = null
    if (cardInputs.length) {
      deckId = rid(p.id, 'deck', 'deck')
      if (!(await db.decks.get(deckId))) {
        const deck: Deck = { id: deckId, subjectId, topicId, name: `${p.topic} – Karteikarten`.slice(0, 100), description: `Aus dem Lernpaket „${p.title}“.`, frontLang: null, backLang: p.language ? (p.language.includes('-') ? p.language : `${p.language}-${p.language.toUpperCase()}`) : 'de-DE', createdAt: nowIso() }
        await db.decks.add(deck)
        createdIds.push({ table: 'decks', id: deckId })
      }
    }
    const nowDate = new Date(now)
    const cards: Card[] = cardInputs.map((c) => ({ id: rid(p.id, 'card', c.key), deckId: deckId!, topicId, front: c.front, back: c.back, example: c.example, tags: c.tags, srs: newSrs(nowDate), sourceMaterialId: null, createdAt: iso(), updatedAt: iso() }))

    // ── write only what does not exist yet: same stable ID, or the same content already in this topic ──
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
    const sig: Record<'notes' | 'questions' | 'cards', (r: never) => string> = {
      notes: (r: Note) => `${norm(r.title)}\n${norm(r.content)}`,
      questions: (r: Question) => `${r.type}\n${norm(r.prompt)}`,
      cards: (r: Card) => `${norm(r.front)}\n${norm(r.back)}`,
    }
    const inTopic = {
      notes: new Set((await db.notes.where('topicId').equals(topicId).toArray()).map((r) => sig.notes(r as never))),
      questions: new Set((await db.questions.where('topicId').equals(topicId).toArray()).map((r) => sig.questions(r as never))),
      cards: new Set((await db.cards.where('topicId').equals(topicId).toArray()).map((r) => sig.cards(r as never))),
    }
    // generated notes (overview, exercise sheet) exist once per topic
    const topicParts = new Set<string>((await db.notes.where('topicId').equals(topicId).toArray()).flatMap((x) => x.tags.filter((t) => t === 'lp-teil:ueberblick' || t === 'lp-teil:uebungen')))
    const fresh = async <T extends { id: ID }>(table: 'notes' | 'questions' | 'cards', rows: T[], key: keyof ImportCounts) => {
      const existing = await db.table(table).bulkGet(rows.map((r) => r.id))
      const add = rows.filter((r, i) => {
        if (existing[i]) return false
        if (table === 'notes' && (r as unknown as Note).tags.some((t) => topicParts.has(t))) return false
        const k = sig[table](r as never)
        if (inTopic[table].has(k)) return false
        inTopic[table].add(k)
        return true
      })
      if (add.length) await db.table(table).bulkAdd(add)
      created[key] += add.length
      skipped[key] += rows.length - add.length
      for (const r of add) createdIds.push({ table, id: r.id })
    }
    await fresh('notes', notes, 'notes')
    await fresh('questions', questions, 'questions')
    await fresh('questions', exerciseQs, 'exercises')
    await fresh('cards', cards, 'flashcards')

    // ── study planner: link the topic to an upcoming exam ──
    let addedToExam = false
    if (opts.examId) {
      const exam = await db.exams.get(opts.examId)
      if (!exam || exam.subjectId !== subjectId) throw new ValidationError('Die gewählte Prüfung gehört nicht zu diesem Fach.')
      if (!exam.topicIds.includes(topicId)) {
        await db.exams.update(exam.id, { topicIds: [...exam.topicIds, topicId] })
        addedToExam = true
      }
    }

    const prev = registry[p.id]
    const rec: PackageRecord = {
      id: p.id, title: p.title, subject: p.subject, topic: p.topic, subjectId, topicId, level: p.level, examTitle: p.exam?.title, timeLimitMinutes: p.exam?.timeLimitMinutes,
      firstImportedAt: prev?.firstImportedAt ?? nowIso(), lastImportedAt: nowIso(), imports: (prev?.imports ?? 0) + 1,
    }
    await db.meta.put({ key: PACKAGE_REGISTRY_KEY, value: { ...registry, [p.id]: rec } })
    summary = { packageId: p.id, subjectId, topicId, deckId, subjectCreated, topicCreated, created, skipped, examQuestionIds, addedToExam, alreadyImported: !!prev }
  })

  pushUndo('Lernpaket importiert', async () => {
    await db.transaction('rw', [db.subjects, db.topics, db.notes, db.questions, db.decks, db.cards, db.exams, db.meta], async () => {
      for (const c of [...createdIds].reverse()) await db.table(c.table).delete(c.id)
      if (before.exam) await db.exams.put(before.exam)
      await db.meta.put({ key: PACKAGE_REGISTRY_KEY, value: before.registry })
    })
  })
  return summary!
}

/** Exam mode for a topic: all questions marked for the exam (from learning packages), without hints. */
export async function startTopicExam(topicId: ID): Promise<ID> {
  const topic = await db.topics.get(topicId)
  if (!topic) throw new ValidationError('Thema nicht gefunden.')
  const qs = await db.questions.where('topicId').equals(topicId).filter((q) => !!q.tags?.includes('pruefung')).toArray()
  if (!qs.length) throw new ValidationError('Für dieses Thema gibt es keine Prüfungsfragen.')
  const rec = Object.values(await getPackageRegistry()).find((r) => r.topicId === topicId)
  return createAttempt({ kind: 'mock', mode: 'exam', title: rec?.examTitle ?? `Prüfung: ${topic.name}`, subjectId: topic.subjectId, topicIds: [topicId], questions: qs, timeLimitMin: rec?.timeLimitMinutes })
}
