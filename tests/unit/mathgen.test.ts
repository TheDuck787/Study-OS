import { describe, expect, it } from 'vitest'
import { SKILLS, generateQuestion } from '@/lib/mathgen'
import { checkAnswer } from '@/lib/answerCheck'
import { checkEquationSteps, evaluateNumber } from '@/lib/mathcheck'
import type { Difficulty } from '@/db/types'

const ctx = { subjectId: 's', topicId: 't' }

describe('math generators', () => {
  for (const skill of SKILLS) {
    for (const d of [1, 2, 3, 4] as Difficulty[]) {
      it(`${skill.key} d${d}: own answer is accepted, prompts are complete`, () => {
        for (let seed = 1; seed <= 60; seed++) {
          const q = generateQuestion(skill.key, d, ctx, seed * 7919 + d)
          expect(q.prompt).not.toMatch(/undefined|NaN|Infinity/)
          expect(q.answer).not.toMatch(/undefined|NaN|Infinity/)
          expect(q.hints.length).toBeGreaterThan(0)
          const r = checkAnswer(q, q.answer)
          if (!r.correct) throw new Error(`${skill.key} d${d} seed ${seed}: "${q.answer}" not accepted (${r.status}: ${r.feedback}) – ${q.prompt}`)
          if (q.stepCheck?.kind === 'equation' && q.stepCheck.equation) {
            const sc = q.stepCheck
            const res = checkEquationSteps([sc.equation!], sc.variable, sc.solutions)
            if (res.firstError !== null || res.lines[0].ok !== true) throw new Error(`${skill.key} seed ${seed}: equation "${sc.equation}" does not have solutions ${sc.solutions}`)
          }
        }
      })
    }
  }
  it('numeric answers are finite numbers', () => {
    const q = generateQuestion('pythagoras', 3, ctx, 42)
    expect(evaluateNumber(q.answer)).not.toBeNull()
  })
  it('German decimal comma in displayed math', () => {
    let found = false
    for (let seed = 1; seed < 200 && !found; seed++) {
      const q = generateQuestion('lin-eq', 4, ctx, seed)
      if (/\{,\}/.test(q.prompt + q.explanation)) found = true
      expect(q.prompt).not.toMatch(/\$[^$]*\d\.\d[^$]*\$/)
    }
    expect(found).toBe(true)
  })
})
