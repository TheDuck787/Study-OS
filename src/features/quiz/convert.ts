import type { Question } from '@/db/types'
import type { GeneratedQuestion } from '@/shared/ai'

/** Turns an AI-generated question into a stored question – or null if it is not usable. */
export function fromGenerated(g: GeneratedQuestion, ctx: { subjectId: string; topicId: string; source: Question['source']; sourceMaterialId?: string | null }): Omit<Question, 'id' | 'createdAt'> | null {
  const base = {
    subjectId: ctx.subjectId, topicId: ctx.topicId, prompt: g.prompt.trim(), explanation: g.explanation ?? '', hints: g.hints ?? [],
    difficulty: (Math.min(4, Math.max(1, g.difficulty ?? 2)) as Question['difficulty']), points: 1, source: ctx.source, sourceMaterialId: ctx.sourceMaterialId ?? null,
  }
  if (!base.prompt) return null
  if (g.type === 'mc') {
    const options = (g.options ?? []).map((o) => o.trim()).filter(Boolean)
    if (options.length < 2 || g.correctIndex === undefined || g.correctIndex < 0 || g.correctIndex >= options.length) return null
    return { ...base, type: 'mc', options, correctIndex: g.correctIndex, answer: options[g.correctIndex] }
  }
  if (g.type === 'tf') {
    if (typeof g.correctBool !== 'boolean') return null
    return { ...base, type: 'tf', correctBool: g.correctBool, answer: g.correctBool ? 'Wahr' : 'Falsch' }
  }
  if (g.type === 'numeric') {
    const n = Number(String(g.answer).replace(',', '.'))
    if (!Number.isFinite(n)) return null
    return { ...base, type: 'numeric', answer: String(n) }
  }
  if (!g.answer?.trim()) return null
  return { ...base, type: 'text', answer: g.answer.trim(), keywords: g.keywords?.filter((k) => k.length > 0) }
}
