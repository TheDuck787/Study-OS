/** Normalisation for comparing short answers. Accepts ae/oe/ue/ss for ä/ö/ü/ß. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[„“”‚‘’´`]/g, "'")
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.!?;:,"']+$/g, '')
    .replace(/^[.!?;:,"']+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Allowed typo distance for a word of this length (0 for very short words). */
export function typoBudget(len: number): number {
  if (len >= 9) return 2
  if (len >= 4) return 1
  return 0
}

/**
 * Expands an expected answer into accepted variants:
 * "to improve; to get better" → ["to improve", "improve", "to get better", "get better"]
 * "(sich) verbessern" → ["sich verbessern", "verbessern"]
 */
export function expandVariants(expected: string): string[] {
  const parts = expected
    .split(/\s*[;/|]\s*|,\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    const withParen = p.replace(/[()]/g, '').replace(/\s+/g, ' ').trim()
    const withoutParen = p.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    for (const v of [withParen, withoutParen]) {
      if (!v) continue
      out.add(v)
      if (/^to\s+\S/i.test(v)) out.add(v.replace(/^to\s+/i, ''))
    }
  }
  return [...out]
}

export const GERMAN_ARTICLES = ['der', 'die', 'das']

export function splitArticle(s: string): { article: string | null; rest: string } {
  const m = /^(der|die|das)\s+(.+)$/i.exec(s.trim())
  return m ? { article: m[1].toLowerCase(), rest: m[2] } : { article: null, rest: s.trim() }
}

/** Simple tokenizer for search and keyword extraction. */
export function tokenize(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
}

const STOPWORDS = new Set(
  'der die das und oder ein eine einer eines einem einen ist sind war waren wird werden wurde wurden hat haben mit von zu zum zur im in am an auf aus bei fuer ueber unter nach vor als auch nicht kein keine sich es er sie wir ihr ich du man dass wenn dann so wie was wer wo noch nur sehr mehr oft dem den des the a an of to and or is are was were in on for with as by at be this that it from'.split(' '),
)

export function isStopword(t: string): boolean {
  return STOPWORDS.has(t)
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Simple relevance score of a document for a query (term frequency on tokens). */
export function searchScore(query: string, ...fields: string[]): number {
  const q = tokenize(query).filter((t) => !isStopword(t))
  if (q.length === 0) return 0
  const hay = normalizeText(fields.join(' \n '))
  let score = 0
  for (const t of q) {
    if (!hay.includes(t)) return 0
    score += hay.split(t).length - 1
  }
  return score
}

/** Short excerpt around the first query hit, for search results and tutor context. */
export function excerpt(text: string, query: string, radius = 120): string {
  const q = tokenize(query).filter((t) => !isStopword(t))
  const norm = normalizeText(text)
  let idx = -1
  for (const t of q) {
    idx = norm.indexOf(t)
    if (idx >= 0) break
  }
  // normalizeText may change length (ä→ae); approximate position is good enough for an excerpt.
  if (idx < 0) return text.slice(0, radius * 2).trim() + (text.length > radius * 2 ? ' …' : '')
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + radius)
  return (start > 0 ? '… ' : '') + text.slice(start, end).trim() + (end < text.length ? ' …' : '')
}
