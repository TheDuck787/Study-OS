import exampleText from '../../public/lernpakete/deutsch-textanalyse-klasse-9.json?raw'
import sachtextText from '../../public/lernpakete/deutsch-sachtextanalyse-klasse-9.json?raw'
import templateText from '../../docs/lernpakete/vorlage.json?raw'
import schemaText from '../../docs/lernpakete/lernpaket.schema.json?raw'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, useTestDatabase } from '@/db/index'
import * as repo from '@/db/repo'
import { getPackageRegistry, importPackage, startTopicExam } from '@/db/packages'
import { countPackage, type LearningPackage } from '@/lib/packages/schema'
import { parsePackageJson, validatePackage } from '@/lib/packages/validate'
import { packageToMarkdown, parsePackageFile, parsePackageMarkdown } from '@/lib/packages/markdown'
import { packagePrompt, packageTemplate, topicToPackage } from '@/lib/packages/build'
import { clearUndo, undoLast } from '@/lib/undo'
import { checkAnswer } from '@/lib/answerCheck'

const example = () => {
  const r = parsePackageJson(exampleText)
  if (!r.pkg) throw new Error(JSON.stringify(r.errors))
  return r.pkg
}
const base = (patch: Record<string, unknown> = {}) => ({ format: 'studyos-learning-package', version: 1, id: 'test-paket', title: 'Test', subject: 'Biologie', topic: 'Zelle', notes: [{ title: 'A', content: 'B' }], ...patch })

let n = 0
beforeEach(() => {
  useTestDatabase(`pkg-${++n}`)
  clearUndo()
})

describe('package: Deutsch → Sachtextanalyse, Klasse 9', () => {
  it('is valid, has exactly the requested content and imports completely with a 45-minute exam', async () => {
    const r = parsePackageJson(sachtextText)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    const p = r.pkg!
    const c = countPackage(p)
    expect([p.notes!.length, p.examples!.length, p.keyTerms!.length, c.questions, c.flashcards, p.exercises!.length, p.mistakes!.length]).toEqual([10, 3, 16, 10, 12, 6, 8])
    expect(p.exercises!.map((e) => e.level).sort()).toEqual(['easy', 'easy', 'hard', 'hard', 'medium', 'medium'])
    expect(p.exam).toMatchObject({ timeLimitMinutes: 45 })
    expect(p.summary).toBeTruthy()
    const s = await importPackage(p, { subject: { create: 'Deutsch' }, topic: { create: 'Sachtextanalyse' } }, { termsAsCards: false })
    expect(s.created.questions).toBe(10)
    expect(s.created.exercises).toBe(6)
    expect(s.created.flashcards).toBe(12)
    expect(s.examQuestionIds).toHaveLength(10)
    const attempt = await startTopicExam(s.topicId)
    expect(attempt).toBeTruthy()
  })
})

describe('example package: Deutsch → Textanalyse, Klasse 9', () => {
  it('is valid, complete and meets the content requirements', () => {
    const r = parsePackageJson(exampleText)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    const p = r.pkg!
    expect(p).toMatchObject({ subject: 'Deutsch', topic: 'Textanalyse', level: 'Klasse 9', id: 'deutsch-textanalyse-klasse-9' })
    const c = countPackage(p)
    expect(c.questions).toBeGreaterThanOrEqual(15)
    expect(c.flashcards).toBeGreaterThanOrEqual(10)
    expect(new Set(p.questions!.map((q) => q.type))).toEqual(new Set(['multiple-choice', 'true-false', 'open']))
    expect(p.questions!.every((q) => q.explanation.length > 40)).toBe(true) // real explanations, not just answers
    expect(new Set(p.exercises!.map((e) => e.level))).toEqual(new Set(['easy', 'medium', 'hard']))
    expect(c.examQuestions).toBeGreaterThan(0)
    expect(p.summary).toBeTruthy()
    expect(p.mistakes!.length).toBeGreaterThanOrEqual(5)
    const titles = p.notes!.map((x) => x.title).join(' | ')
    for (const t of ['Aufbau', 'Kurzgeschichten', 'Erzähler', 'Figuren', 'Stilmittel', 'belegen', 'Grüne Ampel']) expect(titles).toContain(t)
    expect(p.examples![0].steps!.every((s) => s.why.length > 20)).toBe(true)
  })

  it('every quotation with a line reference really appears in the original short story', () => {
    const p = example()
    const storyNote = p.notes!.find((x) => x.id === 'uebungstext')!.content
    const lines = new Map<number, string>()
    for (const m of storyNote.matchAll(/^`\s*(\d+)`\s{2}(.*)$/gm)) lines.set(Number(m[1]), m[2])
    expect(lines.size).toBe(22)
    const all = JSON.stringify(p)
    const quotes = [...all.matchAll(/„([^“]{3,200})“\s*\(Z\. (\d+)(?:\s*(f\.|ff\.)|–(\d+))?\)/g)]
    expect(quotes.length).toBeGreaterThan(30)
    const clean = (s: string) => s.replace(/[„“"]/g, '').replace(/\s+/g, ' ')
    for (const [, quote, from, f, to] of quotes) {
      const a = Number(from)
      const b = to ? Number(to) : f === 'f.' ? a + 1 : f === 'ff.' ? a + 3 : a
      const text = clean(Array.from({ length: b - a + 1 }, (_, i) => lines.get(a + i) ?? '').join(' '))
      // […] = omission, [x] = adjusted letter/word – every remaining fragment must be in the referenced lines
      for (const frag of quote.split('[…]').map((x) => x.replace(/\[([a-zäöü])\]/gi, '$1').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim()).filter(Boolean)) {
        const fragment = clean(frag)
        const ok = text.includes(fragment) || text.toLowerCase().includes(fragment.toLowerCase())
        if (!ok) throw new Error(`Zitat „${quote}“ (Z. ${from}${f ? ` ${f}` : to ? `–${to}` : ''}) nicht im Text: „${fragment}“`)
      }
    }
  })

  it('the open question with keywords is checked automatically; the others ask for self-assessment', async () => {
    await importPackage(example(), { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: false })
    const qs = await db.questions.toArray()
    const auto = qs.find((q) => q.keywords?.length)!
    expect(checkAnswer(auto, 'Die Frau sagt, der Fahrer warte immer, bis die Ampel umspringe (vgl. Z. 12).').status).toBe('correct')
    expect(checkAnswer(auto, 'Die Frau sagt, der Fahrer wartet immer.').status).not.toBe('correct')
    const open = qs.find((q) => q.type === 'text' && !q.keywords?.length)!
    expect(checkAnswer(open, 'irgendeine Antwort').status).toBe('self-assess')
  })
})

describe('validation – clear German errors, nothing silently dropped', () => {
  it('reports JSON syntax errors with line and column', () => {
    const r = parsePackageJson('{\n  "format": "studyos-learning-package",\n  "id": "x",\n}')
    expect(r.pkg).toBeNull()
    expect(r.errors[0].where).toMatch(/Zeile \d+, Spalte \d+/)
    expect(r.errors[0].message).toMatch(/kein gültiges JSON/)
  })
  it('missing required fields, wrong format, newer version, empty package', () => {
    expect(validatePackage({}).errors.map((e) => e.message).join(' ')).toMatch(/„format“ fehlt.*Fach.*fehlt.*Thema.*fehlt/s)
    expect(validatePackage(base({ format: 'anki' })).errors[0].message).toMatch(/Unbekanntes Format/)
    expect(validatePackage(base({ version: 2 })).errors[0].message).toMatch(/Version 2.*bis Version 1/)
    expect(validatePackage(base({ notes: [] })).errors[0].message).toMatch(/keine Inhalte/)
    expect(validatePackage([1, 2]).errors[0].message).toMatch(/kein Lernpaket/)
  })
  it('question checks: options, correct index, explanation, duplicate ids, exam references', () => {
    const r = validatePackage(base({
      questions: [
        { id: 'a', type: 'multiple-choice', prompt: 'P', options: ['x'], correct: 3, explanation: 'E' },
        { id: 'a', type: 'true-false', prompt: 'P', correct: true },
        { type: 'essay', prompt: 'P', explanation: 'E' },
      ],
      exam: { questionIds: ['zzz'] },
    }))
    const msgs = r.errors.map((e) => `${e.where}: ${e.message}`)
    expect(msgs).toEqual(expect.arrayContaining([
      expect.stringMatching(/Fragen Nr\. 1: Eine Auswahlfrage braucht mindestens 2/),
      expect.stringMatching(/Fragen Nr\. 1: „correct“ muss zwischen/),
      expect.stringMatching(/Fragen Nr\. 2: Die Erklärung/),
      expect.stringMatching(/Fragen Nr\. 2: Die ID „a“ kommt mehrfach vor/),
      expect.stringMatching(/Fragen Nr\. 3: Unbekannter Fragetyp „essay“/),
      expect.stringMatching(/Prüfungsmodus: Die Frage „zzz“ gibt es im Paket nicht/),
    ]))
    expect(r.pkg).toBeNull()
  })
  it('friendly conversions become warnings; unknown fields are kept as extras', () => {
    const r = validatePackage(base({
      id: 'Mein Paket!', questions: [
        { type: 'tf', prompt: 'P', correct: 'wahr', explanation: 'E', difficulty: 'mittel' },
        { type: 'number', prompt: 'P', answer: '3,5', explanation: 'E' },
        { type: 'mc', prompt: 'P', options: ['a', 'b'], correct: 'b', explanation: 'E' },
      ], farbe: 'blau', flashcards: [{ front: 'F', back: 'B', bild: 'x.png' }],
    }))
    expect(r.errors).toEqual([])
    expect(r.pkg!.id).toBe('mein-paket')
    expect(r.pkg!.questions![0]).toMatchObject({ type: 'true-false', correct: true, difficulty: 'medium' })
    expect(r.pkg!.questions![1]).toMatchObject({ type: 'number', answer: 3.5 })
    expect(r.pkg!.questions![2]).toMatchObject({ type: 'multiple-choice', correct: 1 })
    expect(r.extras.map((x) => x.where)).toEqual(['Karteikarten Nr. 1 › bild', 'Paket › farbe'])
    expect(r.warnings.length).toBeGreaterThanOrEqual(6)
  })
  it('too long texts are an error, never cut off silently', () => {
    const r = validatePackage(base({ questions: [{ type: 'open', prompt: 'x'.repeat(5000), solution: 'S', explanation: 'E' }] }))
    expect(r.errors[0].message).toMatch(/zu lang \(5\.000 Zeichen/)
  })
})

describe('Markdown / TXT', () => {
  it('export → import keeps every item (round trip of the example)', () => {
    const p = example()
    const md = packageToMarkdown(p)
    expect(md).toContain('## Fragen')
    expect(md).toContain('- [x] Präsens')
    const r = parsePackageMarkdown(md)
    expect(r.errors).toEqual([])
    const q = r.pkg!
    const a = countPackage(p)
    const b = countPackage(q)
    expect(b).toMatchObject({ questions: a.questions, flashcards: a.flashcards, exercises: a.exercises, mistakes: a.mistakes, keyTerms: a.keyTerms, objectives: a.objectives, examQuestions: a.examQuestions, notes: a.notes, hasSummary: true })
    expect(q.questions!.map((x) => [x.type, x.id])).toEqual(p.questions!.map((x) => [x.type, x.id]))
    const mc = q.questions!.find((x) => x.type === 'multiple-choice')!
    expect(mc.type === 'multiple-choice' && mc.options[mc.correct]).toBe('Titel, Autor/in, Textsorte, Thema, Erscheinungsjahr und eine Deutungshypothese')
    expect(q.questions!.filter((x) => x.type === 'true-false').map((x) => x.type === 'true-false' && x.correct)).toEqual(p.questions!.filter((x) => x.type === 'true-false').map((x) => x.type === 'true-false' && x.correct))
    expect(q.exam?.timeLimitMinutes).toBe(25)
    expect(q.mistakes![0]).toEqual(p.mistakes![0])
    expect(q.keyTerms![0]).toEqual(p.keyTerms![0])
  })
  it('reads a hand-written TXT package and keeps unknown sections as notes', () => {
    const txt = `---\nid: bio-zelle\nsubject: Biologie\ntopic: Die Zelle\nlevel: Klasse 7\n---\n# Die Zelle\nGrundlagen.\n\n## Lernziele\n- Zellbestandteile nennen\n\n## Fragen\n### MC: Wo liegt die Erbinformation?\n- [ ] Zellwand\n- [x] Zellkern\nErklärung: Im Zellkern liegt die DNA.\n\n### WF: Pflanzenzellen haben eine Zellwand.\nLösung: wahr\nErklärung: Die Zellwand gibt Stabilität.\n\n### Zahl: Wie viele Chromosomen hat eine menschliche Körperzelle?\nLösung: 46\nErklärung: 23 Paare.\n\n## Karteikarten\n- Zellkern :: enthält die Erbinformation\nQ: Mitochondrium\nA: Kraftwerk der Zelle\n\n## Übungen\n### Schwer: Vergleiche Pflanzen- und Tierzelle.\nLösung: Nur Pflanzenzellen haben Zellwand, Vakuole, Chloroplasten.\nErklärung: Diese dienen Stabilität und Fotosynthese.\n\n## Typische Fehler\n- Zellwand und Zellmembran verwechseln → Membran haben alle Zellen, Wand nur Pflanzen.\n\n## Merkhilfen\nZellkern = Chef der Zelle\n`
    const r = parsePackageFile('zelle.txt', txt)
    expect(r.kind).toBe('markdown')
    expect(r.errors).toEqual([])
    const p = r.pkg!
    expect(p).toMatchObject({ id: 'bio-zelle', subject: 'Biologie', topic: 'Die Zelle', level: 'Klasse 7', description: 'Grundlagen.' })
    expect(p.questions!.map((q) => q.type)).toEqual(['multiple-choice', 'true-false', 'number'])
    expect(p.questions![2]).toMatchObject({ answer: 46 })
    expect(p.flashcards).toEqual([{ front: 'Zellkern', back: 'enthält die Erbinformation' }, { front: 'Mitochondrium', back: 'Kraftwerk der Zelle' }])
    expect(p.exercises![0]).toMatchObject({ level: 'hard' })
    expect(p.mistakes![0].fix).toMatch(/Membran haben alle Zellen/)
    expect(p.notes!.find((x) => x.title === 'Merkhilfen')?.content).toBe('Zellkern = Chef der Zelle')
    expect(r.warnings.some((w) => /Unbekannte Überschrift/.test(w.message))).toBe(true)
  })
})

describe('import into Study OS', () => {
  it('creates subject, topic, notes, questions, exercises, deck and cards – and they persist', async () => {
    const p = example()
    const s = await importPackage(p, { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: true })
    const c = countPackage(p)
    expect(s.subjectCreated && s.topicCreated).toBe(true)
    expect(s.created).toEqual({ notes: 2 + c.notes + 3, questions: c.questions, exercises: c.exercises, flashcards: c.flashcards + c.keyTerms })
    expect(s.examQuestionIds).toHaveLength(c.examQuestions)
    const topic = (await db.topics.get(s.topicId))!
    expect(topic).toMatchObject({ name: 'Textanalyse', curriculum: 'own' })
    expect(topic.description).toMatch(/Kurzgeschichten/)
    // notes in reading order (lists sort by updatedAt, newest first)
    const notes = (await db.notes.where('topicId').equals(s.topicId).toArray()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    expect(notes[0].title).toBe('Überblick: Textanalyse')
    expect(notes[0].content).toMatch(/Lernziele/)
    expect(notes[1].title).toBe('Lernzettel: Textanalyse')
    expect(notes.some((x) => x.title.startsWith('Beispiel: ') && /Warum das stimmt/.test(x.content))).toBe(true)
    expect(notes.map((x) => x.title)).toEqual(expect.arrayContaining(['Fachbegriffe: Textanalyse', 'Übungsaufgaben: Textanalyse', 'Typische Fehler: Textanalyse']))
    const qs = await db.questions.where('topicId').equals(s.topicId).toArray()
    expect(new Set(qs.map((q) => q.type))).toEqual(new Set(['mc', 'tf', 'text']))
    expect(qs.every((q) => q.source === 'import' && q.explanation)).toBe(true)
    expect(qs.filter((q) => q.tags?.includes('uebung')).map((q) => q.difficulty).sort()).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
    const mc = qs.find((q) => q.type === 'mc')!
    expect(mc.optionFeedback).toHaveLength(mc.options!.length)
    const deck = (await db.decks.get(s.deckId!))!
    expect(deck).toMatchObject({ topicId: s.topicId, subjectId: s.subjectId })
    expect(await db.cards.where('deckId').equals(deck.id).count()).toBe(c.flashcards + c.keyTerms)
    const reg = await getPackageRegistry()
    expect(reg[p.id]).toMatchObject({ topicId: s.topicId, imports: 1, timeLimitMinutes: 25 })
  })

  it('importing again creates nothing twice; a newer version only adds what is new; user edits stay', async () => {
    const p = example()
    const first = await importPackage(p, { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: false })
    const q = (await db.questions.where('topicId').equals(first.topicId).first())!
    await repo.saveQuestion({ ...q, prompt: 'Von mir geändert' })
    const again = await importPackage(p, { subject: { id: first.subjectId }, topic: { id: first.topicId } }, { termsAsCards: false })
    expect(again.alreadyImported).toBe(true)
    expect(again.created).toEqual({ notes: 0, questions: 0, exercises: 0, flashcards: 0 })
    expect(again.skipped.questions).toBe(p.questions!.length)
    expect((await db.questions.get(q.id))!.prompt).toBe('Von mir geändert')
    const v2: LearningPackage = { ...p, questions: [...p.questions!, { id: 'neu', type: 'true-false', prompt: 'Neue Aussage.', correct: true, explanation: 'Neu im Paket.' }] }
    const third = await importPackage(v2, { subject: { id: first.subjectId }, topic: { id: first.topicId } }, { termsAsCards: false })
    expect(third.created.questions).toBe(1)
    expect((await getPackageRegistry())[p.id].imports).toBe(3)
  })

  it('adds to an existing topic of an existing subject and links the topic to an exam (study planner)', async () => {
    const sid = await repo.createSubject('Deutsch')
    const tid = await repo.createTopic(sid, 'Erzählende Texte')
    const examId = await repo.saveExam({ subjectId: sid, title: 'Klassenarbeit', type: 'Klassenarbeit', date: '2026-12-01', topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: 30, availableWeekdays: [1, 2, 3], notes: '', gradingScaleId: null })
    const s = await importPackage(example(), { subject: { create: 'deutsch' }, topic: { id: tid } }, { termsAsCards: false, examId })
    expect(s).toMatchObject({ subjectId: sid, topicId: tid, subjectCreated: false, topicCreated: false, addedToExam: true })
    expect((await db.exams.get(examId))!.topicIds).toEqual([tid])
    expect(await db.subjects.count()).toBe(1)
    await expect(importPackage(example(), { subject: { id: sid }, topic: { id: 'nope' } }, { termsAsCards: false })).rejects.toThrow(/Thema gibt es nicht/)
  })

  it('undo removes exactly what the import created', async () => {
    const sid = await repo.createSubject('Deutsch')
    await repo.saveNote({ title: 'Eigene Notiz', content: 'bleibt', subjectId: sid })
    await importPackage(example(), { subject: { id: sid }, topic: { create: 'Textanalyse' } }, { termsAsCards: true })
    expect(await db.questions.count()).toBeGreaterThan(20)
    await undoLast()
    expect(await db.questions.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)
    expect(await db.topics.count()).toBe(0)
    expect((await db.notes.toArray()).map((x) => x.title)).toEqual(['Eigene Notiz'])
    expect(await getPackageRegistry()).toEqual({})
  })

  it('exam mode starts a timed exam attempt with the marked questions', async () => {
    const s = await importPackage(example(), { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: false })
    const attemptId = await startTopicExam(s.topicId)
    const a = (await db.attempts.get(attemptId))!
    expect(a).toMatchObject({ mode: 'exam', kind: 'mock', timeLimitMin: 25, title: 'Prüfung: Textanalyse (Klasse 9)' })
    expect(a.questionIds.sort()).toEqual([...s.examQuestionIds].sort())
  })

  it('export of a topic → valid package; importing it into the same topic adds nothing; into another device everything', async () => {
    const s = await importPackage(example(), { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: false })
    const reg = await getPackageRegistry()
    const exported = topicToPackage({
      subject: (await db.subjects.get(s.subjectId))!, topic: (await db.topics.get(s.topicId))!, notes: await db.notes.where('topicId').equals(s.topicId).toArray(),
      questions: await db.questions.where('topicId').equals(s.topicId).toArray(), cards: await db.cards.where('topicId').equals(s.topicId).toArray(), packageId: 'export-test',
      examTitle: reg['deutsch-textanalyse-klasse-9'].examTitle, timeLimitMinutes: 25,
    })
    const v = validatePackage(JSON.parse(JSON.stringify(exported)))
    expect(v.errors).toEqual([])
    expect(countPackage(v.pkg!)).toMatchObject({ questions: 20, exercises: 9, flashcards: 15, examQuestions: 8, hasSummary: true })
    const same = await importPackage(v.pkg!, { subject: { id: s.subjectId }, topic: { id: s.topicId } }, { termsAsCards: false })
    expect(same.created).toEqual({ notes: 0, questions: 0, exercises: 0, flashcards: 0 })
    // a fresh device
    useTestDatabase(`pkg-fresh-${n}`)
    const other = await importPackage(v.pkg!, { subject: { create: 'Deutsch' }, topic: { create: 'Textanalyse' } }, { termsAsCards: false })
    expect(other.created.questions).toBe(20)
    expect(other.created.flashcards).toBe(15)
  })
})

describe('reusable: template, schema file, AI prompt', () => {
  it('the template is valid and identical to docs/lernpakete/vorlage.json', () => {
    const t = packageTemplate()
    expect(validatePackage(t).errors).toEqual([])
    const file = JSON.parse(templateText)
    delete file.$schema
    expect(file).toEqual(t)
    expect(validatePackage(file).errors).toEqual([])
  })
  it('the JSON schema lists the same required fields and question types as the importer', () => {
    const schema = JSON.parse(schemaText)
    expect(schema.required).toEqual(['format', 'version', 'id', 'title', 'subject', 'topic'])
    expect(schema.properties.format.const).toBe('studyos-learning-package')
    expect(schema.properties.questions.items.oneOf.map((o: { properties: { type: { const: string } } }) => o.properties.type.const)).toEqual(['multiple-choice', 'true-false', 'open', 'number'])
  })
  it('the AI prompt names subject, topic, level and the exact format', () => {
    const pr = packagePrompt({ subject: 'Chemie', topic: 'Atombau', level: 'Klasse 8' })
    expect(pr).toContain('Fach: Chemie')
    expect(pr).toContain('"format": "studyos-learning-package"')
    expect(pr).toMatch(/Mindestens 15 Fragen/)
  })
})
