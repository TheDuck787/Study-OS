/**
 * Study OS learning package ("Lernpaket"), format version 1.
 * One package = one topic of one subject with everything needed to learn it. Works for any subject and language.
 * Documentation: docs/lernpakete/README.md · JSON Schema: docs/lernpakete/lernpaket.schema.json
 * Example: public/lernpakete/deutsch-textanalyse-klasse-9.json
 */

export const PACKAGE_FORMAT = 'studyos-learning-package'
export const PACKAGE_VERSION = 1

export type PkgDifficulty = 'easy' | 'medium' | 'hard'

export interface PkgNote {
  id?: string
  title: string
  /** Markdown ($…$ for formulas). */
  content: string
}

export interface PkgExampleStep {
  /** What is done in this step. */
  step: string
  /** Why the step is correct / what it shows. */
  why: string
}

export interface PkgExample {
  id?: string
  title: string
  /** Task or material (Markdown). */
  task?: string
  steps?: PkgExampleStep[]
  /** Result / finished solution (Markdown). */
  result?: string
  /** Free Markdown instead of (or in addition to) task/steps/result – used by the Markdown import. */
  content?: string
}

export interface PkgKeyTerm {
  term: string
  definition: string
  example?: string
}

interface PkgQuestionBase {
  id?: string
  prompt: string
  /** Why the answer is correct (required – a solution is never just the answer). */
  explanation: string
  difficulty?: PkgDifficulty
  hints?: string[]
  /** Also use this question in exam mode. */
  exam?: boolean
}

export interface PkgMultipleChoice extends PkgQuestionBase {
  type: 'multiple-choice'
  options: string[]
  /** Index of the correct option (0-based). */
  correct: number
  /** Optional: one explanation per option (why it is right/wrong). */
  optionExplanations?: string[]
}

export interface PkgTrueFalse extends PkgQuestionBase {
  type: 'true-false'
  correct: boolean
}

export interface PkgOpen extends PkgQuestionBase {
  type: 'open'
  /** Model answer. */
  solution: string
  /** Optional automatic check: every group must be matched by one of its alternatives. Without keywords the student compares with the model answer. */
  keywords?: string[][]
  steps?: string[]
}

export interface PkgNumber extends PkgQuestionBase {
  type: 'number'
  answer: number
  unit?: string
  tolerance?: number
  steps?: string[]
}

export type PkgQuestion = PkgMultipleChoice | PkgTrueFalse | PkgOpen | PkgNumber
export const QUESTION_TYPES = ['multiple-choice', 'true-false', 'open', 'number'] as const

export interface PkgFlashcard {
  front: string
  back: string
  example?: string
}

export interface PkgExercise {
  id?: string
  level: PkgDifficulty
  prompt: string
  solution: string
  explanation: string
  steps?: string[]
  /** For calculation tasks: numeric result that can be checked automatically. */
  answer?: number
  unit?: string
  tolerance?: number
}

export interface PkgMistake {
  mistake: string
  /** Why it happens / why it is wrong (optional). */
  why?: string
  /** How to avoid it. */
  fix: string
}

export interface PkgExam {
  title?: string
  timeLimitMinutes?: number
  /** IDs of questions for the exam (in addition to questions with "exam": true). */
  questionIds?: string[]
}

export interface LearningPackage {
  format: typeof PACKAGE_FORMAT
  version: number
  /** Stable ID of the package (a–z, 0–9, "-") – recognises a package when it is imported again. */
  id: string
  title: string
  subject: string
  topic: string
  /** e.g. "Klasse 9", "Grade 9", "Oberstufe" */
  level?: string
  grade?: number
  /** BCP-47, e.g. "de", "en" */
  language?: string
  description?: string
  author?: string
  createdAt?: string
  sources?: string[]
  objectives?: string[]
  notes?: PkgNote[]
  examples?: PkgExample[]
  keyTerms?: PkgKeyTerm[]
  questions?: PkgQuestion[]
  flashcards?: PkgFlashcard[]
  exercises?: PkgExercise[]
  mistakes?: PkgMistake[]
  /** Short revision sheet (Markdown). */
  summary?: string
  exam?: PkgExam
}

/** Top-level fields the importer understands (anything else is reported and kept as an extra note). */
export const KNOWN_FIELDS = [
  'format', 'version', 'id', 'title', 'subject', 'topic', 'level', 'grade', 'language', 'description', 'author', 'createdAt', 'sources',
  'objectives', 'notes', 'examples', 'keyTerms', 'questions', 'flashcards', 'exercises', 'mistakes', 'summary', 'exam', '$schema', 'extra',
] as const

export const LEVEL_LABEL: Record<PkgDifficulty, string> = { easy: 'leicht', medium: 'mittel', hard: 'schwer' }
export const DIFFICULTY_NUM: Record<PkgDifficulty, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 }

/** Counts shown in previews and summaries. */
export function countPackage(p: LearningPackage) {
  const examQuestions = (p.questions ?? []).filter((q) => q.exam || (q.id && p.exam?.questionIds?.includes(q.id))).length
  return {
    notes: (p.notes?.length ?? 0) + (p.examples?.length ?? 0),
    examples: p.examples?.length ?? 0,
    keyTerms: p.keyTerms?.length ?? 0,
    objectives: p.objectives?.length ?? 0,
    questions: p.questions?.length ?? 0,
    examQuestions,
    flashcards: p.flashcards?.length ?? 0,
    exercises: p.exercises?.length ?? 0,
    mistakes: p.mistakes?.length ?? 0,
    hasSummary: !!p.summary?.trim(),
  }
}
