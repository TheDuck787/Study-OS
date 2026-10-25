import { describe, expect, it } from 'vitest'
import { checkAnswer } from '@/lib/answerCheck'
import { checkEquationSteps, checkExpressionSteps, expressionsEquivalent, parseSolutionSet } from '@/lib/mathcheck'
import type { Question } from '@/db/types'

const base: Question = {
  id: 'q', subjectId: 's', topicId: 't', type: 'math', prompt: '', answer: '', explanation: '', hints: [], difficulty: 2, points: 1,
  source: 'user', createdAt: '2026-01-01',
}
const q = (p: Partial<Question>): Question => ({ ...base, ...p })

describe('math answers – equivalent forms are accepted', () => {
  it('fractions and decimals', () => {
    expect(checkAnswer(q({ answer: '3/4' }), '0,75').correct).toBe(true)
    expect(checkAnswer(q({ answer: '3/4' }), '6/8').correct).toBe(true)
    expect(checkAnswer(q({ answer: '0.5' }), '1/2').correct).toBe(true)
    expect(checkAnswer(q({ answer: '1/3' }), '2/6').correct).toBe(true)
  })
  it('requireForm only when the task demands it', () => {
    const r = checkAnswer(q({ answer: '3/4', requireForm: 'simplified-fraction' }), '6/8')
    expect(r.status).toBe('partial')
    expect(r.errorTag).toBe('not-simplified')
    expect(checkAnswer(q({ answer: '3/4', requireForm: 'simplified-fraction' }), '3/4').correct).toBe(true)
  })
  it('powers, roots and German notation', () => {
    expect(checkAnswer(q({ answer: '32' }), '2^5').correct).toBe(true)
    expect(checkAnswer(q({ answer: '5' }), '√25').correct).toBe(true)
    expect(checkAnswer(q({ answer: '9' }), '3²').correct).toBe(true)
    expect(checkAnswer(q({ answer: '2' }), '6:3').correct).toBe(true)
  })
  it('algebraic expressions in any equivalent form', () => {
    expect(checkAnswer(q({ answer: 'x^2 + 6x + 9' }), '(x+3)^2').correct).toBe(true)
    expect(checkAnswer(q({ answer: '2x + 3' }), '3 + 2*x').correct).toBe(true)
    expect(checkAnswer(q({ answer: '2x + 3' }), '2x - 3').correct).toBe(false)
    expect(checkAnswer(q({ answer: 'x^2 - 9' }), '(x-3)(x+3)').correct).toBe(true)
  })
  it('equation solutions', () => {
    expect(checkAnswer(q({ answer: 'x = 4' }), '4').correct).toBe(true)
    expect(checkAnswer(q({ answer: 'x = 4' }), 'x=4').correct).toBe(true)
    expect(checkAnswer(q({ answer: 'x = 4' }), 'L = {4}').correct).toBe(true)
    expect(checkAnswer(q({ answer: 'x = 2,5' }), '5/2').correct).toBe(true)
    const sign = checkAnswer(q({ answer: 'x = 4' }), '-4')
    expect(sign.correct).toBe(false)
    expect(sign.errorTag).toBe('sign-error')
    expect(checkAnswer(q({ answer: 'x = 2; x = -3' }), '-3; 2').correct).toBe(true)
    expect(checkAnswer(q({ answer: 'x = 2; x = -3' }), 'x1 = 2, x2 = -3').correct).toBe(true)
    expect(checkAnswer(q({ answer: 'x = 2; x = -3' }), '2').status).toBe('partial')
  })
  it('unreadable input is not counted as wrong', () => {
    expect(checkAnswer(q({ answer: '3/4' }), '3//4').status).toBe('unreadable')
  })
})

describe('numeric answers', () => {
  const nq = (answer: string, extra: Partial<Question> = {}) => q({ type: 'numeric', answer, ...extra })
  it('accepts German decimal comma and units', () => {
    expect(checkAnswer(nq('12.5', { unit: 'cm' }), '12,5 cm').correct).toBe(true)
    expect(checkAnswer(nq('12.5', { unit: 'cm' }), '12,5').correct).toBe(true)
    expect(checkAnswer(nq('1250'), '1.250').correct).toBe(true)
    expect(checkAnswer(nq('1250.5'), '1.250,5').correct).toBe(true)
  })
  it('rounding to the stated precision', () => {
    expect(checkAnswer(nq('12.57'), '12,566').correct).toBe(true)
    expect(checkAnswer(nq('12.57'), '12,6').status).toBe('partial')
  })
  it('detects sign errors', () => {
    expect(checkAnswer(nq('-7'), '7').errorTag).toBe('sign-error')
  })
})

describe('vocabulary', () => {
  const vq = (answer: string) => q({ type: 'vocab', answer })
  it('accepts any listed meaning and optional "to"', () => {
    expect(checkAnswer(vq('to improve; to get better'), 'improve').correct).toBe(true)
    expect(checkAnswer(vq('to improve; to get better'), 'to get better').correct).toBe(true)
  })
  it('optional parts in parentheses', () => {
    expect(checkAnswer(vq('(sich) verbessern'), 'verbessern').correct).toBe(true)
    expect(checkAnswer(vq('(sich) verbessern'), 'sich verbessern').correct).toBe(true)
  })
  it('umlaut alternatives and case', () => {
    expect(checkAnswer(vq('die Lösung'), 'die loesung').correct).toBe(true)
    expect(checkAnswer(vq('Straße'), 'strasse').correct).toBe(true)
  })
  it('articles: missing ok, wrong is half', () => {
    expect(checkAnswer(vq('die Umwelt'), 'Umwelt').correct).toBe(true)
    const wrong = checkAnswer(vq('die Umwelt'), 'der Umwelt')
    expect(wrong.status).toBe('partial')
    expect(wrong.errorTag).toBe('article')
  })
  it('typos are half right and named', () => {
    const r = checkAnswer(vq('environment'), 'enviroment')
    expect(r.status).toBe('partial')
    expect(r.errorTag).toBe('spelling')
    expect(checkAnswer(vq('cat'), 'car').status).toBe('wrong')
  })
})

describe('multiple choice / true-false / free text', () => {
  it('mc explains the chosen wrong option', () => {
    const mq = q({ type: 'mc', options: ['A', 'B', 'C'], correctIndex: 1, optionFeedback: ['A ist falsch, weil …', 'Genau.', 'C verwechselt …'] })
    expect(checkAnswer(mq, '1').correct).toBe(true)
    const r = checkAnswer(mq, '2')
    expect(r.correct).toBe(false)
    expect(r.feedback).toContain('C verwechselt')
  })
  it('tf', () => {
    expect(checkAnswer(q({ type: 'tf', correctBool: false }), 'false').correct).toBe(true)
    expect(checkAnswer(q({ type: 'tf', correctBool: false }), 'true').correct).toBe(false)
  })
  it('free text keyword groups', () => {
    const tq = q({ type: 'text', answer: 'Pflanzen bauen mit Licht aus CO2 und Wasser Glucose auf.', keywords: [['licht', 'sonne'], ['co2', 'kohlenstoffdioxid'], ['glucose', 'traubenzucker', 'zucker']] })
    expect(checkAnswer(tq, 'Mit Sonnenlicht wird aus Kohlenstoffdioxid und Wasser Traubenzucker').correct).toBe(true)
    expect(checkAnswer(tq, 'Mit Licht und CO2').status).toBe('partial')
    expect(checkAnswer(tq, 'keine Ahnung').status).toBe('wrong')
  })
  it('long free text without keywords asks for self-assessment', () => {
    expect(checkAnswer(q({ type: 'text', answer: 'Eine längere Musterlösung mit mehreren Sätzen.' }), 'Meine Antwort').status).toBe('self-assess')
  })
})

describe('step checking', () => {
  it('finds the first wrong step of an equation', () => {
    const r = checkEquationSteps(['3x + 5 = 20', '3x = 25', 'x = 25/3'], 'x', [5])
    expect(r.firstError).toBe(1)
    const ok = checkEquationSteps(['3x + 5 = 20 | -5', '3x = 15 | :3', 'x = 5'], 'x', [5])
    expect(ok.firstError).toBeNull()
    expect(ok.lines.every((l) => l.ok)).toBe(true)
  })
  it('handles quadratic equations', () => {
    const r = checkEquationSteps(['x^2 - x - 6 = 0', '(x-3)(x+2) = 0', '(x+3)(x-2) = 0'], 'x', [-2, 3])
    expect(r.firstError).toBe(2)
  })
  it('finds a broken term transformation', () => {
    const r = checkExpressionSteps(['2(x+3) - x', '2x + 3 - x', 'x + 3'], '2(x+3) - x')
    expect(r.firstError).toBe(1)
  })
  it('solution set parsing and equivalence helpers', () => {
    expect(parseSolutionSet('L = {2; -3}')).toEqual([-3, 2])
    expect(parseSolutionSet('x = 2,5')).toEqual([2.5])
    expect(expressionsEquivalent('2(a+b)', '2a+2b')).toBe(true)
  })
})

describe('form requirements and systems of equations', () => {
  it('expanded form: original expression is not accepted as "ausmultipliziert"', () => {
    const fq = q({ answer: 'x^2 + 10x + 25', requireForm: 'expanded' })
    expect(checkAnswer(fq, 'x² + 10x + 25').correct).toBe(true)
    expect(checkAnswer(fq, '25 + 10x + x^2').correct).toBe(true)
    expect(checkAnswer(fq, '(x+5)^2').status).toBe('partial')
  })
  it('factored form', () => {
    const fq = q({ answer: '3x(2x + 3)', requireForm: 'factored' })
    expect(checkAnswer(fq, '3x(2x+3)').correct).toBe(true)
    expect(checkAnswer(fq, '(2x+3)*3x').correct).toBe(true)
    expect(checkAnswer(fq, '6x^2 + 9x').status).toBe('partial')
  })
  it('simplified', () => {
    const fq = q({ answer: 'a^8', requireForm: 'simplified' })
    expect(checkAnswer(fq, 'a^8').correct).toBe(true)
    expect(checkAnswer(fq, 'a^3*a^5').status).toBe('partial')
  })
  it('systems: values must match their variable', () => {
    const sq = q({ answer: 'x = 6; y = 4' })
    expect(checkAnswer(sq, 'x=6; y=4').correct).toBe(true)
    expect(checkAnswer(sq, 'y = 4, x = 6').correct).toBe(true)
    expect(checkAnswer(sq, 'x = 4; y = 6').correct).toBe(false)
    expect(checkAnswer(sq, '6; 4').status).toBe('unreadable')
    expect(checkAnswer(sq, 'x = 6; y = 5').status).toBe('partial')
  })
  it('repeated variable means a solution set, not a system', () => {
    expect(checkAnswer(q({ answer: 'x = 7; x = -7' }), '-7; 7').correct).toBe(true)
  })
})

describe('numeric edge cases', () => {
  it('years are never "rounding" errors', () => {
    const r = checkAnswer(q({ type: 'numeric', answer: '1914' }), '1918')
    expect(r.status).toBe('wrong')
    expect(r.errorTag).toBeNull()
  })
})
