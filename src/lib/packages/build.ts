import type { Card, Note, Question, Subject, Topic } from '@/db/types'
import { PACKAGE_FORMAT, PACKAGE_VERSION, type LearningPackage, type PkgDifficulty, type PkgQuestion } from './schema'
import { slugify } from './validate'

/**
 * Builds learning packages from existing Study OS data (export), plus the template and an AI prompt
 * for creating new packages for any subject.
 */

const DIFF: Record<number, PkgDifficulty> = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard' }
const hasTag = (x: { tags?: string[] }, t: string) => !!x.tags?.includes(t)
const part = (n: Note) => n.tags.find((t) => t.startsWith('lp-teil:'))?.slice(8)

export interface TopicExportInput {
  subject: Subject
  topic: Topic
  notes: Note[]
  questions: Question[]
  cards: Card[]
  /** Package this topic came from (keeps the ID so a re-import is recognised). */
  packageId?: string
  level?: string
  examTitle?: string
  timeLimitMinutes?: number
}

/** Exports a topic with its notes, questions, exercises and flashcards as a learning package. */
export function topicToPackage(x: TopicExportInput): LearningPackage {
  const notes = [...x.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) // same order as in the app
  const p: LearningPackage = {
    format: PACKAGE_FORMAT, version: PACKAGE_VERSION, id: x.packageId ?? slugify(`${x.subject.name}-${x.topic.name}`), title: x.topic.name, subject: x.subject.name, topic: x.topic.name,
    level: x.level, language: 'de', description: x.topic.description || undefined, createdAt: new Date().toISOString().slice(0, 10), notes: [], examples: [], questions: [], flashcards: [], exercises: [],
  }
  for (const n of notes) {
    const kind = part(n)
    if (kind === 'ueberblick' || kind === 'uebungen') continue // generated from the other parts on import
    if (kind === 'zusammenfassung') p.summary = [p.summary, n.content].filter(Boolean).join('\n\n')
    else if (kind === 'beispiel') p.examples!.push({ title: n.title.replace(/^Beispiel:\s*/, ''), content: n.content })
    else p.notes!.push({ title: n.title, content: n.content })
  }
  for (const q of x.questions) {
    if (hasTag(q, 'uebung')) {
      const level = (q.tags?.find((t) => t.startsWith('stufe:'))?.slice(6) as PkgDifficulty | undefined) ?? DIFF[q.difficulty] ?? 'medium'
      p.exercises!.push({ level, prompt: q.prompt, solution: q.answer || '–', explanation: q.explanation || 'Siehe Lösung.', ...(q.steps?.length ? { steps: q.steps } : {}), ...(q.type === 'numeric' && Number.isFinite(Number(q.answer)) ? { answer: Number(q.answer), unit: q.unit, tolerance: q.tolerance } : {}) })
      continue
    }
    const base = { prompt: q.prompt, explanation: q.explanation || 'Siehe Lösung.', difficulty: DIFF[q.difficulty] ?? 'medium', ...(q.hints.length ? { hints: q.hints } : {}), ...(hasTag(q, 'pruefung') ? { exam: true } : {}) }
    let out: PkgQuestion
    if (q.type === 'mc' && q.options && q.correctIndex !== undefined) out = { ...base, type: 'multiple-choice', options: q.options, correct: q.correctIndex, ...(q.optionFeedback?.length === q.options.length ? { optionExplanations: q.optionFeedback } : {}) }
    else if (q.type === 'tf' && typeof q.correctBool === 'boolean') out = { ...base, type: 'true-false', correct: q.correctBool }
    else if (q.type === 'numeric' && Number.isFinite(Number(q.answer))) out = { ...base, type: 'number', answer: Number(q.answer), unit: q.unit, tolerance: q.tolerance, ...(q.steps?.length ? { steps: q.steps } : {}) }
    else out = { ...base, type: 'open', solution: q.answer || '–', ...(q.keywords?.length ? { keywords: q.keywords } : {}), ...(q.steps?.length ? { steps: q.steps } : {}) }
    p.questions!.push(out)
  }
  for (const c of x.cards) p.flashcards!.push({ front: c.front, back: c.back, ...(c.example ? { example: c.example } : {}) })
  if (x.examTitle || x.timeLimitMinutes) p.exam = { title: x.examTitle, timeLimitMinutes: x.timeLimitMinutes }
  for (const k of ['notes', 'examples', 'questions', 'flashcards', 'exercises'] as const) if (!p[k]?.length) delete p[k]
  return p
}

/** A complete, valid skeleton with one entry per section – fill in and import. */
export function packageTemplate(): LearningPackage {
  return {
    format: PACKAGE_FORMAT, version: PACKAGE_VERSION, id: 'fach-thema-klasse', title: 'Thema – Klasse X', subject: 'Fach', topic: 'Thema', level: 'Klasse 9', grade: 9, language: 'de',
    description: 'Ein bis zwei Sätze: Worum geht es in diesem Thema?',
    objectives: ['Ich kann … erklären.', 'Ich kann … anwenden.'],
    notes: [{ id: 'grundlagen', title: 'Grundlagen', content: 'Ausführliche Erklärung in **Markdown**. Formeln mit $a^2 + b^2 = c^2$.' }],
    examples: [{ id: 'beispiel-1', title: 'Musterbeispiel', task: 'Die Aufgabe.', steps: [{ step: 'Erster Schritt.', why: 'Warum dieser Schritt richtig ist.' }], result: 'Das Ergebnis.' }],
    keyTerms: [{ term: 'Fachbegriff', definition: 'Kurze, genaue Definition.', example: 'Ein Beispiel.' }],
    questions: [
      { id: 'f1', type: 'multiple-choice', prompt: 'Frage?', options: ['Antwort A', 'Antwort B', 'Antwort C'], correct: 1, explanation: 'Warum B richtig ist (und A/C nicht).', difficulty: 'easy' },
      { id: 'f2', type: 'true-false', prompt: 'Eine Aussage.', correct: false, explanation: 'Warum die Aussage falsch ist.', difficulty: 'easy' },
      { id: 'f3', type: 'open', prompt: 'Offene Frage?', solution: 'Musterlösung.', explanation: 'Worauf es bei der Antwort ankommt.', difficulty: 'medium', exam: true },
      { id: 'f4', type: 'number', prompt: 'Rechenaufgabe?', answer: 12.5, unit: 'cm', tolerance: 0.1, explanation: 'Rechenweg und Begründung.', difficulty: 'medium' },
    ],
    flashcards: [{ front: 'Vorderseite (Frage)', back: 'Rückseite (Antwort)' }],
    exercises: [
      { id: 'u1', level: 'easy', prompt: 'Leichte Aufgabe.', solution: 'Lösung.', explanation: 'Erklärung.' },
      { id: 'u2', level: 'medium', prompt: 'Mittlere Aufgabe.', solution: 'Lösung.', explanation: 'Erklärung.' },
      { id: 'u3', level: 'hard', prompt: 'Schwere Aufgabe.', solution: 'Lösung.', explanation: 'Erklärung.', steps: ['Schritt 1', 'Schritt 2'] },
    ],
    mistakes: [{ mistake: 'Typischer Fehler.', why: 'Warum er passiert.', fix: 'Wie du ihn vermeidest.' }],
    summary: '- Wichtigster Punkt 1\n- Wichtigster Punkt 2',
    exam: { title: 'Prüfung: Thema', timeLimitMinutes: 20, questionIds: ['f1', 'f2'] },
  }
}

/** Prompt for any AI chat assistant to create a package in exactly this format. */
export function packagePrompt(o: { subject: string; topic: string; level: string; language?: string }): string {
  const lang = o.language || 'Deutsch'
  return `Erstelle ein vollständiges Lernpaket als JSON-Datei für die Lern-App „Study OS“.

Fach: ${o.subject || '<Fach>'}
Thema: ${o.topic || '<Thema>'}
Stufe: ${o.level || '<Klassenstufe>'}
Sprache der Inhalte: ${lang}

Anforderungen an den Inhalt:
- Fachlich korrekt, verständlich und passend zur Stufe; schwierige Begriffe erklären.
- Ausführliche Erklärungen ("notes") in Markdown, Formeln mit $…$.
- Musterbeispiele ("examples") Schritt für Schritt – zu jedem Schritt "why": warum er richtig ist.
- Fachbegriffe mit Definition, Lernziele, typische Fehler mit Abhilfe, kurzer Lernzettel ("summary").
- Mindestens 15 Fragen gemischt: "multiple-choice", "true-false", "open" (bei Rechenthemen auch "number").
  Jede Frage braucht "explanation" – nicht nur die Lösung, sondern die Begründung.
- Mindestens 10 Karteikarten, Übungen in den Stufen "easy", "medium", "hard" mit Lösung und Erklärung.
- Fragen für den Prüfungsmodus mit "exam": true markieren.
- Nur eigene, frei erfundene Beispieltexte verwenden – keine urheberrechtlich geschützten Schulbuchtexte.

Format (genau einhalten, nur gültiges JSON ausgeben, ohne Kommentare):
{
  "format": "${PACKAGE_FORMAT}",
  "version": ${PACKAGE_VERSION},
  "id": "kleinbuchstaben-mit-bindestrichen",
  "title": "…", "subject": "…", "topic": "…", "level": "…", "language": "de",
  "description": "…",
  "objectives": ["…"],
  "notes": [{ "id": "…", "title": "…", "content": "Markdown" }],
  "examples": [{ "id": "…", "title": "…", "task": "…", "steps": [{ "step": "…", "why": "…" }], "result": "…" }],
  "keyTerms": [{ "term": "…", "definition": "…", "example": "…" }],
  "questions": [
    { "id": "q1", "type": "multiple-choice", "prompt": "…", "options": ["…", "…", "…"], "correct": 0, "explanation": "…", "optionExplanations": ["…", "…", "…"], "difficulty": "easy|medium|hard", "exam": false },
    { "id": "q2", "type": "true-false", "prompt": "Aussage …", "correct": true, "explanation": "…" },
    { "id": "q3", "type": "open", "prompt": "…", "solution": "Musterlösung", "explanation": "…" },
    { "id": "q4", "type": "number", "prompt": "…", "answer": 12.5, "unit": "cm", "tolerance": 0.1, "explanation": "…" }
  ],
  "flashcards": [{ "front": "…", "back": "…" }],
  "exercises": [{ "id": "u1", "level": "easy|medium|hard", "prompt": "…", "solution": "…", "explanation": "…", "steps": ["…"] }],
  "mistakes": [{ "mistake": "…", "why": "…", "fix": "…" }],
  "summary": "Markdown-Lernzettel",
  "exam": { "title": "…", "timeLimitMinutes": 30 }
}
"correct" bei multiple-choice ist der Index der richtigen Antwort ab 0.`
}
