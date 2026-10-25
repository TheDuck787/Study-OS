import { describe, expect, it } from 'vitest'
import { BUILTIN_SCALES, gradeLabelToNumber, percentToGrade, validateScale } from '@/lib/grading'

const standard = BUILTIN_SCALES[0]

describe('percentToGrade', () => {
  it('maps band boundaries correctly', () => {
    expect(percentToGrade(100, standard).grade).toBe(1)
    expect(percentToGrade(87, standard).grade).toBe(1)
    expect(percentToGrade(86.9, standard).grade).toBe(2)
    expect(percentToGrade(73, standard).grade).toBe(2)
    expect(percentToGrade(59, standard).grade).toBe(3)
    expect(percentToGrade(45, standard).grade).toBe(4)
    expect(percentToGrade(44.9, standard).grade).toBe(5)
    expect(percentToGrade(18, standard).grade).toBe(5)
    expect(percentToGrade(17, standard).grade).toBe(6)
    expect(percentToGrade(0, standard).grade).toBe(6)
  })
  it('adds tendencies inside a band', () => {
    expect(percentToGrade(85, standard).label).toBe('2+')
    expect(percentToGrade(74, standard).label).toBe('2-')
    expect(percentToGrade(79, standard).label).toBe('2')
    expect(percentToGrade(99, standard).label).toBe('1')
    expect(percentToGrade(5, standard).label).toBe('6')
  })
  it('clamps out-of-range input', () => {
    expect(percentToGrade(130, standard).grade).toBe(1)
    expect(percentToGrade(-5, standard).grade).toBe(6)
  })
  it('works without tendencies', () => {
    expect(percentToGrade(74, { ...standard, tendencies: false }).label).toBe('2')
  })
})

describe('validateScale', () => {
  it('accepts built-in scales', () => {
    for (const s of BUILTIN_SCALES) expect(validateScale(s.thresholds)).toBeNull()
  })
  it('rejects non-decreasing thresholds', () => {
    const bad = standard.thresholds.map((t) => (t.grade === 3 ? { ...t, minPercent: 80 } : t))
    expect(validateScale(bad)).toMatch(/Note 3/)
  })
  it('requires grade 6 at 0 %', () => {
    const bad = standard.thresholds.map((t) => (t.grade === 6 ? { ...t, minPercent: 5 } : t))
    expect(validateScale(bad)).toMatch(/0 %/)
  })
})

describe('gradeLabelToNumber', () => {
  it('parses tendencies and decimals', () => {
    expect(gradeLabelToNumber('2-')).toBeCloseTo(2.3)
    expect(gradeLabelToNumber('3+')).toBeCloseTo(2.7)
    expect(gradeLabelToNumber('2,5')).toBe(2.5)
    expect(gradeLabelToNumber('7')).toBeNull()
  })
})
