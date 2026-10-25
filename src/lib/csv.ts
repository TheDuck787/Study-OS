/** Minimal RFC-4180-style CSV parser with delimiter detection (, ; or tab – Excel in Germany uses ;). */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const counts = [',', ';', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }))
  counts.sort((a, b) => b.n - a.n)
  return counts[0].n > 0 ? counts[0].d : ','
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"' && field === '') inQuotes = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

const FRONT = ['vorderseite', 'front', 'begriff', 'frage', 'englisch', 'english', 'wort', 'question', 'term']
const BACK = ['rückseite', 'rueckseite', 'back', 'bedeutung', 'antwort', 'deutsch', 'german', 'übersetzung', 'answer', 'definition']
const EXAMPLE = ['beispiel', 'example', 'beispielsatz', 'satz', 'sentence']

export interface CsvCardRow {
  front: string
  back: string
  example: string
}

/** Maps CSV rows to cards. Uses a header row if recognisable, otherwise columns 1/2/3. */
export function csvToCards(text: string): { cards: CsvCardRow[]; skipped: number; usedHeader: boolean } {
  const rows = parseCsv(text)
  if (rows.length === 0) return { cards: [], skipped: 0, usedHeader: false }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const fi = header.findIndex((h) => FRONT.includes(h))
  const bi = header.findIndex((h) => BACK.includes(h))
  const usedHeader = fi >= 0 && bi >= 0
  const ei = usedHeader ? header.findIndex((h) => EXAMPLE.includes(h)) : 2
  const body = usedHeader ? rows.slice(1) : rows
  const f = usedHeader ? fi : 0
  const b = usedHeader ? bi : 1
  let skipped = 0
  const cards: CsvCardRow[] = []
  for (const r of body) {
    const front = (r[f] ?? '').trim()
    const back = (r[b] ?? '').trim()
    if (!front || !back) {
      skipped++
      continue
    }
    cards.push({ front, back, example: ei >= 0 ? (r[ei] ?? '').trim() : '' })
  }
  return { cards, skipped, usedHeader }
}

function esc(v: string, d: string) {
  return /["\n\r]/.test(v) || v.includes(d) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: string[][], delimiter = ';'): string {
  return '﻿' + rows.map((r) => r.map((v) => esc(v, delimiter)).join(delimiter)).join('\r\n')
}
