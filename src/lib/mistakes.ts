import type { Answer } from '@/db/types'

export interface OpenMistake {
  questionId: string
  topicId: string
  subjectId: string
  lastWrong: Answer
  wrongCount: number
  /** Correct answers since the last wrong one (2 are needed to close the mistake). */
  correctSince: number
}

/**
 * A mistake stays "open" until the question was answered correctly twice
 * after the last wrong answer. This prevents a lucky guess from hiding a gap.
 */
export const CORRECT_TO_RESOLVE = 2

export function openMistakes(answers: Answer[]): OpenMistake[] {
  const byQ = new Map<string, Answer[]>()
  for (const a of answers) {
    const arr = byQ.get(a.questionId)
    if (arr) arr.push(a)
    else byQ.set(a.questionId, [a])
  }
  const out: OpenMistake[] = []
  for (const [questionId, list] of byQ) {
    list.sort((a, b) => a.at.localeCompare(b.at))
    let lastWrongIdx = -1
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].correct) {
        lastWrongIdx = i
        break
      }
    }
    if (lastWrongIdx === -1) continue
    const correctSince = list.slice(lastWrongIdx + 1).filter((a) => a.correct).length
    if (correctSince >= CORRECT_TO_RESOLVE) continue
    const lastWrong = list[lastWrongIdx]
    out.push({
      questionId,
      topicId: lastWrong.topicId,
      subjectId: lastWrong.subjectId,
      lastWrong,
      wrongCount: list.filter((a) => !a.correct).length,
      correctSince,
    })
  }
  return out.sort((a, b) => b.lastWrong.at.localeCompare(a.lastWrong.at))
}

export interface RecurringPattern {
  key: string
  label: string
  count: number
  topicId?: string
}

const ERROR_TAG_LABELS: Record<string, string> = {
  'sign-error': 'Vorzeichenfehler',
  'not-simplified': 'Ergebnis nicht vollständig gekürzt/vereinfacht',
  'wrong-operation': 'Falsche Rechenoperation',
  'unit-missing': 'Einheit fehlt oder falsch',
  'spelling': 'Rechtschreibung / Tippfehler',
  'article': 'Artikel fehlt oder falsch',
  'rounding': 'Rundungsfehler',
  'percent-base': 'Grundwert verwechselt',
  'misconception': 'Typischer Denkfehler (siehe Erklärung)',
}

export function errorTagLabel(tag: string): string {
  return ERROR_TAG_LABELS[tag] ?? tag
}

/** Recurring mistakes: error categories and questions that went wrong at least twice. */
export function recurringPatterns(answers: Answer[], sinceIso?: string): RecurringPattern[] {
  const wrong = answers.filter((a) => !a.correct && (!sinceIso || a.at >= sinceIso))
  const tags = new Map<string, number>()
  for (const a of wrong) if (a.errorTag) tags.set(a.errorTag, (tags.get(a.errorTag) ?? 0) + 1)
  const out: RecurringPattern[] = []
  for (const [tag, count] of tags) if (count >= 2) out.push({ key: `tag:${tag}`, label: errorTagLabel(tag), count })
  const byTopic = new Map<string, number>()
  for (const a of wrong) byTopic.set(a.topicId, (byTopic.get(a.topicId) ?? 0) + 1)
  for (const [topicId, count] of byTopic) if (count >= 3) out.push({ key: `topic:${topicId}`, label: 'Thema mit wiederholten Fehlern', count, topicId })
  return out.sort((a, b) => b.count - a.count)
}
