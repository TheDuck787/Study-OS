import type { Difficulty, Question } from '@/db/types'

/** Library question before it is bound to a subject/topic id at seeding time. */
export type LibQuestion = Omit<Question, 'id' | 'subjectId' | 'topicId' | 'createdAt' | 'source'> & { key: string; topic: string }

interface Opts {
  d?: Difficulty
  hints?: string[]
  steps?: string[]
  points?: number
}

export function mc(key: string, topic: string, prompt: string, options: string[], correctIndex: number, explanation: string, o: Opts & { fb?: string[] } = {}): LibQuestion {
  return { key, topic, type: 'mc', prompt, options, correctIndex, optionFeedback: o.fb, answer: options[correctIndex], explanation, hints: o.hints ?? [], steps: o.steps, difficulty: o.d ?? 2, points: o.points ?? 1 }
}

export function tf(key: string, topic: string, prompt: string, correct: boolean, explanation: string, o: Opts = {}): LibQuestion {
  return { key, topic, type: 'tf', prompt, correctBool: correct, answer: correct ? 'Wahr' : 'Falsch', explanation, hints: o.hints ?? [], difficulty: o.d ?? 1, points: o.points ?? 1 }
}

export function num(key: string, topic: string, prompt: string, answer: string, explanation: string, o: Opts & { unit?: string; tol?: number } = {}): LibQuestion {
  return { key, topic, type: 'numeric', prompt, answer, unit: o.unit, tolerance: o.tol, explanation, hints: o.hints ?? [], steps: o.steps, difficulty: o.d ?? 2, points: o.points ?? 1 }
}

export function math(key: string, topic: string, prompt: string, answer: string, explanation: string, o: Opts & { accepted?: string[]; form?: Question['requireForm'] } = {}): LibQuestion {
  return { key, topic, type: 'math', prompt, answer, acceptedAnswers: o.accepted, requireForm: o.form, explanation, hints: o.hints ?? [], steps: o.steps, difficulty: o.d ?? 2, points: o.points ?? 1 }
}

export function txt(key: string, topic: string, prompt: string, answer: string, explanation: string, o: Opts & { keywords?: string[][]; accepted?: string[] } = {}): LibQuestion {
  return { key, topic, type: 'text', prompt, answer, keywords: o.keywords, acceptedAnswers: o.accepted, explanation, hints: o.hints ?? [], difficulty: o.d ?? 2, points: o.points ?? 1 }
}
