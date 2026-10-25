import type { MaterialSection } from '@/db/types'
import { isStopword, normalizeText } from '../text'
import { shuffle } from '../id'

/**
 * AI-free document analysis. Everything here is a heuristic – the UI says so and the
 * student reviews all generated material before it is saved.
 */

const BULLET = /^\s*([-•*–·▪◦]|\d+[.)])\s+/

function isHeadingLine(line: string, next: string | undefined, prev: string | undefined): { level: number } | null {
  const t = line.trim()
  if (!t) return null
  const md = /^(#{1,6})\s+(.+)$/.exec(t)
  if (md) return { level: md[1].length }
  if (t.length > 70 || BULLET.test(t)) return null
  if (/[.,;:!?)]$/.test(t)) return null
  if (/^\d+(\.\d+)*\s+\S/.test(t) && t.split(/\s+/).length <= 8) return { level: (t.match(/\./g)?.length ?? 0) + 1 }
  const words = t.split(/\s+/)
  if (words.length > 8) return null
  const isolated = (!prev || !prev.trim()) && (!next || !next.trim() || next.trim().length > t.length)
  const upper = t === t.toUpperCase() && /[A-ZÄÖÜ]{3,}/.test(t)
  if (upper) return { level: 1 }
  if (isolated && /^[A-ZÄÖÜ0-9]/.test(t)) return { level: 2 }
  return null
}

export function extractSections(text: string): MaterialSection[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const sections: MaterialSection[] = []
  let current: MaterialSection = { heading: '', level: 1, text: '' }
  for (let i = 0; i < lines.length; i++) {
    const h = isHeadingLine(lines[i], lines[i + 1], lines[i - 1])
    if (h) {
      if (current.heading || current.text.trim()) sections.push({ ...current, text: current.text.trim() })
      current = { heading: lines[i].trim().replace(/^#+\s*/, ''), level: h.level, text: '' }
    } else {
      current.text += lines[i] + '\n'
    }
  }
  if (current.heading || current.text.trim()) sections.push({ ...current, text: current.text.trim() })
  return sections.length ? sections : [{ heading: '', level: 1, text: text.trim() }]
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** First meaningful sentence(s) of every section – a summary built only from the original wording. */
export function extractiveSummary(sections: MaterialSection[], maxBullets = 8): string {
  const bullets: string[] = []
  for (const s of sections) {
    if (bullets.length >= maxBullets) break
    const lines = s.text.split('\n').map((l) => l.trim()).filter(Boolean)
    const firstSentence = splitSentences(lines.join(' '))[0]
    if (!firstSentence) continue
    const short = firstSentence.length > 220 ? firstSentence.slice(0, 217) + '…' : firstSentence
    bullets.push(s.heading ? `- **${s.heading}:** ${short}` : `- ${short}`)
  }
  return bullets.join('\n')
}

export interface TermDefinition {
  term: string
  definition: string
}

const MAX_TERM_WORDS = 5

/** Finds "Begriff: Erklärung", "Begriff – Erklärung", "X ist/sind …" and "Unter X versteht man …". */
export function extractDefinitions(text: string): TermDefinition[] {
  const out: TermDefinition[] = []
  const seen = new Set<string>()
  const add = (term: string, definition: string) => {
    term = term.replace(BULLET, '').replace(/^[„"]|[“"]$/g, '').trim()
    definition = definition.trim().replace(/\s+/g, ' ')
    const words = term.split(/\s+/)
    if (!term || words.length > MAX_TERM_WORDS || term.length > 60) return
    if (definition.split(/\s+/).length < 3 || definition.length > 300) return
    const key = normalizeText(term)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ term, definition: definition.replace(/^[a-zäöü]/, (c) => c.toUpperCase()) })
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const colon = /^([^:]{2,60}):\s+(.{8,})$/.exec(line)
    if (colon && !/^https?$/i.test(colon[1])) {
      add(colon[1], colon[2])
      continue
    }
    const dash = /^([^–—]{2,60})\s+[–—-]\s+(.{8,})$/.exec(line)
    if (dash) {
      add(dash[1], dash[2])
      continue
    }
  }
  for (const s of splitSentences(text)) {
    if (s.split(/\s+/).length > 30) continue
    const unter = /^Unter (?:einem |einer |dem |der |den )?(.+?) versteht man (.+)$/i.exec(s)
    if (unter) {
      add(unter[1], unter[2])
      continue
    }
    const ist = /^((?:Der |Die |Das |Ein |Eine )?[A-ZÄÖÜ][\wäöüß-]*(?: [A-ZÄÖÜ][\wäöüß-]*){0,2}) (ist|sind|bezeichnet|nennt man|heißt) (.+)$/.exec(s)
    if (ist && !/^(Das|Es|Er|Sie|Dies|Hier|Dann|Man|Wir|Ich|Du)$/i.test(ist[1])) add(ist[1].replace(/^(Der|Die|Das|Ein|Eine) /, ''), `${ist[2] === 'ist' || ist[2] === 'sind' ? '' : ist[2] + ' '}${ist[3]}`)
  }
  return out
}

/** Frequent nouns (capitalised words not at the start of a sentence) – rough "key concepts". */
export function keyConcepts(text: string, max = 12): string[] {
  const counts = new Map<string, { word: string; n: number }>()
  for (const sentence of splitSentences(text)) {
    const words = sentence.split(/\s+/).slice(1)
    for (const w of words) {
      const clean = w.replace(/[^\wÄÖÜäöüß-]/g, '')
      if (clean.length < 4 || !/^[A-ZÄÖÜ]/.test(clean)) continue
      const key = normalizeText(clean)
      if (isStopword(key)) continue
      const c = counts.get(key)
      if (c) c.n++
      else counts.set(key, { word: clean, n: 1 })
    }
  }
  return [...counts.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, max).map((c) => c.word)
}

/** Keyword groups for checking a free-text answer: the most specific words of the definition. */
export function keywordsFor(definition: string, max = 3): string[][] {
  const words = definition
    .split(/\s+/)
    .map((w) => w.replace(/[^\wÄÖÜäöüß-]/g, ''))
    .filter((w) => w.length >= 5 && !isStopword(normalizeText(w)))
  const unique = [...new Map(words.map((w) => [normalizeText(w), w])).values()]
  unique.sort((a, b) => Number(/^[A-ZÄÖÜ]/.test(b)) - Number(/^[A-ZÄÖÜ]/.test(a)) || b.length - a.length)
  // use a stem (first 6 letters) so "Botenstoffe" also matches "Botenstoff"
  return unique.slice(0, max).map((w) => [normalizeText(w).slice(0, Math.max(5, Math.min(7, w.length - 1)))])
}

export interface GeneratedQuestionDraft {
  type: 'text' | 'mc'
  prompt: string
  answer: string
  options?: string[]
  correctIndex?: number
  keywords?: string[][]
  explanation: string
}

export function questionsFromDefinitions(defs: TermDefinition[], rand: () => number = Math.random): GeneratedQuestionDraft[] {
  const out: GeneratedQuestionDraft[] = []
  for (const d of defs) {
    out.push({
      type: 'text',
      prompt: `Erkläre mit eigenen Worten: Was bedeutet „${d.term}“?`,
      answer: d.definition,
      keywords: keywordsFor(d.definition),
      explanation: `Laut deinem Material: ${d.term} – ${d.definition}`,
    })
    if (defs.length >= 4) {
      const distractors = shuffle(defs.filter((x) => x !== d), rand).slice(0, 3).map((x) => x.term)
      const options = shuffle([d.term, ...distractors], rand)
      out.push({
        type: 'mc',
        prompt: `Welcher Begriff passt zu dieser Beschreibung?\n\n„${d.definition}“`,
        answer: d.term,
        options,
        correctIndex: options.indexOf(d.term),
        explanation: `Gesucht war „${d.term}“ (aus deinem Material).`,
      })
    }
  }
  return out
}
