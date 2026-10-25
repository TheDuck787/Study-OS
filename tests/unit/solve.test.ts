import { describe, expect, it } from 'vitest'
import { solveEquation } from '@/lib/mathcheck'

describe('solveEquation', () => {
  it('solves linear and quadratic equations', () => {
    expect(solveEquation('3x + 5 = 20')?.solutions).toEqual([5])
    expect(solveEquation('x^2 - x - 6 = 0')?.solutions).toEqual([-2, 3])
    expect(solveEquation('2(x-1) = x + 4')?.solutions).toEqual([6])
    expect(solveEquation('x^2 + 1 = 0')?.solutions).toEqual([])
    expect(solveEquation('3x + 5 = 20 | -5')?.solutions).toEqual([5])
  })
  it('refuses equations it cannot check', () => {
    expect(solveEquation('x^3 = 8')).toBeNull()
    expect(solveEquation('5 = 5')).toBeNull()
    expect(solveEquation('kein = gleichung = hier')).toBeNull()
  })
})
