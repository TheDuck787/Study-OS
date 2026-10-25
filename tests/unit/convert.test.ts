import { describe, expect, it } from 'vitest'
import { fromGenerated } from '@/features/quiz/convert'

const ctx = { subjectId: 's', topicId: 't', source: 'ai' as const }
describe('fromGenerated (AI output → stored question)', () => {
  it('keeps valid questions', () => {
    const q = fromGenerated({ type: 'mc', prompt: 'Was ist ein Bit?', options: ['0 oder 1', 'Kabel'], correctIndex: 0, answer: '', explanation: '', hints: [] }, ctx)
    expect(q?.answer).toBe('0 oder 1')
  })
  it('drops broken questions instead of saving them', () => {
    expect(fromGenerated({ type: 'mc', prompt: 'kaputt', options: ['a'], correctIndex: 5, answer: '', explanation: '', hints: [] }, ctx)).toBeNull()
    expect(fromGenerated({ type: 'tf', prompt: 'x', answer: '', explanation: '', hints: [] }, ctx)).toBeNull()
    expect(fromGenerated({ type: 'numeric', prompt: 'x', answer: 'zwölf', explanation: '', hints: [] }, ctx)).toBeNull()
    expect(fromGenerated({ type: 'text', prompt: 'x', answer: '  ', explanation: '', hints: [] }, ctx)).toBeNull()
  })
  it('normalises numbers with German comma', () => {
    expect(fromGenerated({ type: 'numeric', prompt: 'x', answer: '2,5', explanation: '', hints: [] }, ctx)?.answer).toBe('2.5')
  })
})
