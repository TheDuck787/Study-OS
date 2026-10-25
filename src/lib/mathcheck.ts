import { create, all, type MathNode } from 'mathjs'

const math = create(all, {})

export interface ParsedMath {
  node: MathNode
  symbols: string[]
}

/**
 * Converts typical school notation into something mathjs understands:
 * 2,5 → 2.5 · 3·x → 3*x · 6:3 → 6/3 · x² → x^2 · √2 → sqrt(2) · π → pi · − → -
 */
export function normalizeMathInput(raw: string): string {
  let s = raw.trim()
  s = s.replace(/[−–—]/g, '-')
  s = s.replace(/[·×⋅∙]/g, '*')
  s = s.replace(/÷/g, '/')
  s = s.replace(/(\d)\s*:\s*(\d)/g, '$1/$2')
  s = s.replace(/(\d),(\d)/g, '$1.$2')
  s = s.replace(/²/g, '^2').replace(/³/g, '^3')
  s = s.replace(/√\s*\(/g, 'sqrt(')
  s = s.replace(/√\s*([0-9.]+|[a-z])/gi, 'sqrt($1)')
  s = s.replace(/π/g, 'pi')
  s = s.replace(/\*\*/g, '^')
  // "3x(2x+3)": a single-letter variable before a bracket is a product, not a function call
  s = s.replace(/(^|[^a-z])([a-z])\s*\(/gi, '$1$2*(')
  s = s.replace(/\s+/g, ' ')
  return s
}

export function parseMath(raw: string): ParsedMath | null {
  const s = normalizeMathInput(raw)
  if (!s || /[=<>]/.test(s)) return null
  try {
    const node = math.parse(s)
    const symbols = new Set<string>()
    node.traverse((n) => {
      if (n.type === 'SymbolNode') {
        const name = (n as unknown as { name: string }).name
        // functions like sqrt appear as SymbolNode children of FunctionNode – skip constants & functions
        if (!['pi', 'e', 'sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'ln', 'exp'].includes(name)) symbols.add(name)
      }
    })
    return { node, symbols: [...symbols].sort() }
  } catch {
    return null
  }
}

export function evaluateNumber(raw: string, scope: Record<string, number> = {}): number | null {
  const p = parseMath(raw)
  if (!p) return null
  try {
    const v = p.node.evaluate(scope)
    const n = typeof v === 'number' ? v : Number(v?.valueOf?.())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function nearlyEqual(a: number, b: number, absTol = 1e-9, relTol = 1e-9): boolean {
  return Math.abs(a - b) <= Math.max(absTol, relTol * Math.max(Math.abs(a), Math.abs(b)))
}

/** Expressions are equivalent if they agree at several random points (robust for school algebra). */
export function expressionsEquivalent(aRaw: string, bRaw: string): boolean | null {
  const a = parseMath(aRaw)
  const b = parseMath(bRaw)
  if (!a || !b) return null
  const symbols = [...new Set([...a.symbols, ...b.symbols])]
  const points = [0.37, 1.91, -2.73, 3.14159, -0.61, 5.5, 0.073]
  let compared = 0
  for (let i = 0; i < points.length; i++) {
    const scope: Record<string, number> = {}
    symbols.forEach((s, j) => (scope[s] = points[(i + j * 3) % points.length] + j * 0.11))
    let va: number, vb: number
    try {
      va = Number(a.node.evaluate(scope))
      vb = Number(b.node.evaluate(scope))
    } catch {
      return null
    }
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue
    compared++
    if (!nearlyEqual(va, vb, 1e-7, 1e-7)) return false
  }
  return compared >= 3 ? true : null
}

/**
 * Parses a set of solutions such as "x = 2; x = -3", "L = {2; -3}", "x1=2, x2=-3", "-3 und 2".
 * Commas followed by a space separate solutions; "2,5" (no space) is a decimal number.
 */
export function parseSolutionSet(raw: string): number[] | null {
  let s = raw.trim()
  if (!s) return null
  s = s.replace(/^\s*l\s*=\s*/i, '')
  s = s.replace(/[{}]/g, '')
  const parts = s
    .split(/\s*;\s*|\s*\|\s*|\s+und\s+|\s+oder\s+|,\s+|\s*∨\s*/i)
    .map((p) => p.replace(/^[a-z](?:_?\d)?\s*=\s*/i, '').trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const out: number[] = []
  for (const p of parts) {
    const v = evaluateNumber(p)
    if (v === null) return null
    out.push(v)
  }
  return out.sort((a, b) => a - b)
}

export function looksLikeSolutionSet(expected: string): boolean {
  return /^\s*(l\s*=|[a-z](?:_?\d)?\s*=)/i.test(expected) || expected.includes(';')
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

/** True if the input is an integer or a fraction in lowest terms (e.g. "3/4", "-5/2", "2"). */
export function isSimplifiedFraction(raw: string): boolean {
  const s = normalizeMathInput(raw).replace(/\s+/g, '').replace(/^\((.*)\)$/, '$1')
  if (/^-?\d+$/.test(s)) return true
  const m = /^(-?)(\d+)\/(\d+)$/.exec(s)
  if (!m) return false
  const n = Number(m[2])
  const d = Number(m[3])
  return d > 1 && gcd(n, d) === 1
}

/** Number of decimals written in a canonical answer like "12.57" → 2. */
export function decimalsOf(raw: string): number {
  const m = /[.,](\d+)\s*$/.exec(raw.trim())
  return m ? m[1].length : 0
}

export interface StepCheckLine {
  input: string
  ok: boolean | null
  message: string
}

/**
 * Checks a student's step-by-step solution of an equation.
 * Each line must be an equation with exactly the same solutions as the original.
 * The first line that changes the solution set is where the reasoning went wrong.
 * Annotations after "|" (e.g. "| -5") are ignored.
 */
export function checkEquationSteps(lines: string[], variable: string, solutions: number[]): { lines: StepCheckLine[]; firstError: number | null } {
  const result: StepCheckLine[] = []
  let firstError: number | null = null
  const probes = [solutions[0] + 1.37, solutions[0] - 2.19, 7.31]
  for (const rawLine of lines) {
    const line = rawLine.split('|')[0].trim()
    if (!line) continue
    const sides = line.split('=')
    if (sides.length !== 2) {
      result.push({ input: rawLine, ok: null, message: 'Keine Gleichung mit genau einem „=“ – diese Zeile wurde übersprungen.' })
      continue
    }
    const [lhs, rhs] = sides
    const diffAt = (x: number): number | null => {
      const a = evaluateNumber(lhs, { [variable]: x })
      const b = evaluateNumber(rhs, { [variable]: x })
      return a === null || b === null ? null : a - b
    }
    const atSolutions = solutions.map(diffAt)
    if (atSolutions.some((d) => d === null)) {
      result.push({ input: rawLine, ok: null, message: 'Diese Zeile konnte ich nicht lesen. Schreibe z. B. „3x + 5 = 20“.' })
      continue
    }
    const keepsSolutions = atSolutions.every((d) => Math.abs(d as number) < 1e-7)
    const identity = probes.every((x) => {
      const d = diffAt(x)
      return d !== null && Math.abs(d) < 1e-7
    })
    let ok = true
    let message = 'Richtig umgeformt.'
    if (!keepsSolutions) {
      ok = false
      message = 'Hier ändert sich die Lösung – in diesem Schritt steckt ein Fehler. Prüfe Vorzeichen und ob du auf beiden Seiten dasselbe gerechnet hast.'
    } else if (identity) {
      ok = false
      message = 'Diese Zeile gilt für jedes x – dabei ist eine Information verloren gegangen.'
    } else if (solutions.length === 1) {
      // A linear step may also introduce extra solutions (e.g. squaring). Check one more probe set.
      const extra = probes.some((x) => {
        const d = diffAt(x)
        return d !== null && Math.abs(d) < 1e-7
      })
      if (extra) {
        ok = false
        message = 'Diese Zeile hat zusätzliche Lösungen bekommen.'
      }
    }
    if (!ok && firstError === null) firstError = result.length
    result.push({ input: rawLine, ok, message })
  }
  return { lines: result, firstError }
}

/** Checks a chain of expression transformations (e.g. simplifying a term). */
export function checkExpressionSteps(lines: string[], original: string): { lines: StepCheckLine[]; firstError: number | null } {
  const result: StepCheckLine[] = []
  let firstError: number | null = null
  for (const rawLine of lines) {
    const line = rawLine.replace(/^=\s*/, '').split('|')[0].trim()
    if (!line) continue
    const eq = expressionsEquivalent(line, original)
    if (eq === null) {
      result.push({ input: rawLine, ok: null, message: 'Diese Zeile konnte ich nicht lesen.' })
      continue
    }
    if (!eq && firstError === null) firstError = result.length
    result.push({ input: rawLine, ok: eq, message: eq ? 'Gleichwertig zum Ausgangsterm.' : 'Ab hier ist der Term nicht mehr gleichwertig – in diesem Schritt steckt der Fehler.' })
  }
  return { lines: result, firstError }
}

/** Evaluates f(x) for plotting. Returns null where undefined. */
export function compileFunction(raw: string): ((x: number) => number | null) | null {
  const body = raw.replace(/^\s*(?:[a-z]\s*\(\s*x\s*\)|y)\s*=\s*/i, '')
  const p = parseMath(body)
  if (!p || p.symbols.some((s) => s !== 'x')) return null
  const compiled = p.node.compile()
  return (x: number) => {
    try {
      const v = Number(compiled.evaluate({ x }))
      return Number.isFinite(v) ? v : null
    } catch {
      return null
    }
  }
}

/** Converts a simple expression to LaTeX for display (falls back to raw text). */
export function toTex(raw: string): string {
  const p = parseMath(raw)
  if (!p) return raw
  try {
    return p.node.toTex({ parenthesis: 'auto', implicit: 'hide' })
  } catch {
    return raw
  }
}

/**
 * Named assignments like "x = 6; y = 4" (systems of equations). Returns null if a part has no
 * variable name or if a name repeats (then it is a solution set like "x = 7; x = -7").
 */
export function parseAssignments(raw: string): Map<string, number> | null {
  const parts = raw
    .trim()
    .replace(/[{}()]/g, ' ')
    .split(/\s*;\s*|\s*\|\s*|\s+und\s+|,\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
  const out = new Map<string, number>()
  for (const p of parts) {
    const m = /^([a-z])\s*=\s*(.+)$/i.exec(p)
    if (!m) return null
    const name = m[1].toLowerCase()
    if (out.has(name)) return null
    const v = evaluateNumber(m[2])
    if (v === null) return null
    out.set(name, v)
  }
  return out.size > 0 ? out : null
}

export function nodeCount(raw: string): number | null {
  const p = parseMath(raw)
  if (!p) return null
  let n = 0
  p.node.traverse(() => {
    n++
  })
  return n
}

/** Returns a German hint if the task asks for a specific form and the (already equivalent) input is not in it. */
export function formViolation(given: string, answer: string, form: 'simplified-fraction' | 'expanded' | 'factored' | 'simplified'): string | null {
  const g = normalizeMathInput(given)
  switch (form) {
    case 'simplified-fraction':
      return isSimplifiedFraction(given) ? null : 'Der Wert stimmt! Aber der Bruch ist noch nicht vollständig gekürzt (oder nicht als Bruch geschrieben).'
    case 'expanded': {
      const withoutFns = g.replace(/sqrt\(/g, '')
      if (withoutFns.includes('(')) return 'Der Term ist gleichwertig, aber noch nicht ausmultipliziert – löse die Klammern auf.'
      const gc = nodeCount(given)
      const ac = nodeCount(answer)
      if (gc !== null && ac !== null && gc > ac + 2) return 'Der Term ist gleichwertig, aber noch nicht zusammengefasst.'
      return null
    }
    case 'factored': {
      const p = parseMath(given)
      const isProduct = p && p.node.type === 'OperatorNode' && (p.node as unknown as { fn: string }).fn === 'multiply'
      return isProduct && g.includes('(') ? null : 'Der Term ist gleichwertig, aber nicht als Produkt geschrieben – klammere den gemeinsamen Faktor aus.'
    }
    case 'simplified': {
      const gc = nodeCount(given)
      const ac = nodeCount(answer)
      return gc !== null && ac !== null && gc > ac + 2 ? 'Der Term ist gleichwertig, aber noch nicht vereinfacht.' : null
    }
  }
}

/**
 * Solves linear and quadratic equations in one variable (by sampling the polynomial lhs − rhs).
 * Returns null for other equation types, so the UI can say it cannot check them.
 */
export function solveEquation(equation: string, variable = 'x'): { solutions: number[]; kind: 'linear' | 'quadratic' } | null {
  const sides = equation.split('|')[0].split('=')
  if (sides.length !== 2) return null
  const f = (x: number) => {
    const a = evaluateNumber(sides[0], { [variable]: x })
    const b = evaluateNumber(sides[1], { [variable]: x })
    return a === null || b === null ? null : a - b
  }
  const vals = [0, 1, -1, 2, 3].map(f)
  if (vals.some((v) => v === null)) return null
  const [f0, f1, fm1, f2, f3] = vals as number[]
  const c = f0
  const a = (f1 + fm1 - 2 * c) / 2
  const b = (f1 - fm1) / 2
  const poly = (x: number) => a * x * x + b * x + c
  if (!nearlyEqual(poly(2), f2, 1e-7, 1e-7) || !nearlyEqual(poly(3), f3, 1e-7, 1e-7)) return null
  const round = (v: number) => Math.round(v * 1e9) / 1e9
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return null
    return { solutions: [round(-c / b)], kind: 'linear' }
  }
  const disc = b * b - 4 * a * c
  if (disc < -1e-12) return { solutions: [], kind: 'quadratic' }
  if (Math.abs(disc) < 1e-12) return { solutions: [round(-b / (2 * a))], kind: 'quadratic' }
  const r = Math.sqrt(disc)
  return { solutions: [round((-b - r) / (2 * a)), round((-b + r) / (2 * a))].sort((p, q) => p - q), kind: 'quadratic' }
}
