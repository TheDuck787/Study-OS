import type { Question } from '@/db/types'
import { expandVariants, levenshtein, normalizeText, splitArticle, typoBudget } from './text'
import {
  decimalsOf,
  evaluateNumber,
  expressionsEquivalent,
  looksLikeSolutionSet,
  formViolation,
  nearlyEqual,
  parseAssignments,
  parseSolutionSet,
} from './mathcheck'

export type CheckStatus = 'correct' | 'partial' | 'wrong' | 'unreadable' | 'self-assess'

export interface CheckResult {
  status: CheckStatus
  correct: boolean
  /** 0..1 */
  score: number
  /** Encouraging, specific German feedback about THIS answer. */
  feedback: string
  /** The correct answer as text, for display after answering. */
  expected: string
  errorTag: string | null
}

const result = (status: CheckStatus, score: number, feedback: string, expected: string, errorTag: string | null = null): CheckResult => ({
  status,
  correct: status === 'correct',
  score,
  feedback,
  expected,
  errorTag,
})

export function expectedAnswerText(q: Question): string {
  if (q.type === 'mc' && q.options && q.correctIndex !== undefined) return q.options[q.correctIndex]
  if (q.type === 'tf') return q.correctBool ? 'Wahr' : 'Falsch'
  return q.answer + (q.unit && q.type === 'numeric' ? ` ${q.unit}` : '')
}

export function checkAnswer(q: Question, given: string): CheckResult {
  const expected = expectedAnswerText(q)
  if (!given.trim()) return result('unreadable', 0, 'Du hast noch nichts eingegeben.', expected)
  switch (q.type) {
    case 'mc':
      return checkMc(q, given, expected)
    case 'tf':
      return checkTf(q, given, expected)
    case 'numeric':
      return checkNumeric(q, given, expected)
    case 'math':
      return checkMath(q, given, expected)
    case 'vocab':
      return checkVocab(q, given, expected)
    case 'text':
      return checkFreeText(q, given, expected)
  }
}

function checkMc(q: Question, given: string, expected: string): CheckResult {
  const idx = Number(given)
  if (!Number.isInteger(idx) || !q.options || idx < 0 || idx >= q.options.length) return result('unreadable', 0, 'Bitte wähle eine Antwort aus.', expected)
  const fb = q.optionFeedback?.[idx]
  if (idx === q.correctIndex) return result('correct', 1, fb || 'Richtig!', expected)
  return result(
    'wrong',
    0,
    fb ? `Nicht ganz: ${fb}` : `Nicht ganz. Richtig ist „${expected}“.`,
    expected,
    fb ? 'misconception' : null,
  )
}

function checkTf(q: Question, given: string, expected: string): CheckResult {
  const v = given === 'true' ? true : given === 'false' ? false : null
  if (v === null) return result('unreadable', 0, 'Bitte wähle „Wahr“ oder „Falsch“.', expected)
  return v === q.correctBool ? result('correct', 1, 'Richtig!', expected) : result('wrong', 0, `Nicht ganz – die Aussage ist ${q.correctBool ? 'wahr' : 'falsch'}.`, expected)
}

/** Splits "12,5 cm²" into number part and unit part. */
function splitNumberAndUnit(given: string): { num: string; unit: string } {
  const s = given.trim()
  const idx = s.search(/[a-zA-ZäöüÄÖÜ%€$°µ]/)
  if (idx <= 0) return { num: s, unit: '' }
  return { num: s.slice(0, idx).trim(), unit: s.slice(idx).trim() }
}

/** All plausible readings of a number: "2,5" → 2.5; "1.250" → 1.25 or 1250 (German thousands separator). */
function numberCandidates(raw: string): number[] {
  const s = raw.replace(/\s+/g, '')
  const out: number[] = []
  const v = evaluateNumber(s)
  if (v !== null) out.push(v)
  if (/^[-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) out.push(Number(s.replace('−', '-').replace(/\./g, '').replace(',', '.')))
  return out
}

function checkNumeric(q: Question, given: string, expected: string): CheckResult {
  const { num, unit } = splitNumberAndUnit(given)
  const values = numberCandidates(num)
  const target = evaluateNumber(q.answer)
  if (values.length === 0) return result('unreadable', 0, 'Das konnte ich nicht als Zahl lesen. Schreibe z. B. „12,5“ (Einheit optional).', expected)
  if (target === null) return result('self-assess', 0, 'Vergleiche selbst mit der Lösung.', expected)
  const tol = q.tolerance ?? Math.max(1e-9, Math.pow(10, -decimalsOf(q.answer)) / 2 + 1e-9)
  let unitNote = ''
  if (q.unit && unit && normalizeText(unit) !== normalizeText(q.unit)) unitNote = ` Achte auf die Einheit: gefragt ist ${q.unit}.`
  if (values.some((value) => Math.abs(value - target) <= tol)) return result('correct', 1, `Richtig!${unitNote}`, expected)
  const value = values[0]
  if (nearlyEqual(value, -target) && target !== 0) return result('wrong', 0, 'Der Betrag stimmt, aber das Vorzeichen ist falsch.', expected, 'sign-error')
  const decimalTask = decimalsOf(q.answer) > 0 || !Number.isInteger(value)
  if (decimalTask && Math.abs(value - target) <= tol * 10) return result('partial', 0.5, `Fast! Dein Ergebnis ist sehr nah dran – prüfe das Runden (${q.answer} ist erwartet).`, expected, 'rounding')
  return result('wrong', 0, `Leider nicht richtig. Erwartet war ${expected}.${unitNote}`, expected)
}

const FN_PREFIX = /^\s*(?:y|[fgh]\s*\(\s*x\s*\))\s*=\s*/i

function checkMath(q: Question, rawGiven: string, expected: string): CheckResult {
  // "y = 2x + 1" and "f(x) = 2x + 1" are compared as the term on the right
  const isFn = FN_PREFIX.test(q.answer)
  const given = isFn ? rawGiven.replace(FN_PREFIX, '') : rawGiven
  q = isFn ? { ...q, answer: q.answer.replace(FN_PREFIX, ''), acceptedAnswers: q.acceptedAnswers?.map((a) => a.replace(FN_PREFIX, '')) } : q
  const candidates = [q.answer, ...(q.acceptedAnswers ?? [])]
  const formCheck = (): CheckResult => {
    const v = q.requireForm ? formViolation(given, q.answer, q.requireForm) : null
    if (v) return result('partial', 0.5, v, expected, q.requireForm === 'simplified-fraction' ? 'not-simplified' : 'not-simplified')
    return result('correct', 1, 'Richtig!', expected)
  }
  // 0) Systems of equations: values must belong to the right variable
  const wantNamed = parseAssignments(q.answer)
  if (wantNamed && wantNamed.size >= 2) {
    const gotNamed = parseAssignments(given)
    if (!gotNamed) return result('unreadable', 0, 'Gib an, welcher Wert zu welcher Variable gehört, z. B. „x = 6; y = 4“.', expected)
    let right = 0
    for (const [name, v] of wantNamed) if (gotNamed.has(name) && nearlyEqual(gotNamed.get(name)!, v, 1e-6, 1e-6)) right++
    if (right === wantNamed.size) return result('correct', 1, 'Richtig!', expected)
    if (right > 0) return result('partial', right / wantNamed.size, 'Ein Wert stimmt, der andere nicht. Setze beide Werte zur Probe in beide Gleichungen ein.', expected)
    return result('wrong', 0, 'Das ist nicht die Lösung. Setze deine Werte zur Probe in beide Gleichungen ein – gehen beide auf?', expected)
  }
  // 1) Solution sets of equations
  if (looksLikeSolutionSet(q.answer)) {
    const want = parseSolutionSet(q.answer)
    const got = parseSolutionSet(given)
    if (!got) return result('unreadable', 0, 'Das konnte ich nicht lesen. Beispiele: „x = 4“, „4“ oder bei zwei Lösungen „2; -3“.', expected)
    if (!want) return result('self-assess', 0, 'Vergleiche selbst mit der Lösung.', expected)
    const matched = want.filter((w) => got.some((g) => nearlyEqual(g, w, 1e-6, 1e-6)))
    const extra = got.filter((g) => !want.some((w) => nearlyEqual(g, w, 1e-6, 1e-6)))
    if (matched.length === want.length && extra.length === 0) return result('correct', 1, 'Richtig!', expected)
    if (matched.length > 0 && extra.length === 0) return result('partial', matched.length / want.length, `Teilweise richtig – es fehlt noch ${want.length - matched.length === 1 ? 'eine Lösung' : 'mindestens eine Lösung'}.`, expected)
    if (want.length === 1 && got.length === 1 && nearlyEqual(got[0], -want[0]) && want[0] !== 0) return result('wrong', 0, 'Fast: Der Betrag stimmt, aber das Vorzeichen nicht. Prüfe den Schritt, in dem du eine Zahl auf die andere Seite bringst.', expected, 'sign-error')
    return result('wrong', 0, `Das ist nicht die Lösung. Setze deine Lösung zur Probe in die Gleichung ein – geht sie auf?`, expected)
  }

  // 2) Numeric values (fractions, powers, roots …)
  const target = evaluateNumber(q.answer)
  const value = evaluateNumber(given)
  if (target !== null) {
    if (value === null) {
      const eq = expressionsEquivalent(given, q.answer)
      if (eq === null) return result('unreadable', 0, 'Das konnte ich nicht lesen. Schreibe z. B. „3/4“, „2^5“ oder „1,25“.', expected)
      return result('wrong', 0, 'Das Ergebnis sollte eine Zahl sein, ohne Variable.', expected)
    }
    const tol = q.tolerance ?? 1e-9
    if (Math.abs(value - target) <= Math.max(tol, 1e-9 * Math.abs(target))) return formCheck()
    if (nearlyEqual(value, -target) && target !== 0) return result('wrong', 0, 'Der Betrag stimmt, aber das Vorzeichen ist falsch.', expected, 'sign-error')
    return result('wrong', 0, `Leider nicht richtig. Erwartet: ${expected}.`, expected)
  }

  // 3) Algebraic expressions: equivalent forms are always accepted.
  let sawUnreadable = false
  for (const c of candidates) {
    const eq = expressionsEquivalent(given, c)
    if (eq === true) {
      const r = formCheck()
      return r.correct ? result('correct', 1, 'Richtig! (Gleichwertige Schreibweisen werden anerkannt.)', expected) : r
    }
    if (eq === null) sawUnreadable = true
  }
  if (sawUnreadable && expressionsEquivalent(given, given) === null) return result('unreadable', 0, 'Das konnte ich nicht lesen. Schreibe z. B. „2x + 3“ oder „(x+1)^2“.', expected)
  const neg = expressionsEquivalent(`-(${given})`, q.answer)
  if (neg) return result('wrong', 0, 'Fast – aber ein Vorzeichen stimmt nicht.', expected, 'sign-error')
  return result('wrong', 0, `Dein Term ist nicht gleichwertig zur Lösung ${expected}. Setze zur Kontrolle eine Zahl für die Variable ein und vergleiche.`, expected)
}

function checkVocab(q: Question, given: string, expected: string): CheckResult {
  const variants = [...expandVariants(q.answer), ...(q.acceptedAnswers ?? []).flatMap(expandVariants)]
  const g = normalizeText(given)
  const gArt = splitArticle(given)
  for (const v of variants) {
    if (normalizeText(v) === g) return result('correct', 1, 'Richtig!', expected)
  }
  // Article handling for German nouns: missing article is accepted with a note, wrong article is half right.
  for (const v of variants) {
    const vArt = splitArticle(v)
    if (vArt.article && normalizeText(vArt.rest) === normalizeText(gArt.rest)) {
      if (!gArt.article) return result('correct', 1, `Richtig! Lerne den Artikel mit: „${v}“.`, expected)
      if (gArt.article !== vArt.article) return result('partial', 0.5, `Das Wort stimmt, aber der Artikel ist „${vArt.article}“.`, expected, 'article')
    }
  }
  // Typos
  for (const v of variants) {
    const nv = normalizeText(v)
    const d = levenshtein(nv, g)
    if (d > 0 && d <= typoBudget(nv.length)) return result('partial', 0.5, `Fast richtig! Achte auf die Schreibweise: „${v}“.`, expected, 'spelling')
  }
  return result('wrong', 0, `Leider nicht. Richtig ist: „${expected}“.`, expected)
}

function checkFreeText(q: Question, given: string, expected: string): CheckResult {
  const g = normalizeText(given)
  const exact = [q.answer, ...(q.acceptedAnswers ?? [])].some((a) => normalizeText(a) === g)
  if (exact) return result('correct', 1, 'Richtig!', expected)
  if (q.keywords && q.keywords.length > 0) {
    const missing: string[] = []
    let hit = 0
    for (const group of q.keywords) {
      if (group.some((k) => g.includes(normalizeText(k)))) hit++
      else missing.push(group[0])
    }
    const ratio = hit / q.keywords.length
    if (ratio === 1) return result('correct', 1, 'Richtig – alle wichtigen Punkte sind enthalten.', expected)
    if (ratio >= 0.5) return result('partial', Math.round(ratio * 100) / 100, `Teilweise richtig. Es fehlt noch: ${missing.join(', ')}.`, expected)
    return result('wrong', ratio, `Hier fehlen wichtige Punkte: ${missing.join(', ')}. Vergleiche mit der Musterlösung.`, expected)
  }
  // Short single-word answers: tolerate a typo
  const na = normalizeText(q.answer)
  if (na.split(' ').length <= 2) {
    const d = levenshtein(na, g)
    if (d <= typoBudget(na.length)) return result('partial', 0.5, `Fast richtig! Schreibweise: „${q.answer}“.`, expected, 'spelling')
    return result('wrong', 0, `Leider nicht. Richtig ist: „${expected}“.`, expected)
  }
  return result('self-assess', 0, 'Diese Antwort kann ohne KI nicht automatisch bewertet werden. Vergleiche mit der Musterlösung und bewerte dich ehrlich selbst.', expected)
}
