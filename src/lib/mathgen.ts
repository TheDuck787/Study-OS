import type { Difficulty, Question } from '@/db/types'
import { seededRandom } from './id'

/**
 * Procedural math exercises. Every generator returns a complete question with
 * solution steps, progressive hints (each reveals only the next useful step) and,
 * for equations, metadata for line-by-line step checking. Answers are checked with
 * mathjs, so equivalent forms are accepted.
 */

export interface SkillDef {
  key: string
  name: string
  topicKey: string
  description: string
}

export const SKILLS: SkillDef[] = [
  { key: 'frac-add', name: 'Brüche addieren und subtrahieren', topicKey: 'ma-brueche', description: 'Hauptnenner finden, erweitern, zusammenfassen.' },
  { key: 'frac-muldiv', name: 'Brüche multiplizieren und dividieren', topicKey: 'ma-brueche', description: 'Zähler mal Zähler, Nenner mal Nenner; teilen = mal Kehrwert.' },
  { key: 'frac-simplify', name: 'Brüche kürzen', topicKey: 'ma-brueche', description: 'Mit dem größten gemeinsamen Teiler kürzen.' },
  { key: 'expand', name: 'Binomische Formeln', topicKey: 'ma-terme', description: 'Klammern mit den binomischen Formeln auflösen.' },
  { key: 'lin-eq', name: 'Lineare Gleichungen', topicKey: 'ma-gleichungen', description: 'Mit Äquivalenzumformungen nach x auflösen.' },
  { key: 'lin-func', name: 'Lineare Funktionen', topicKey: 'ma-linfkt', description: 'Funktionswerte, Steigung, Nullstellen, Funktionsgleichungen.' },
  { key: 'lgs', name: 'Gleichungssysteme', topicKey: 'ma-lgs', description: 'Zwei Gleichungen mit zwei Variablen lösen.' },
  { key: 'powers', name: 'Potenzgesetze', topicKey: 'ma-potenzen', description: 'Potenzen multiplizieren, dividieren, potenzieren.' },
  { key: 'sqrt', name: 'Quadratwurzeln', topicKey: 'ma-potenzen', description: 'Wurzeln berechnen und vereinfachen.' },
  { key: 'pythagoras', name: 'Satz des Pythagoras', topicKey: 'ma-pythagoras', description: 'Fehlende Seiten im rechtwinkligen Dreieck berechnen.' },
  { key: 'quad-eq', name: 'Quadratische Gleichungen', topicKey: 'ma-quadgl', description: 'Wurzelziehen und p-q-Formel.' },
  { key: 'percent', name: 'Prozentrechnung', topicKey: 'ma-prozent', description: 'Prozentwert, Prozentsatz und Grundwert.' },
  { key: 'interest', name: 'Zinsrechnung', topicKey: 'ma-prozent', description: 'Jahreszinsen, Monatszinsen, Zinseszins.' },
  { key: 'volume', name: 'Körperberechnung', topicKey: 'ma-koerper', description: 'Volumen und Oberfläche von Quader, Prisma, Zylinder.' },
  { key: 'probability', name: 'Wahrscheinlichkeit', topicKey: 'ma-wkeit', description: 'Ein- und zweistufige Zufallsexperimente.' },
]

type Gen = Omit<Question, 'id' | 'subjectId' | 'topicId' | 'createdAt' | 'source' | 'skill' | 'points' | 'difficulty'> & { points?: number }

interface R {
  int(min: number, max: number, exclude?: number[]): number
  pick<T>(items: readonly T[]): T
  sign(): 1 | -1
}

function makeR(rand: () => number): R {
  return {
    int(min, max, exclude = []) {
      for (let i = 0; i < 100; i++) {
        const v = Math.floor(rand() * (max - min + 1)) + min
        if (!exclude.includes(v)) return v
      }
      return min
    },
    pick(items) {
      return items[Math.floor(rand() * items.length)]
    },
    sign() {
      return rand() < 0.5 ? 1 : -1
    },
  }
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a || 1
}
const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b)

/** Reduced fraction as answer text: "3/4", "-5/2", "2". */
export function fracText(n: number, d: number): string {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  n /= g
  d /= g
  return d === 1 ? String(n) : `${n}/${d}`
}
function fracTex(n: number, d: number): string {
  if (d < 0) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  n /= g
  d /= g
  if (d === 1) return String(n)
  return n < 0 ? `-\\frac{${-n}}{${d}}` : `\\frac{${n}}{${d}}`
}
const de = (x: number, digits = 2) => (Math.round(x * 10 ** digits) / 10 ** digits).toLocaleString('de-DE', { maximumFractionDigits: digits })
const dot = (x: number, digits = 2) => String(Math.round(x * 10 ** digits) / 10 ** digits)
/** Signed term for display: +3, −3 */
const sg = (v: number) => (v < 0 ? `- ${-v}` : `+ ${v}`)
/** Coefficient display: 1x → x, -1x → -x */
const cx = (a: number, v = 'x') => (a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`)

const GEN: Record<string, (d: Difficulty, r: R) => Gen> = {
  'frac-add': (d, r) => {
    let a: number, b: number, c: number, e: number
    if (d === 1) {
      e = b = r.int(3, 12)
      a = r.int(1, b - 1)
      c = r.int(1, b - 1)
    } else {
      b = r.int(2, 9)
      e = r.int(2, 9, [b])
      a = r.int(1, b * 2)
      c = r.int(1, e * 2)
    }
    const minus = d >= 3 && r.int(0, 1) === 1
    const L = lcm(b, e)
    const n = (a * L) / b + (minus ? -1 : 1) * ((c * L) / e)
    const op = minus ? '-' : '+'
    return {
      type: 'math',
      prompt: `Berechne und kürze: $\\frac{${a}}{${b}} ${op} \\frac{${c}}{${e}}$`,
      answer: fracText(n, L),
      explanation: `Hauptnenner ${L}: $\\frac{${(a * L) / b}}{${L}} ${op} \\frac{${(c * L) / e}}{${L}} = ${fracTex(n, L)}$.`,
      hints: b === e ? ['Die Nenner sind schon gleich – rechne nur mit den Zählern.'] : [`Suche zuerst den Hauptnenner von ${b} und ${e}.`, `Der Hauptnenner ist ${L}. Erweitere beide Brüche auf den Nenner ${L}.`, 'Jetzt die Zähler verrechnen, den Nenner behalten – und kürzen.'],
      steps: [`Hauptnenner: ${L}`, `Erweitern: $\\frac{${a}}{${b}} = \\frac{${(a * L) / b}}{${L}}$, $\\frac{${c}}{${e}} = \\frac{${(c * L) / e}}{${L}}$`, `Zähler verrechnen: $\\frac{${(a * L) / b} ${op} ${(c * L) / e}}{${L}} = \\frac{${n}}{${L}}$`, `Kürzen: $${fracTex(n, L)}$`],
    }
  },
  'frac-muldiv': (d, r) => {
    const a = r.int(1, 9), b = r.int(2, 10, [a]), c = r.int(1, 9), e = r.int(2, 10, [c])
    const div = d >= 2 && (d >= 3 ? r.int(0, 1) === 1 : true)
    const n = div ? a * e : a * c
    const m = div ? b * c : b * e
    return {
      type: 'math',
      prompt: `Berechne: $\\frac{${a}}{${b}} ${div ? ':' : '\\cdot'} \\frac{${c}}{${e}}$`,
      answer: fracText(n, m),
      explanation: div ? `Teilen durch einen Bruch heißt: mit dem Kehrwert malnehmen. $\\frac{${a}}{${b}} \\cdot \\frac{${e}}{${c}} = ${fracTex(n, m)}$.` : `Zähler mal Zähler, Nenner mal Nenner: $\\frac{${a * c}}{${b * e}} = ${fracTex(n, m)}$.`,
      hints: div ? ['Durch einen Bruch teilt man, indem man mit seinem Kehrwert multipliziert.', `Der Kehrwert von $\\frac{${c}}{${e}}$ ist $\\frac{${e}}{${c}}$.`] : ['Multipliziere Zähler mit Zähler und Nenner mit Nenner.', 'Am Ende kürzen (oder schon vorher über Kreuz kürzen).'],
      steps: div ? [`Kehrwert bilden: $\\frac{${e}}{${c}}$`, `Multiplizieren: $\\frac{${a} \\cdot ${e}}{${b} \\cdot ${c}} = \\frac{${n}}{${m}}$`, `Kürzen: $${fracTex(n, m)}$`] : [`$\\frac{${a} \\cdot ${c}}{${b} \\cdot ${e}} = \\frac{${n}}{${m}}$`, `Kürzen: $${fracTex(n, m)}$`],
    }
  },
  'frac-simplify': (d, r) => {
    const n0 = r.int(1, 9), d0 = r.int(n0 + 1, 12)
    const g0 = gcd(n0, d0)
    const n = n0 / g0, dd = d0 / g0
    const k = d === 1 ? r.pick([2, 3, 5]) : d === 2 ? r.int(3, 9) : r.int(6, 15)
    return {
      type: 'math',
      prompt: `Kürze vollständig: $\\frac{${n * k}}{${dd * k}}$`,
      answer: fracText(n, dd),
      requireForm: 'simplified-fraction',
      explanation: `Der größte gemeinsame Teiler von ${n * k} und ${dd * k} ist ${k}. $\\frac{${n * k} : ${k}}{${dd * k} : ${k}} = ${fracTex(n, dd)}$.`,
      hints: ['Suche eine Zahl, durch die Zähler und Nenner beide teilbar sind.', `Probiere es mit ${k}.`],
      steps: [`ggT(${n * k}, ${dd * k}) = ${k}`, `Zähler und Nenner durch ${k} teilen: $${fracTex(n, dd)}$`],
    }
  },
  expand: (d, r) => {
    const a = r.int(1, 9)
    const v = r.pick(['x', 'a', 'y'])
    if (d === 1 || d === 2) {
      const minus = d === 2
      const s = minus ? -1 : 1
      return {
        type: 'math', requireForm: 'expanded',
        prompt: `Multipliziere mit der ${minus ? '2.' : '1.'} binomischen Formel aus: $(${v} ${minus ? '-' : '+'} ${a})^2$`,
        answer: `${v}^2 ${s < 0 ? '-' : '+'} ${2 * a}${v} + ${a * a}`,
        explanation: `$(a ${minus ? '-' : '+'} b)^2 = a^2 ${minus ? '-' : '+'} 2ab + b^2$ mit $a = ${v}$, $b = ${a}$.`,
        hints: [`Formel: $(a ${minus ? '-' : '+'} b)^2 = a^2 ${minus ? '-' : '+'} 2ab + b^2$`, `Das Mittelglied ist $2 \\cdot ${v} \\cdot ${a} = ${2 * a}${v}$ – nicht vergessen!`],
        steps: [`$a = ${v}$, $b = ${a}$`, `$a^2 = ${v}^2$, $2ab = ${2 * a}${v}$, $b^2 = ${a * a}$`, `$${v}^2 ${minus ? '-' : '+'} ${2 * a}${v} + ${a * a}$`],
        stepCheck: { kind: 'expression', original: `(${v} ${minus ? '-' : '+'} ${a})^2` },
      }
    }
    const b = r.int(2, 5)
    if (d === 3) {
      return {
        type: 'math', requireForm: 'expanded',
        prompt: `Multipliziere mit der 3. binomischen Formel aus: $(${b}${v} + ${a})(${b}${v} - ${a})$`,
        answer: `${b * b}${v}^2 - ${a * a}`,
        explanation: `$(a + b)(a - b) = a^2 - b^2$: $(${b}${v})^2 - ${a}^2 = ${b * b}${v}^2 - ${a * a}$.`,
        hints: ['Formel: $(a + b)(a - b) = a^2 - b^2$', `Achtung: $(${b}${v})^2 = ${b * b}${v}^2$ – auch die ${b} wird quadriert.`],
        steps: [`$a = ${b}${v}$, $b = ${a}$`, `$a^2 - b^2 = (${b}${v})^2 - ${a}^2$`, `$= ${b * b}${v}^2 - ${a * a}$`],
        stepCheck: { kind: 'expression', original: `(${b}${v} + ${a})(${b}${v} - ${a})` },
      }
    }
    return {
      type: 'math', requireForm: 'expanded',
      prompt: `Multipliziere aus: $(${b}${v} + ${a})^2$`,
      answer: `${b * b}${v}^2 + ${2 * a * b}${v} + ${a * a}`,
      explanation: `$(${b}${v})^2 + 2 \\cdot ${b}${v} \\cdot ${a} + ${a}^2 = ${b * b}${v}^2 + ${2 * a * b}${v} + ${a * a}$.`,
      hints: ['1. binomische Formel: $(a + b)^2 = a^2 + 2ab + b^2$', `Hier ist $a = ${b}${v}$. Also $a^2 = ${b * b}${v}^2$.`, `Mittelglied: $2 \\cdot ${b}${v} \\cdot ${a}$`],
      steps: [`$a = ${b}${v}$, $b = ${a}$`, `$a^2 = ${b * b}${v}^2$; $2ab = ${2 * a * b}${v}$; $b^2 = ${a * a}$`, `$${b * b}${v}^2 + ${2 * a * b}${v} + ${a * a}$`],
      stepCheck: { kind: 'expression', original: `(${b}${v} + ${a})^2` },
    }
  },
  'lin-eq': (d, r) => {
    const x = d === 4 ? r.int(-9, 9) + r.pick([0.5, 0.25, 0]) : r.int(-9, 12)
    let prompt: string, steps: string[], hints: string[]
    if (d === 1) {
      const a = r.int(2, 9), b = r.int(-15, 15, [0])
      const c = a * x + b
      prompt = `${a}x ${sg(b)} = ${c}`
      steps = [`$${a}x ${sg(b)} = ${c} \\quad | ${b > 0 ? '-' : '+'} ${Math.abs(b)}$`, `$${a}x = ${c - b} \\quad | : ${a}$`, `$x = ${dot(x)}$`]
      hints = [`Bringe zuerst die ${Math.abs(b)} auf die rechte Seite: auf beiden Seiten ${b > 0 ? `− ${b}` : `+ ${-b}`}.`, `Jetzt steht da $${a}x = ${c - b}$. Teile beide Seiten durch ${a}.`]
    } else if (d === 2 || d === 4) {
      const a = r.int(2, 9), c = r.int(1, 9, [a]), b = r.int(-12, 12, [0])
      const e = Math.round((a * x + b - c * x) * 100) / 100
      prompt = `${a}x ${sg(b)} = ${cx(c)} ${sg(e)}`
      const k = a - c
      steps = [`$${a}x ${sg(b)} = ${cx(c)} ${sg(e)} \\quad | -${cx(c)}$`, `$${cx(k)} ${sg(b)} = ${e} \\quad | ${b > 0 ? '-' : '+'} ${Math.abs(b)}$`, `$${cx(k)} = ${dot(e - b)} \\quad | : ${k}$`, `$x = ${dot(x)}$`]
      hints = ['Sammle alle x auf einer Seite: Ziehe auf beiden Seiten das kleinere x-Glied ab.', `Nach dem Schritt steht da $${cx(k)} ${sg(b)} = ${e}$. Jetzt die Zahl ohne x auf die andere Seite bringen.`, `Zum Schluss durch ${k} teilen.`]
    } else {
      const a = r.int(2, 6), b = r.int(-6, 6, [0]), c = r.int(1, 9, [a])
      const e = a * (x + b) - c * x
      prompt = `${a}(x ${sg(b)}) = ${cx(c)} ${sg(e)}`
      const k = a - c
      steps = [`Klammer auflösen: $${a}x ${sg(a * b)} = ${cx(c)} ${sg(e)}$`, `$| -${cx(c)}$: $${cx(k)} ${sg(a * b)} = ${e}$`, `$| ${a * b > 0 ? '-' : '+'} ${Math.abs(a * b)}$: $${cx(k)} = ${e - a * b}$`, `$| : ${k}$: $x = ${x}$`]
      hints = [`Löse zuerst die Klammer auf: ${a} mal jeden Summanden.`, `Dann steht da $${a}x ${sg(a * b)} = ${cx(c)} ${sg(e)}$. Sammle die x auf einer Seite.`, 'Jetzt die Zahlen auf die andere Seite und durch den Faktor vor x teilen.']
    }
    return {
      type: 'math',
      prompt: `Löse die Gleichung: $${prompt}$`,
      answer: `x = ${dot(x)}`,
      explanation: `Durch Äquivalenzumformungen (auf beiden Seiten dasselbe rechnen) erhält man $x = ${dot(x).replace('.', '{,}')}$. Probe: Setze ${de(x)} in die Gleichung ein – beide Seiten ergeben dasselbe.`,
      hints,
      steps,
      stepCheck: { kind: 'equation', variable: 'x', solutions: [x], equation: prompt },
    }
  },
  'lin-func': (d, r) => {
    const m = r.int(-5, 5, [0]), n = r.int(-9, 9)
    const f = `${cx(m)} ${sg(n)}`.replace('+ 0', '').trim()
    if (d === 1) {
      const x = r.int(-5, 6)
      return { type: 'numeric', prompt: `Berechne $f(${x})$ für $f(x) = ${f}$.`, answer: String(m * x + n), explanation: `$f(${x}) = ${m} \\cdot ${x < 0 ? `(${x})` : x} ${sg(n)} = ${m * x + n}$.`, hints: [`Setze für x die Zahl ${x} ein.`], steps: [`$f(${x}) = ${m} \\cdot ${x < 0 ? `(${x})` : x} ${sg(n)}$`, `$= ${m * x} ${sg(n)} = ${m * x + n}$`] }
    }
    const x1 = r.int(-4, 3), x2 = x1 + r.int(1, 4)
    const y1 = m * x1 + n, y2 = m * x2 + n
    if (d === 2) {
      return { type: 'math', prompt: `Eine Gerade geht durch $P(${x1}|${y1})$ und $Q(${x2}|${y2})$. Berechne die Steigung m.`, answer: String(m), explanation: `$m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${y1 < 0 ? `(${y1})` : y1}}{${x2} - ${x1 < 0 ? `(${x1})` : x1}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${m}$.`, hints: ['Steigung = Höhenunterschied : Breitenunterschied', `$m = \\frac{y_2 - y_1}{x_2 - x_1}$`], steps: [`$y_2 - y_1 = ${y2 - y1}$`, `$x_2 - x_1 = ${x2 - x1}$`, `$m = ${m}$`] }
    }
    if (d === 3) {
      return { type: 'math', prompt: `Berechne die Nullstelle von $f(x) = ${f}$.`, answer: `x = ${fracText(-n, m)}`, explanation: `Nullstelle: $f(x) = 0$, also $${f} = 0 \\Rightarrow x = ${fracTex(-n, m)}$.`, hints: ['An der Nullstelle ist der Funktionswert 0: Setze $f(x) = 0$.', `Löse $${f} = 0$ nach x auf.`], steps: [`$${f} = 0$`, `$${cx(m)} = ${-n}$`, `$x = ${fracTex(-n, m)}$`], stepCheck: { kind: 'equation', variable: 'x', solutions: [-n / m], equation: `${f} = 0` } }
    }
    return { type: 'math', prompt: `Bestimme die Funktionsgleichung der Geraden durch $P(${x1}|${y1})$ und $Q(${x2}|${y2})$. Schreibe: y = …`, answer: `y = ${f}`, explanation: `Steigung $m = \\frac{${y2 - y1}}{${x2 - x1}} = ${m}$. Einsetzen von P: $${y1} = ${m} \\cdot ${x1 < 0 ? `(${x1})` : x1} + n \\Rightarrow n = ${n}$. Also $y = ${f}$.`, hints: ['Berechne zuerst die Steigung m.', `m = ${m}. Setze jetzt einen Punkt in $y = mx + n$ ein, um n zu finden.`], steps: [`$m = ${m}$`, `P einsetzen: $${y1} = ${m} \\cdot ${x1 < 0 ? `(${x1})` : x1} + n$`, `$n = ${n}$`, `$y = ${f}$`] }
  },
  lgs: (d, r) => {
    const x = r.int(-5, 8), y = r.int(-5, 8)
    if (d <= 2) {
      const s = x + y, t = x - y
      return { type: 'math', prompt: `Löse das Gleichungssystem und gib beide Werte an (z. B. „x = 1; y = 2“):\n\n$x + y = ${s}$\n\n$x - y = ${t}$`, answer: `x = ${x}; y = ${y}`, explanation: `Additionsverfahren: Beide Gleichungen addieren → $2x = ${s + t}$, also $x = ${x}$. Einsetzen: $y = ${s} - ${x < 0 ? `(${x})` : x} = ${y}$.`, hints: ['Addiere die beiden Gleichungen. Was passiert mit y?', `$2x = ${s + t}$ – jetzt x ausrechnen und in eine Gleichung einsetzen.`], steps: [`Addieren: $2x = ${s + t}$`, `$x = ${x}$`, `In die 1. Gleichung: $${x} + y = ${s} \\Rightarrow y = ${y}$`] }
    }
    const a = r.int(1, 4), b = r.int(1, 4), c = r.int(1, 4), e = r.int(-4, -1)
    const s = a * x + b * y, t = c * x + e * y
    const det = a * e - b * c
    if (det === 0) return GEN.lgs(2, r)
    return { type: 'math', prompt: `Löse das Gleichungssystem und gib beide Werte an:\n\n$${cx(a)} ${b === 1 ? '+ y' : `+ ${b}y`} = ${s}$\n\n$${cx(c)} ${e === -1 ? '- y' : `- ${-e}y`} = ${t}$`, answer: `x = ${x}; y = ${y}`, explanation: `Z. B. mit dem Einsetzungs- oder Additionsverfahren. Lösung: $x = ${x}$, $y = ${y}$. Probe: ${a}·${x} + ${b}·${y} = ${s} ✓ und ${c}·${x} − ${-e}·${y} = ${t} ✓.`, hints: ['Multipliziere eine oder beide Gleichungen so, dass vor y Zahlen mit gleichem Betrag stehen.', 'Addiere dann die Gleichungen, damit y wegfällt.'], steps: [`Lösung: $x = ${x}$`, `Einsetzen ergibt $y = ${y}$`] }
  },
  powers: (d, r) => {
    const v = r.pick(['a', 'x', 'b'])
    const m = r.int(2, 7), n = r.int(2, 6)
    if (d === 1) return { type: 'math', requireForm: 'simplified', prompt: `Vereinfache: $${v}^{${m}} \\cdot ${v}^{${n}}$`, answer: `${v}^${m + n}`, explanation: `Gleiche Basis → Exponenten addieren: $${v}^{${m}+${n}} = ${v}^{${m + n}}$.`, hints: ['Gleiche Basis beim Multiplizieren: Exponenten addieren.'], steps: [`$${v}^{${m} + ${n}} = ${v}^{${m + n}}$`] }
    if (d === 2) {
      const big = m + n
      return { type: 'math', requireForm: 'simplified', prompt: `Vereinfache: $${v}^{${big}} : ${v}^{${n}}$`, answer: `${v}^${m}`, explanation: `Gleiche Basis beim Dividieren → Exponenten subtrahieren: $${v}^{${big}-${n}} = ${v}^{${m}}$.`, hints: ['Gleiche Basis beim Dividieren: Exponenten subtrahieren.'], steps: [`$${v}^{${big} - ${n}} = ${v}^{${m}}$`] }
    }
    if (d === 3) return { type: 'math', requireForm: 'simplified', prompt: `Vereinfache: $(${v}^{${m}})^{${n}}$`, answer: `${v}^${m * n}`, explanation: `Potenz einer Potenz → Exponenten multiplizieren: $${v}^{${m} \\cdot ${n}} = ${v}^{${m * n}}$.`, hints: ['Potenz hoch Zahl: Exponenten multiplizieren (nicht addieren!).'], steps: [`$${v}^{${m} \\cdot ${n}} = ${v}^{${m * n}}$`] }
    const base = r.pick([2, 3, 4, 5, 10]), k = r.int(1, base === 10 ? 3 : 3)
    return { type: 'math', prompt: `Schreibe als Bruch oder Dezimalzahl: $${base}^{-${k}}$`, answer: fracText(1, base ** k), explanation: `$${base}^{-${k}} = \\frac{1}{${base}^{${k}}} = \\frac{1}{${base ** k}}$.`, hints: ['Ein negativer Exponent bedeutet: Kehrwert.', `$${base}^{-${k}} = \\frac{1}{${base}^{${k}}}$`], steps: [`$\\frac{1}{${base}^{${k}}}$`, `$= \\frac{1}{${base ** k}}$`] }
  },
  sqrt: (d, r) => {
    if (d === 1) {
      const n = r.int(2, 20)
      return { type: 'math', prompt: `Berechne: $\\sqrt{${n * n}}$`, answer: String(n), explanation: `$${n} \\cdot ${n} = ${n * n}$, also $\\sqrt{${n * n}} = ${n}$.`, hints: ['Welche Zahl mal sich selbst ergibt die Zahl unter der Wurzel?'], steps: [`$${n}^2 = ${n * n}$`] }
    }
    if (d === 2) {
      const n = r.int(1, 9), k = r.pick([10, 100])
      return { type: 'math', prompt: `Berechne: $\\sqrt{${de((n * n) / (k * k), 4)}}$`, answer: dot(n / k, 3), explanation: `$${de(n / k, 3)}^2 = ${de((n * n) / (k * k), 4)}$.`, hints: [`Denke an $\\sqrt{${n * n}} = ${n}$ und verschiebe dann das Komma.`, 'Beim Wurzelziehen halbiert sich die Zahl der Nachkommastellen.'], steps: [`$\\sqrt{${n * n}} = ${n}$`, `Komma verschieben: ${de(n / k, 3)}`] }
    }
    const a = r.int(2, 9), b = r.int(2, 9)
    return { type: 'math', prompt: `Berechne ohne Taschenrechner: $\\sqrt{${a * a}} \\cdot \\sqrt{${b * b}} - \\sqrt{${(a * b) ** 2}}$`, answer: '0', explanation: `$${a} \\cdot ${b} - ${a * b} = 0$. Merke: $\\sqrt{x} \\cdot \\sqrt{y} = \\sqrt{x \\cdot y}$.`, hints: ['Ziehe jede Wurzel einzeln.'], steps: [`$\\sqrt{${a * a}} = ${a}$, $\\sqrt{${b * b}} = ${b}$, $\\sqrt{${(a * b) ** 2}} = ${a * b}$`, `$${a} \\cdot ${b} - ${a * b} = 0$`] }
  },
  pythagoras: (d, r) => {
    const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]]
    const unit = r.pick(['cm', 'm'])
    if (d <= 2) {
      const [a, b, c] = r.pick(triples)
      const k = d === 1 ? 1 : r.int(1, 3)
      if (d === 1) return { type: 'numeric', unit, prompt: `Rechtwinkliges Dreieck: Katheten $a = ${a * k}$ ${unit}, $b = ${b * k}$ ${unit}. Berechne die Hypotenuse c.`, answer: String(c * k), explanation: `$c = \\sqrt{${a * k}^2 + ${b * k}^2} = \\sqrt{${(a * k) ** 2 + (b * k) ** 2}} = ${c * k}$ ${unit}.`, hints: ['$c^2 = a^2 + b^2$', `$c^2 = ${(a * k) ** 2} + ${(b * k) ** 2} = ${(c * k) ** 2}$ – jetzt die Wurzel ziehen.`], steps: [`$c^2 = ${a * k}^2 + ${b * k}^2 = ${(c * k) ** 2}$`, `$c = \\sqrt{${(c * k) ** 2}} = ${c * k}$`] }
      return { type: 'numeric', unit, prompt: `Rechtwinkliges Dreieck: Hypotenuse $c = ${c * k}$ ${unit}, Kathete $a = ${a * k}$ ${unit}. Berechne die Kathete b.`, answer: String(b * k), explanation: `$b = \\sqrt{c^2 - a^2} = \\sqrt{${(c * k) ** 2} - ${(a * k) ** 2}} = ${b * k}$ ${unit}.`, hints: ['Stelle $a^2 + b^2 = c^2$ nach $b^2$ um: $b^2 = c^2 - a^2$.', `$b^2 = ${(c * k) ** 2} - ${(a * k) ** 2}$`], steps: [`$b^2 = c^2 - a^2 = ${(c * k) ** 2} - ${(a * k) ** 2} = ${(b * k) ** 2}$`, `$b = ${b * k}$`] }
    }
    const a = r.int(2, 12), b = r.int(2, 12, [a])
    const c = Math.sqrt(a * a + b * b)
    if (d === 3) return { type: 'numeric', unit, prompt: `Katheten $a = ${a}$ ${unit} und $b = ${b}$ ${unit}. Berechne die Hypotenuse c (auf zwei Nachkommastellen).`, answer: dot(c), explanation: `$c = \\sqrt{${a * a} + ${b * b}} = \\sqrt{${a * a + b * b}} \\approx ${de(c)}$ ${unit}.`, hints: ['$c^2 = a^2 + b^2$', `$c = \\sqrt{${a * a + b * b}}$ – mit dem Taschenrechner ausrechnen und runden.`], steps: [`$c^2 = ${a * a} + ${b * b} = ${a * a + b * b}$`, `$c = \\sqrt{${a * a + b * b}} \\approx ${de(c)}$`] }
    const w = r.int(3, 9), h = r.int(2, 8)
    const diag = Math.sqrt(w * w + h * h)
    return { type: 'numeric', unit: 'm', prompt: `Ein rechteckiges Beet ist ${w} m lang und ${h} m breit. Wie lang ist ein Weg quer über die Diagonale? (auf zwei Nachkommastellen)`, answer: dot(diag), explanation: `Die Diagonale teilt das Rechteck in zwei rechtwinklige Dreiecke: $d = \\sqrt{${w}^2 + ${h}^2} = \\sqrt{${w * w + h * h}} \\approx ${de(diag)}$ m.`, hints: ['Zeichne eine Skizze: Die Diagonale ist die Hypotenuse.', `$d^2 = ${w}^2 + ${h}^2$`], steps: [`$d^2 = ${w * w} + ${h * h} = ${w * w + h * h}$`, `$d \\approx ${de(diag)}$ m`] }
  },
  'quad-eq': (d, r) => {
    if (d === 1) {
      const k = r.int(2, 12)
      return { type: 'math', prompt: `Löse: $x^2 = ${k * k}$`, answer: `x = ${k}; x = -${k}`, explanation: `Zwei Lösungen: $x = ${k}$ und $x = -${k}$, weil auch $(-${k})^2 = ${k * k}$.`, hints: ['Ziehe die Wurzel – und denke an die negative Lösung!'], steps: [`$x = \\pm\\sqrt{${k * k}}$`, `$x_1 = ${k}$, $x_2 = -${k}$`], stepCheck: { kind: 'equation', variable: 'x', solutions: [-k, k], equation: `x^2 = ${k * k}` } }
    }
    const x1 = r.int(-8, 8), x2 = r.int(-8, 8, [x1])
    const p = -(x1 + x2), q = x1 * x2
    const a = d >= 3 ? r.int(2, 3) : 1
    const eq = `${a === 1 ? '' : a}x^2 ${p * a === 0 ? '' : sg(p * a) + 'x'} ${q === 0 ? '' : sg(q * a)} = 0`.replace(/\s+/g, ' ')
    const disc = (p / 2) ** 2 - q
    return {
      type: 'math',
      prompt: `Löse mit der p-q-Formel: $${eq}$`,
      answer: `x = ${x1}; x = ${x2}`,
      explanation: `${a !== 1 ? `Zuerst durch ${a} teilen: $x^2 ${sg(p)}x ${sg(q)} = 0$. ` : ''}$p = ${p}$, $q = ${q}$: $x = ${dot(-p / 2)} \\pm \\sqrt{${dot(disc)}} = ${dot(-p / 2)} \\pm ${dot(Math.sqrt(disc))}$. Also $x_1 = ${Math.max(x1, x2)}$, $x_2 = ${Math.min(x1, x2)}$.`,
      hints: [...(a !== 1 ? [`Die p-q-Formel braucht die Form $x^2 + px + q = 0$. Teile zuerst durch ${a}.`] : []), `Lies p und q mit Vorzeichen ab: $p = ${p}$, $q = ${q}$.`, '$x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}$', `Unter der Wurzel steht ${de(disc)}.`],
      steps: [...(a !== 1 ? [`$: ${a}$ → $x^2 ${sg(p)}x ${sg(q)} = 0$`] : []), `$p = ${p}$, $q = ${q}$`, `$x_{1,2} = ${dot(-p / 2)} \\pm \\sqrt{${dot((p / 2) ** 2)} - ${q < 0 ? `(${q})` : q}}$`, `$= ${dot(-p / 2)} \\pm ${dot(Math.sqrt(disc))}$`, `$x_1 = ${Math.max(x1, x2)}$, $x_2 = ${Math.min(x1, x2)}$`],
      stepCheck: { kind: 'equation', variable: 'x', solutions: [Math.min(x1, x2), Math.max(x1, x2)], equation: eq },
    }
  },
  percent: (d, r) => {
    const p = r.pick([5, 10, 12, 15, 20, 25, 30, 40, 75])
    const G = r.pick([40, 60, 80, 120, 150, 200, 240, 360, 500])
    const W = (G * p) / 100
    if (d === 1) return { type: 'numeric', unit: '€', prompt: `Berechne ${p} % von ${G} €.`, answer: dot(W), explanation: `$W = G \\cdot \\frac{p}{100} = ${G} \\cdot ${de(p / 100)} = ${de(W)}$ €.`, hints: ['Prozentwert = Grundwert · Prozentsatz/100', `${p} % = ${de(p / 100)}`], steps: [`$${p}\\,\\% = ${de(p / 100)}$`, `$${G} \\cdot ${de(p / 100)} = ${de(W)}$`] }
    if (d === 2) return { type: 'numeric', unit: '%', prompt: `${de(W)} € von ${G} € – wie viel Prozent sind das?`, answer: String(p), explanation: `$p = \\frac{W}{G} \\cdot 100 = \\frac{${de(W)}}{${G}} \\cdot 100 = ${p}\\,\\%$.`, hints: ['Prozentsatz = Prozentwert : Grundwert', 'Das Ergebnis mal 100 nehmen.'], steps: [`$${de(W)} : ${G} = ${de(p / 100)}$`, `$${de(p / 100)} \\cdot 100 = ${p}\\,\\%$`] }
    if (d === 3) return { type: 'numeric', unit: '€', prompt: `${p} % eines Betrags sind ${de(W)} €. Wie groß ist der Betrag (Grundwert)?`, answer: String(G), explanation: `$G = \\frac{W}{p} \\cdot 100 = \\frac{${de(W)}}{${p}} \\cdot 100 = ${G}$ €.`, hints: ['Grundwert = Prozentwert : Prozentsatz', `Erst 1 % berechnen: ${de(W)} : ${p}.`], steps: [`$1\\,\\% = ${de(W / p, 3)}$ €`, `$100\\,\\% = ${G}$ €`] }
    const rabatt = r.pick([10, 20, 25, 30])
    const old = G
    const neu = (old * (100 - rabatt)) / 100
    return { type: 'numeric', unit: '€', prompt: `Nach ${rabatt} % Rabatt kostet eine Jacke ${de(neu)} €. Was hat sie vorher gekostet?`, answer: String(old), explanation: `${de(neu)} € sind ${100 - rabatt} % des alten Preises: $${de(neu)} : ${de((100 - rabatt) / 100)} = ${old}$ €.`, hints: [`Der neue Preis entspricht nicht 100 %, sondern ${100 - rabatt} %.`, `Teile durch ${de((100 - rabatt) / 100)}.`], steps: [`Neuer Preis = ${100 - rabatt} % des alten`, `$${de(neu)} : ${de((100 - rabatt) / 100)} = ${old}$`], tags: ['percent-base'] }
  },
  interest: (d, r) => {
    const K = r.pick([200, 400, 500, 800, 1000, 1200, 2500])
    const p = r.pick([1, 1.5, 2, 2.5, 3, 4])
    if (d === 1) {
      const Z = (K * p) / 100
      return { type: 'numeric', unit: '€', prompt: `${K} € werden ein Jahr lang zu ${de(p)} % angelegt. Wie viele Zinsen gibt es?`, answer: dot(Z), explanation: `$Z = K \\cdot \\frac{p}{100} = ${K} \\cdot ${de(p / 100, 3)} = ${de(Z)}$ €.`, hints: ['Jahreszinsen = Kapital · Zinssatz/100'], steps: [`$${K} \\cdot ${de(p / 100, 3)} = ${de(Z)}$`] }
    }
    if (d === 2) {
      const m = r.pick([3, 4, 6, 8, 9])
      const Z = (K * p * m) / 1200
      return { type: 'numeric', unit: '€', prompt: `${K} € werden ${m} Monate zu ${de(p)} % (pro Jahr) angelegt. Wie viele Zinsen gibt es? (auf Cent)`, answer: dot(Z), explanation: `$Z = K \\cdot \\frac{p}{100} \\cdot \\frac{${m}}{12} = ${de(Z)}$ €.`, hints: ['Berechne zuerst die Jahreszinsen.', `Für ${m} Monate: mal $\\frac{${m}}{12}$.`], steps: [`Jahreszinsen: ${de((K * p) / 100)} €`, `$\\cdot \\frac{${m}}{12} = ${de(Z)}$ €`] }
    }
    const n = d === 3 ? 2 : r.int(3, 5)
    const Kn = K * (1 + p / 100) ** n
    return { type: 'numeric', unit: '€', prompt: `${K} € werden ${n} Jahre mit Zinseszins zu ${de(p)} % angelegt. Wie hoch ist das Kapital am Ende? (auf Cent)`, answer: dot(Kn), explanation: `$K_n = K \\cdot q^n = ${K} \\cdot ${de(1 + p / 100, 3)}^{${n}} \\approx ${de(Kn)}$ €.`, hints: [`Wachstumsfaktor $q = 1 + \\frac{${de(p)}}{100} = ${de(1 + p / 100, 3)}$`, `$K_n = K \\cdot q^{${n}}$`], steps: [`$q = ${de(1 + p / 100, 3)}$`, `$K_{${n}} = ${K} \\cdot ${de(1 + p / 100, 3)}^{${n}} \\approx ${de(Kn)}$`] }
  },
  volume: (d, r) => {
    if (d === 1) {
      const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9)
      return { type: 'numeric', unit: 'cm³', prompt: `Ein Quader ist ${a} cm lang, ${b} cm breit und ${c} cm hoch. Berechne das Volumen.`, answer: String(a * b * c), explanation: `$V = a \\cdot b \\cdot c = ${a * b * c}$ cm³.`, hints: ['$V = a \\cdot b \\cdot c$'], steps: [`$${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}$`] }
    }
    const rr = r.int(2, 8), h = r.int(3, 15)
    if (d === 2) {
      const V = Math.PI * rr * rr * h
      return { type: 'numeric', unit: 'cm³', prompt: `Ein Zylinder hat den Radius ${rr} cm und die Höhe ${h} cm. Berechne das Volumen (auf eine Nachkommastelle).`, answer: dot(V, 1), explanation: `$V = \\pi r^2 h = \\pi \\cdot ${rr * rr} \\cdot ${h} \\approx ${de(V, 1)}$ cm³.`, hints: ['$V = \\pi \\cdot r^2 \\cdot h$', `$r^2 = ${rr * rr}$`], steps: [`$G = \\pi \\cdot ${rr}^2 \\approx ${de(Math.PI * rr * rr, 2)}$`, `$V = G \\cdot ${h} \\approx ${de(V, 1)}$`] }
    }
    if (d === 3) {
      const O = 2 * Math.PI * rr * rr + 2 * Math.PI * rr * h
      return { type: 'numeric', unit: 'cm²', prompt: `Ein Zylinder hat den Radius ${rr} cm und die Höhe ${h} cm. Berechne die Oberfläche (auf eine Nachkommastelle).`, answer: dot(O, 1), explanation: `$O = 2\\pi r^2 + 2\\pi r h = ${de(2 * Math.PI * rr * rr, 2)} + ${de(2 * Math.PI * rr * h, 2)} \\approx ${de(O, 1)}$ cm².`, hints: ['Oberfläche = 2 Kreise (Boden + Deckel) + Mantel', 'Mantel = Umfang · Höhe = $2\\pi r \\cdot h$'], steps: [`2 Kreise: $2\\pi \\cdot ${rr}^2 \\approx ${de(2 * Math.PI * rr * rr, 2)}$`, `Mantel: $2\\pi \\cdot ${rr} \\cdot ${h} \\approx ${de(2 * Math.PI * rr * h, 2)}$`, `Summe $\\approx ${de(O, 1)}$`] }
    }
    const g = r.int(3, 10), hg = r.int(2, 8), hk = r.int(5, 20)
    const V = (g * hg * hk) / 2
    return { type: 'numeric', unit: 'cm³', prompt: `Ein Prisma hat als Grundfläche ein Dreieck mit Grundseite ${g} cm und Höhe ${hg} cm. Die Körperhöhe beträgt ${hk} cm. Berechne das Volumen.`, answer: dot(V), explanation: `$G = \\frac{${g} \\cdot ${hg}}{2} = ${de(g * hg / 2)}$ cm², $V = G \\cdot h = ${de(V)}$ cm³.`, hints: ['Volumen Prisma = Grundfläche · Höhe', 'Grundfläche Dreieck = $\\frac{g \\cdot h}{2}$'], steps: [`$G = ${de(g * hg / 2)}$ cm²`, `$V = ${de(g * hg / 2)} \\cdot ${hk} = ${de(V)}$ cm³`] }
  },
  probability: (d, r) => {
    if (d === 1) {
      const target = r.pick([{ t: 'eine gerade Zahl', n: 3 }, { t: 'eine Zahl größer als 4', n: 2 }, { t: 'eine 6', n: 1 }, { t: 'eine Primzahl', n: 3 }, { t: 'höchstens eine 2', n: 2 }])
      return { type: 'math', prompt: `Ein fairer Würfel wird einmal geworfen. Wie groß ist die Wahrscheinlichkeit für ${target.t}? (als Bruch)`, answer: fracText(target.n, 6), explanation: `Günstige Ergebnisse: ${target.n} von 6 möglichen. $P = ${fracTex(target.n, 6)}$.`, hints: ['$P = \\frac{\\text{günstige Ergebnisse}}{\\text{mögliche Ergebnisse}}$', 'Schreibe alle passenden Augenzahlen auf.'], steps: [`günstig: ${target.n}, möglich: 6`, `$P = ${fracTex(target.n, 6)}$`] }
    }
    const red = r.int(2, 6), blue = r.int(2, 6)
    const total = red + blue
    if (d === 2) return { type: 'math', prompt: `In einer Urne sind ${red} rote und ${blue} blaue Kugeln. Es wird zweimal MIT Zurücklegen gezogen. Wie groß ist die Wahrscheinlichkeit für zwei rote Kugeln?`, answer: fracText(red * red, total * total), explanation: `Pfadregel: $\\frac{${red}}{${total}} \\cdot \\frac{${red}}{${total}} = ${fracTex(red * red, total * total)}$.`, hints: ['Zeichne ein Baumdiagramm.', 'Entlang eines Pfades wird multipliziert.'], steps: [`$P(\\text{rot}) = \\frac{${red}}{${total}}$`, `$P(\\text{rot, rot}) = \\frac{${red}}{${total}} \\cdot \\frac{${red}}{${total}} = ${fracTex(red * red, total * total)}$`] }
    if (d === 3) return { type: 'math', prompt: `In einer Urne sind ${red} rote und ${blue} blaue Kugeln. Es wird zweimal OHNE Zurücklegen gezogen. Wie groß ist die Wahrscheinlichkeit für zwei rote Kugeln?`, answer: fracText(red * (red - 1), total * (total - 1)), explanation: `$\\frac{${red}}{${total}} \\cdot \\frac{${red - 1}}{${total - 1}} = ${fracTex(red * (red - 1), total * (total - 1))}$. Beim zweiten Zug ist eine rote Kugel weniger und insgesamt eine Kugel weniger drin.`, hints: ['Nach dem ersten Zug ändert sich der Inhalt der Urne.', `Beim zweiten Zug: ${red - 1} rote von ${total - 1} Kugeln.`], steps: [`1. Zug: $\\frac{${red}}{${total}}$`, `2. Zug: $\\frac{${red - 1}}{${total - 1}}$`, `$P = ${fracTex(red * (red - 1), total * (total - 1))}$`] }
    return { type: 'math', prompt: `In einer Urne sind ${red} rote und ${blue} blaue Kugeln. Es wird zweimal OHNE Zurücklegen gezogen. Wie groß ist die Wahrscheinlichkeit für zwei verschiedenfarbige Kugeln?`, answer: fracText(2 * red * blue, total * (total - 1)), explanation: `Zwei Pfade: rot-blau und blau-rot. $\\frac{${red}}{${total}} \\cdot \\frac{${blue}}{${total - 1}} + \\frac{${blue}}{${total}} \\cdot \\frac{${red}}{${total - 1}} = ${fracTex(2 * red * blue, total * (total - 1))}$.`, hints: ['Welche Pfade gehören zu „verschiedenfarbig“? Es sind zwei.', 'Pfade multiplizieren, dann die Pfade addieren (Summenregel).'], steps: [`rot-blau: $\\frac{${red * blue}}{${total * (total - 1)}}$`, `blau-rot: $\\frac{${red * blue}}{${total * (total - 1)}}$`, `Summe: $${fracTex(2 * red * blue, total * (total - 1))}$`] }
  },
}

/** Inside $…$ show decimals with a German comma: 2.5 → 2{,}5 */
function germanMath(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, m: string) => `$${m.replace(/(\d)\.(\d)/g, '$1{,}$2')}$`)
}

export function generateQuestion(skill: string, difficulty: Difficulty, ctx: { subjectId: string; topicId: string }, seed = Math.floor(Math.random() * 1e9)): Question {
  const gen = GEN[skill]
  if (!gen) throw new Error(`Unbekannte Fertigkeit: ${skill}`)
  const g = gen(difficulty, makeR(seededRandom(seed)))
  return {
    ...g,
    prompt: germanMath(g.prompt),
    explanation: germanMath(g.explanation),
    hints: g.hints.map(germanMath),
    steps: g.steps?.map(germanMath),
    id: `gen_${skill}_${difficulty}_${seed}`,
    subjectId: ctx.subjectId,
    topicId: ctx.topicId,
    difficulty,
    points: g.points ?? 1,
    source: 'generator',
    skill,
    createdAt: new Date().toISOString(),
  }
}

export function skillByKey(key: string): SkillDef | undefined {
  return SKILLS.find((s) => s.key === key)
}
