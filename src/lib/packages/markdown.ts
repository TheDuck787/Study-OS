import { LEVEL_LABEL, PACKAGE_FORMAT, PACKAGE_VERSION, type LearningPackage, type PkgDifficulty } from './schema'
import { parsePackageJson, validatePackage, type Issue, type ValidationResult } from './validate'

/**
 * Readable Markdown/TXT version of a learning package.
 * Export writes a document a student can read and print; import reads the same structure back
 * (headings in German or English). JSON stays the exact, lossless format – in Markdown, headings inside
 * note texts are shifted to level 4 so they cannot be mistaken for new sections.
 */

// ───────────────────────── Export ─────────────────────────

const demote = (md: string) => md.replace(/^#{1,3}(?=\s)/gm, '####')
const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim()
const yes = (b: boolean | undefined) => (b ? 'ja' : 'nein')

export function packageToMarkdown(p: LearningPackage): string {
  const out: string[] = ['---', `format: ${PACKAGE_FORMAT}`, `version: ${PACKAGE_VERSION}`, `id: ${p.id}`, `subject: ${p.subject}`, `topic: ${p.topic}`]
  if (p.level) out.push(`level: ${p.level}`)
  if (p.grade !== undefined) out.push(`grade: ${p.grade}`)
  if (p.language) out.push(`language: ${p.language}`)
  if (p.author) out.push(`author: ${p.author}`)
  out.push('---', '', `# ${p.title}`, '')
  if (p.description) out.push(p.description, '')
  if (p.objectives?.length) out.push('## Lernziele', ...p.objectives.map((o) => `- ${oneLine(o)}`), '')
  if (p.notes?.length) {
    out.push('## Notizen', '')
    for (const n of p.notes) out.push(`### ${oneLine(n.title)}`, '', demote(n.content), '')
  }
  if (p.examples?.length) {
    out.push('## Beispiele', '')
    for (const e of p.examples) {
      out.push(`### ${oneLine(e.title)}`, '')
      if (e.task) out.push('**Aufgabe:**', '', demote(e.task), '')
      if (e.steps?.length) {
        out.push('**Lösungsweg:**', '')
        e.steps.forEach((s, i) => out.push(`${i + 1}. ${oneLine(s.step)}${s.why ? `  \n   *Warum:* ${oneLine(s.why)}` : ''}`))
        out.push('')
      }
      if (e.result) out.push('**Ergebnis:**', '', demote(e.result), '')
      if (e.content) out.push(demote(e.content), '')
    }
  }
  if (p.keyTerms?.length) out.push('## Fachbegriffe', ...p.keyTerms.map((k) => `- **${oneLine(k.term)}:** ${oneLine(k.definition)}${k.example ? ` *Beispiel:* ${oneLine(k.example)}` : ''}`), '')
  const examIds = new Set(p.exam?.questionIds ?? [])
  if (p.questions?.length) {
    out.push('## Fragen', '')
    for (const q of p.questions) {
      const head = { 'multiple-choice': 'MC', 'true-false': 'WF', open: 'Offen', number: 'Zahl' }[q.type]
      out.push(`### ${head}: ${oneLine(q.prompt)}`)
      if (q.id) out.push(`ID: ${q.id}`)
      if (q.type === 'multiple-choice') q.options.forEach((o, i) => out.push(`- [${i === q.correct ? 'x' : ' '}] ${oneLine(o)}`))
      if (q.type === 'true-false') out.push(`Lösung: ${q.correct ? 'wahr' : 'falsch'}`)
      if (q.type === 'open') {
        out.push(`Lösung: ${q.solution}`)
        if (q.keywords?.length) out.push(`Schlüsselwörter: ${q.keywords.map((g) => g.join(' | ')).join('; ')}`)
      }
      if (q.type === 'number') {
        out.push(`Lösung: ${String(q.answer).replace('.', ',')}`)
        if (q.unit) out.push(`Einheit: ${q.unit}`)
        if (q.tolerance !== undefined) out.push(`Toleranz: ${String(q.tolerance).replace('.', ',')}`)
      }
      if ((q.type === 'open' || q.type === 'number') && q.steps?.length) out.push('Schritte:', ...q.steps.map((s, i) => `${i + 1}. ${oneLine(s)}`))
      out.push(`Erklärung: ${q.explanation}`)
      for (const h of q.hints ?? []) out.push(`Hinweis: ${oneLine(h)}`)
      if (q.difficulty) out.push(`Schwierigkeit: ${LEVEL_LABEL[q.difficulty]}`)
      if (q.exam || (q.id && examIds.has(q.id))) out.push(`Prüfung: ${yes(true)}`)
      out.push('')
    }
  }
  if (p.exam?.timeLimitMinutes || p.exam?.title) out.push('## Prüfungsmodus', ...(p.exam.title ? [`Titel: ${p.exam.title}`] : []), ...(p.exam.timeLimitMinutes ? [`Zeit: ${p.exam.timeLimitMinutes} Minuten`] : []), '')
  if (p.flashcards?.length) out.push('## Karteikarten', ...p.flashcards.map((f) => `- ${oneLine(f.front)} :: ${oneLine(f.back)}${f.example ? ` *Beispiel:* ${oneLine(f.example)}` : ''}`), '')
  if (p.exercises?.length) {
    out.push('## Übungen', '')
    for (const e of p.exercises) {
      out.push(`### ${LEVEL_LABEL[e.level][0].toUpperCase()}${LEVEL_LABEL[e.level].slice(1)}: ${oneLine(e.prompt)}`)
      if (e.id) out.push(`ID: ${e.id}`)
      out.push(`Lösung: ${e.solution}`)
      if (e.answer !== undefined) out.push(`Ergebnis: ${String(e.answer).replace('.', ',')}`)
      if (e.unit) out.push(`Einheit: ${e.unit}`)
      if (e.steps?.length) out.push('Schritte:', ...e.steps.map((s, i) => `${i + 1}. ${oneLine(s)}`))
      out.push(`Erklärung: ${e.explanation}`, '')
    }
  }
  if (p.mistakes?.length) out.push('## Typische Fehler', ...p.mistakes.map((m) => `- **Fehler:** ${oneLine(m.mistake)}${m.why ? ` **Warum:** ${oneLine(m.why)}` : ''} **So vermeidest du ihn:** ${oneLine(m.fix)}`), '')
  if (p.summary) out.push('## Zusammenfassung', '', demote(p.summary), '')
  if (p.sources?.length) out.push('## Quellen', ...p.sources.map((s) => `- ${oneLine(s)}`), '')
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

// ───────────────────────── Import ─────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

type SectionKind = 'objectives' | 'notes' | 'examples' | 'keyTerms' | 'questions' | 'exam' | 'flashcards' | 'exercises' | 'mistakes' | 'summary' | 'sources'
const SECTION_ALIASES: [SectionKind, string[]][] = [
  ['objectives', ['lernziele', 'ziele', 'objectives', 'learning objectives', 'learning goals']],
  ['notes', ['notizen', 'erklarungen', 'erklarung', 'theorie', 'notes', 'explanations', 'theory']],
  ['examples', ['beispiele', 'musterbeispiele', 'examples', 'worked examples']],
  ['keyTerms', ['fachbegriffe', 'begriffe', 'glossar', 'key terms', 'vocabulary', 'glossary', 'terms']],
  ['questions', ['fragen', 'quiz', 'questions', 'quizfragen']],
  ['exam', ['prufung', 'prufungsmodus', 'prufungsfragen', 'exam', 'exam mode', 'test']],
  ['flashcards', ['karteikarten', 'lernkarten', 'flashcards', 'cards']],
  ['exercises', ['ubungen', 'ubungsaufgaben', 'aufgaben', 'exercises', 'practice', 'practice exercises']],
  ['mistakes', ['typische fehler', 'haufige fehler', 'fehler', 'common mistakes', 'mistakes', 'typical mistakes']],
  ['summary', ['zusammenfassung', 'lernzettel', 'summary', 'revision', 'revision sheet', 'spickzettel']],
  ['sources', ['quellen', 'sources', 'literatur']],
]
const sectionOf = (heading: string): SectionKind | null => SECTION_ALIASES.find(([, a]) => a.includes(norm(heading)))?.[0] ?? null

const LEVELS: Record<string, PkgDifficulty> = { leicht: 'easy', einfach: 'easy', easy: 'easy', mittel: 'medium', medium: 'medium', schwer: 'hard', hard: 'hard', difficult: 'hard', schwierig: 'hard' }
const QTYPES: Record<string, 'multiple-choice' | 'true-false' | 'open' | 'number'> = {
  mc: 'multiple-choice', 'multiple choice': 'multiple-choice', auswahl: 'multiple-choice', wf: 'true-false', tf: 'true-false', 'wahr falsch': 'true-false', 'true false': 'true-false',
  offen: 'open', open: 'open', frage: 'open', zahl: 'number', number: 'number', rechnung: 'number',
}
const LABELS: Record<string, string> = {
  id: 'id', 'erklarung': 'explanation', 'begrundung': 'explanation', explanation: 'explanation', 'losung': 'solution', 'musterlosung': 'solution', solution: 'solution', answer: 'solution', antwort: 'solution',
  ergebnis: 'answer', result: 'answer', einheit: 'unit', unit: 'unit', toleranz: 'tolerance', tolerance: 'tolerance', hinweis: 'hint', hint: 'hint', tipp: 'hint',
  schwierigkeit: 'difficulty', difficulty: 'difficulty', stufe: 'difficulty', 'prufung': 'exam', exam: 'exam', 'schlusselworter': 'keywords', keywords: 'keywords', 'schritte': 'steps', steps: 'steps',
}

interface Block {
  heading: string
  lines: string[]
}

function splitBlocks(lines: string[]): { intro: string[]; blocks: Block[] } {
  const intro: string[] = []
  const blocks: Block[] = []
  for (const l of lines) {
    const m = l.match(/^###\s+(.*)$/)
    if (m) blocks.push({ heading: m[1].trim(), lines: [] })
    else if (blocks.length) blocks[blocks.length - 1].lines.push(l)
    else intro.push(l)
  }
  return { intro, blocks }
}

/** Fields of a question/exercise block: "Label: value" lines (values may continue on the next lines). */
function readFields(lines: string[]) {
  const fields: Record<string, string> = {}
  const hints: string[] = []
  const steps: string[] = []
  const options: { text: string; correct: boolean }[] = []
  const promptExtra: string[] = []
  let cur: string | null = null
  for (const raw of lines) {
    const l = raw.trimEnd()
    const opt = l.match(/^\s*[-*]\s*\[( |x|X)\]\s*(.*)$/)
    if (opt) {
      options.push({ text: opt[2].trim(), correct: opt[1].toLowerCase() === 'x' })
      cur = null
      continue
    }
    const lab = l.match(/^\s*\**([A-Za-zÄÖÜäöüß ]{2,20})\**\s*:\s*\**\s*(.*)$/)
    const key = lab ? LABELS[norm(lab[1])] : undefined
    if (lab && key) {
      cur = key
      if (key === 'hint') hints.push(lab[2].trim())
      else if (key !== 'steps') fields[key] = lab[2].trim()
      continue
    }
    if (cur === 'steps') {
      const s = l.match(/^\s*(?:\d+[.)]|[-*])\s+(.*)$/)
      if (s) {
        steps.push(s[1].trim())
        continue
      }
      if (!l.trim()) continue
    }
    if (cur && cur !== 'steps') {
      if (cur === 'hint') hints[hints.length - 1] = `${hints[hints.length - 1]}\n${l}`.trim()
      else fields[cur] = `${fields[cur] ?? ''}\n${l}`.trim()
    } else if (!options.length && l.trim()) promptExtra.push(l)
    else if (l.trim()) fields.explanation = `${fields.explanation ?? ''}\n${l}`.trim()
  }
  return { fields, hints, steps, options, promptExtra }
}

const parseNumber = (s: string | undefined) => {
  if (!s) return undefined
  const m = s.trim().match(/^(-?\d+(?:[.,]\d+)?)/)
  return m ? m[1].replace(',', '.') : s.trim()
}
const listItems = (lines: string[]) => {
  const items: string[] = []
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (m) items.push(m[1].trim())
    else if (l.trim() && items.length) items[items.length - 1] += ` ${l.trim()}`
    else if (l.trim()) items.push(l.trim())
  }
  return items
}
const stripBold = (s: string) => s.replace(/^\*\*(.+?)\*\*$/, '$1').trim()

export function parsePackageMarkdown(text: string): ValidationResult {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = src.split('\n')
  const notes: Issue[] = []
  const meta: Record<string, string> = {}
  let i = 0
  if (lines[0]?.trim() === '---') {
    for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = lines[i].match(/^([A-Za-z]+)\s*:\s*(.*)$/)
      if (m) meta[m[1]] = m[2].trim()
    }
    i++
  }
  const body = lines.slice(i)
  // sections by "## "
  let title = meta.title ?? ''
  const intro: string[] = []
  const sections: { heading: string; lines: string[] }[] = []
  for (const l of body) {
    const h1 = l.match(/^#\s+(.*)$/)
    const h2 = l.match(/^##\s+(.*)$/)
    if (h1 && !sections.length && !title) title = h1[1].trim()
    else if (h2) sections.push({ heading: h2[1].trim(), lines: [] })
    else if (sections.length) sections[sections.length - 1].lines.push(l)
    else if (!h1) intro.push(l)
  }
  const pkg: Record<string, unknown> = {
    format: meta.format || PACKAGE_FORMAT, version: meta.version ? Number(meta.version) : PACKAGE_VERSION, id: meta.id, title: title || undefined,
    subject: meta.subject ?? meta.fach, topic: meta.topic ?? meta.thema, level: meta.level ?? meta.stufe, grade: meta.grade ? Number(meta.grade) : undefined,
    language: meta.language, author: meta.author, description: intro.join('\n').trim() || undefined,
  }
  const add = (key: string, v: unknown) => {
    if (!Array.isArray(pkg[key])) pkg[key] = []
    ;(pkg[key] as unknown[]).push(v)
  }
  for (const sec of sections) {
    const kind = sectionOf(sec.heading)
    const { intro: secIntro, blocks } = splitBlocks(sec.lines)
    const raw = sec.lines.join('\n').trim()
    switch (kind) {
      case 'objectives':
        for (const it of listItems(sec.lines)) add('objectives', it)
        break
      case 'sources':
        for (const it of listItems(sec.lines)) add('sources', it)
        break
      case 'summary':
        pkg.summary = [pkg.summary, raw].filter(Boolean).join('\n\n')
        break
      case 'notes':
      case 'examples':
        if (secIntro.join('').trim()) add('notes', { title: sec.heading, content: secIntro.join('\n').trim() })
        for (const b of blocks) add(kind, { title: b.heading, content: b.lines.join('\n').trim() })
        break
      case 'keyTerms':
        for (const it of listItems(sec.lines)) {
          const m = it.match(/^\*\*(.+?):?\*\*\s*:?\s*(.*)$/) ?? it.match(/^([^:—–]+?)\s*(?::|—|–| - )\s*(.*)$/)
          if (!m) {
            add('keyTerms', { term: it, definition: '' })
            continue
          }
          const [def, ex] = m[2].split(/\*Beispiel:\*|\*Example:\*/)
          add('keyTerms', { term: stripBold(m[1]), definition: def.trim(), ...(ex ? { example: ex.trim() } : {}) })
        }
        break
      case 'flashcards': {
        let pending: { front?: string; back?: string } = {}
        for (const l of sec.lines) {
          const pair = l.match(/^\s*(?:[-*+]\s+)?(.+?)\s+::\s+(.+)$/)
          const q = l.match(/^\s*(?:Q|F|Frage|Vorderseite|Front)\s*:\s*(.*)$/i)
          const a = l.match(/^\s*(?:A|Antwort|Rückseite|Ruckseite|Back)\s*:\s*(.*)$/i)
          if (pair) {
            const [back, ex] = pair[2].split(/\*Beispiel:\*|\*Example:\*/)
            add('flashcards', { front: pair[1].trim(), back: back.trim(), ...(ex ? { example: ex.trim() } : {}) })
          } else if (q) pending = { front: q[1].trim() }
          else if (a && pending.front) {
            add('flashcards', { front: pending.front, back: a[1].trim() })
            pending = {}
          } else if (l.trim()) {
            notes.push({ where: 'Karteikarten', message: `Zeile „${l.trim().slice(0, 60)}“ ist keine Karte (Format: Vorderseite :: Rückseite) – als Zusatz-Notiz übernommen.` })
            add('notes', { title: 'Karteikarten (nicht erkannt)', content: l.trim() })
          }
        }
        if (pending.front) add('flashcards', { front: pending.front, back: '' })
        break
      }
      case 'mistakes':
        for (const it of listItems(sec.lines)) {
          const lab = it.match(/\**Fehler:?\**:?\s*(.*?)\s*(?:\**Warum:?\**:?\s*(.*?)\s*)?\**(?:So vermeidest du ihn|Besser|Richtig|Abhilfe|Fix):?\**:?\s*(.*)$/i)
          const arrow = it.match(/^(.*?)\s*(?:→|->|—\s*Besser:)\s*(.*)$/)
          if (lab) add('mistakes', { mistake: lab[1].replace(/\*+/g, '').trim(), ...(lab[2] ? { why: lab[2].replace(/\*+/g, '').trim() } : {}), fix: lab[3].replace(/\*+/g, '').trim() })
          else if (arrow) add('mistakes', { mistake: arrow[1].trim(), fix: arrow[2].trim() })
          else add('mistakes', { mistake: it, fix: '' })
        }
        break
      case 'questions':
      case 'exam': {
        if (kind === 'exam') {
          const t = secIntro.join('\n').match(/(?:Zeit|Time)\s*:\s*(\d+)/i)
          const tt = secIntro.join('\n').match(/(?:Titel|Title)\s*:\s*(.+)/i)
          if (t || tt) pkg.exam = { ...(pkg.exam as object), ...(t ? { timeLimitMinutes: Number(t[1]) } : {}), ...(tt ? { title: tt[1].trim() } : {}) }
        }
        for (const b of blocks) {
          const m = b.heading.match(/^([^:]{1,20}):\s*(.*)$/)
          const type = m ? QTYPES[norm(m[1])] : undefined
          const { fields, hints, steps, options, promptExtra } = readFields(b.lines)
          const prompt = [type ? m![2] : b.heading, ...promptExtra].join('\n').trim()
          const q: Record<string, unknown> = { type: type ?? (options.length ? 'multiple-choice' : 'open'), prompt, explanation: fields.explanation }
          if (fields.id) q.id = fields.id
          if (hints.length) q.hints = hints
          if (fields.difficulty) q.difficulty = LEVELS[norm(fields.difficulty)] ?? fields.difficulty
          if (kind === 'exam' || /^(ja|yes|true|x)$/i.test(fields.exam ?? '')) q.exam = true
          if (q.type === 'multiple-choice') {
            q.options = options.map((o) => o.text)
            q.correct = options.findIndex((o) => o.correct)
            if (options.filter((o) => o.correct).length > 1) notes.push({ where: `Fragen „${prompt.slice(0, 40)}“`, message: 'Mehrere Antworten sind angekreuzt – die erste gilt als richtig.' })
          } else if (q.type === 'true-false') q.correct = fields.solution ?? ''
          else if (q.type === 'open') {
            q.solution = fields.solution
            if (fields.keywords) q.keywords = fields.keywords.split(';').map((g) => g.split('|').map((x) => x.trim()).filter(Boolean)).filter((g) => g.length)
            if (steps.length) q.steps = steps
          } else {
            q.answer = parseNumber(fields.solution ?? fields.answer)
            if (fields.unit) q.unit = fields.unit
            if (fields.tolerance) q.tolerance = parseNumber(fields.tolerance)
            if (steps.length) q.steps = steps
          }
          add('questions', q)
        }
        break
      }
      case 'exercises':
        for (const b of blocks) {
          const m = b.heading.match(/^([^:]{1,20}):\s*(.*)$/)
          const level = m ? LEVELS[norm(m[1])] : undefined
          const { fields, steps, promptExtra } = readFields(b.lines)
          add('exercises', {
            ...(fields.id ? { id: fields.id } : {}), level: level ?? (m ? m[1] : undefined), prompt: [level ? m![2] : b.heading, ...promptExtra].join('\n').trim(),
            solution: fields.solution, explanation: fields.explanation, ...(steps.length ? { steps } : {}), ...(fields.answer ? { answer: parseNumber(fields.answer) } : {}), ...(fields.unit ? { unit: fields.unit } : {}),
          })
        }
        if (secIntro.join('').trim()) add('notes', { title: sec.heading, content: secIntro.join('\n').trim() })
        break
      default:
        // never drop content: an unknown section becomes a note
        if (raw) {
          add('notes', { title: sec.heading, content: raw })
          notes.push({ where: `Abschnitt „${sec.heading}“`, message: 'Unbekannte Überschrift – als Notiz übernommen.' })
        }
    }
  }
  const res = validatePackage(pkg)
  return { ...res, warnings: [...notes, ...res.warnings] }
}

/** Picks the parser by file name / content. */
export function parsePackageFile(name: string, text: string): ValidationResult & { kind: 'json' | 'markdown' } {
  const looksJson = /\.json$/i.test(name) || /^\s*\{/.test(text.replace(/^\uFEFF/, ''))
  return looksJson ? { ...parsePackageJson(text), kind: 'json' } : { ...parsePackageMarkdown(text), kind: 'markdown' }
}
