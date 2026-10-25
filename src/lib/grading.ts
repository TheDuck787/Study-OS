import type { GradingScale, GradeThreshold } from '@/db/types'

export const GRADE_NAMES: Record<number, string> = {
  1: 'sehr gut',
  2: 'gut',
  3: 'befriedigend',
  4: 'ausreichend',
  5: 'mangelhaft',
  6: 'ungenügend',
}

const t = (p1: number, p2: number, p3: number, p4: number, p5: number): GradeThreshold[] => [
  { grade: 1, minPercent: p1 },
  { grade: 2, minPercent: p2 },
  { grade: 3, minPercent: p3 },
  { grade: 4, minPercent: p4 },
  { grade: 5, minPercent: p5 },
  { grade: 6, minPercent: 0 },
]

/** Common scales. Teachers differ – the student can add their teacher's own scale. */
export const BUILTIN_SCALES: GradingScale[] = [
  {
    id: 'scale-standard',
    name: 'Üblicher Schulschlüssel',
    description: '1 ab 87 %, 2 ab 73 %, 3 ab 59 %, 4 ab 45 %, 5 ab 18 % – häufig an Gesamtschulen verwendet.',
    thresholds: t(87, 73, 59, 45, 18),
    tendencies: true,
    builtin: true,
  },
  {
    id: 'scale-ihk',
    name: 'IHK-Schlüssel',
    description: '1 ab 92 %, 2 ab 81 %, 3 ab 67 %, 4 ab 50 %, 5 ab 30 %.',
    thresholds: t(92, 81, 67, 50, 30),
    tendencies: true,
    builtin: true,
  },
  {
    id: 'scale-linear',
    name: 'Linear (strenger)',
    description: '1 ab 90 %, 2 ab 80 %, 3 ab 65 %, 4 ab 50 %, 5 ab 25 %.',
    thresholds: t(90, 80, 65, 50, 25),
    tendencies: true,
    builtin: true,
  },
]

export interface GradeResult {
  grade: number // 1..6
  label: string // e.g. "2-" or "3"
  name: string // e.g. "gut"
}

/** Validates a scale: grades 1..6 present, thresholds strictly decreasing, 6 at 0 %. */
export function validateScale(thresholds: GradeThreshold[]): string | null {
  const sorted = [...thresholds].sort((a, b) => a.grade - b.grade)
  if (sorted.length !== 6 || sorted.some((s, i) => s.grade !== i + 1)) return 'Es müssen genau die Noten 1 bis 6 vorkommen.'
  for (const s of sorted) {
    if (!Number.isFinite(s.minPercent) || s.minPercent < 0 || s.minPercent > 100) return 'Prozentwerte müssen zwischen 0 und 100 liegen.'
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPercent >= sorted[i - 1].minPercent) return `Note ${sorted[i].grade} muss eine niedrigere Grenze haben als Note ${sorted[i - 1].grade}.`
  }
  if (sorted[5].minPercent !== 0) return 'Note 6 muss bei 0 % beginnen.'
  return null
}

/**
 * Maps a percentage to a German grade (1 best … 6 worst).
 * Tendencies: the upper third of a band gets "+", the lower third "−" (never for 1+ above 100 or 6−).
 */
export function percentToGrade(percent: number, scale: GradingScale): GradeResult {
  const p = Math.max(0, Math.min(100, percent))
  const sorted = [...scale.thresholds].sort((a, b) => a.grade - b.grade)
  const idx = sorted.findIndex((s) => p >= s.minPercent)
  const band = sorted[idx === -1 ? sorted.length - 1 : idx]
  const grade = band.grade
  let label = String(grade)
  if (scale.tendencies && grade < 6) {
    const upper = idx === 0 ? 100 : sorted[idx - 1].minPercent
    const width = upper - band.minPercent
    if (width > 0) {
      const pos = (p - band.minPercent) / width
      if (pos >= 2 / 3 && grade > 1) label = `${grade}+`
      else if (pos >= 2 / 3 && grade === 1) label = '1'
      else if (pos < 1 / 3) label = `${grade}-`
    }
  }
  return { grade, label, name: GRADE_NAMES[grade] }
}

/** Parses teacher grades like "2-", "3+", "2,5", "1" into a number for averages. */
export function gradeLabelToNumber(label: string): number | null {
  const s = label.trim().replace(',', '.')
  const m = /^([1-6])\s*([+-])?$/.exec(s)
  if (m) {
    const base = Number(m[1])
    if (m[2] === '+') return base - 0.3
    if (m[2] === '-') return base + 0.3
    return base
  }
  const n = Number(s)
  if (Number.isFinite(n) && n >= 1 && n <= 6) return n
  return null
}
