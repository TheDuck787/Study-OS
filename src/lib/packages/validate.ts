import {
  KNOWN_FIELDS, PACKAGE_FORMAT, PACKAGE_VERSION, QUESTION_TYPES,
  type LearningPackage, type PkgDifficulty, type PkgExample, type PkgExercise, type PkgFlashcard, type PkgKeyTerm, type PkgMistake, type PkgNote, type PkgQuestion,
} from './schema'

/**
 * Checks a learning package and returns a cleaned copy plus every problem in plain German.
 * Errors block the import; warnings are shown in the preview. Nothing is dropped silently:
 * unknown fields are reported and kept as "extras" (imported as an extra note).
 */

export interface Issue {
  /** Human-readable location, e.g. "Fragen Nr. 4 › Antwortmöglichkeiten". */
  where: string
  message: string
}

export interface Extra {
  where: string
  value: unknown
}

export interface ValidationResult {
  pkg: LearningPackage | null
  errors: Issue[]
  warnings: Issue[]
  extras: Extra[]
}

const SECTION_LABEL: Record<string, string> = {
  notes: 'Notizen', examples: 'Beispiele', keyTerms: 'Fachbegriffe', questions: 'Fragen', flashcards: 'Karteikarten', exercises: 'Übungen',
  mistakes: 'Typische Fehler', objectives: 'Lernziele', sources: 'Quellen',
}
const LIMITS = { short: 200, prompt: 4000, text: 20_000, note: 200_000, items: 1000 }
const DIFFS: PkgDifficulty[] = ['easy', 'medium', 'hard']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Checker {
  errors: Issue[] = []
  warnings: Issue[] = []
  extras: Extra[] = []
  err(where: string, message: string) {
    this.errors.push({ where, message })
  }
  warn(where: string, message: string) {
    this.warnings.push({ where, message })
  }
  /** Required or optional text field; returns the trimmed text (never truncated – too long is an error). */
  text(o: Obj, key: string, where: string, label: string, opts: { required?: boolean; max?: number } = {}): string | undefined {
    const v = o[key]
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
      if (opts.required) this.err(where, `${label} fehlt.`)
      return undefined
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      this.warn(where, `${label} war keine Zeichenkette und wurde umgewandelt.`)
      return String(v)
    }
    if (typeof v !== 'string') {
      this.err(where, `${label} muss Text sein.`)
      return undefined
    }
    const s = v.replace(/\r\n/g, '\n').trim()
    const max = opts.max ?? LIMITS.text
    if (s.length > max) this.err(where, `${label} ist zu lang (${s.length.toLocaleString('de-DE')} Zeichen, höchstens ${max.toLocaleString('de-DE')}).`)
    return s
  }
  textList(o: Obj, key: string, where: string, label: string): string[] | undefined {
    const v = o[key]
    if (v === undefined || v === null) return undefined
    const arr = typeof v === 'string' ? [v] : v
    if (!Array.isArray(arr)) {
      this.err(where, `${label} muss eine Liste sein.`)
      return undefined
    }
    const out: string[] = []
    arr.forEach((x, i) => {
      if (typeof x === 'string' && x.trim()) out.push(x.trim())
      else if (typeof x === 'number') out.push(String(x))
      else this.err(`${where} › ${label} Nr. ${i + 1}`, 'Leerer oder ungültiger Eintrag.')
    })
    return out
  }
  /** Fields that are not part of the format are kept (and reported) instead of being dropped. */
  unknown(o: Obj, known: string[], where: string) {
    for (const k of Object.keys(o)) {
      if (known.includes(k)) continue
      this.warn(where, `Unbekanntes Feld „${k}“ – wird als Zusatz-Notiz übernommen, nicht verworfen.`)
      this.extras.push({ where: `${where} › ${k}`, value: o[k] })
    }
  }
}

function difficulty(c: Checker, o: Obj, where: string, key = 'difficulty', required = false): PkgDifficulty | undefined {
  const v = o[key]
  if (v === undefined || v === null || v === '') {
    if (required) c.err(where, `Die Stufe fehlt (easy, medium oder hard).`)
    return undefined
  }
  const map: Record<string, PkgDifficulty> = { easy: 'easy', leicht: 'easy', einfach: 'easy', medium: 'medium', mittel: 'medium', hard: 'hard', schwer: 'hard', difficult: 'hard', '1': 'easy', '2': 'medium', '3': 'hard' }
  const d = map[String(v).toLowerCase().trim()]
  if (!d) c.err(where, `Unbekannte Stufe „${String(v)}“ – erlaubt sind easy, medium, hard.`)
  else if (!DIFFS.includes(String(v) as PkgDifficulty)) c.warn(where, `Stufe „${String(v)}“ als „${d}“ übernommen.`)
  return d
}

function number(c: Checker, o: Obj, key: string, where: string, label: string, required: boolean): number | undefined {
  const v = o[key]
  if (v === undefined || v === null || v === '') {
    if (required) c.err(where, `${label} fehlt.`)
    return undefined
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) {
    c.warn(where, `${label} „${v}“ als Zahl übernommen.`)
    return Number(v.trim().replace(',', '.'))
  }
  c.err(where, `${label} muss eine Zahl sein.`)
  return undefined
}

function list(c: Checker, root: Obj, key: string): Obj[] {
  const v = root[key]
  if (v === undefined || v === null) return []
  const label = SECTION_LABEL[key] ?? key
  if (!Array.isArray(v)) {
    c.err(label, 'Muss eine Liste (Array) sein.')
    return []
  }
  if (v.length > LIMITS.items) c.err(label, `Zu viele Einträge (${v.length}, höchstens ${LIMITS.items}).`)
  return v.map((x, i) => {
    if (!isObj(x)) {
      c.err(`${label} Nr. ${i + 1}`, 'Muss ein Objekt mit Feldern sein.')
      return {}
    }
    return x
  })
}

function itemIds(c: Checker, items: { id?: string }[], label: string) {
  const seen = new Set<string>()
  items.forEach((it, i) => {
    if (!it.id) return
    if (seen.has(it.id)) c.err(`${label} Nr. ${i + 1}`, `Die ID „${it.id}“ kommt mehrfach vor.`)
    seen.add(it.id)
  })
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export function validatePackage(input: unknown): ValidationResult {
  const c = new Checker()
  const done = (pkg: LearningPackage | null): ValidationResult => ({ pkg: c.errors.length ? null : pkg, errors: c.errors, warnings: c.warnings, extras: c.extras })
  if (!isObj(input)) {
    c.err('Datei', 'Die Datei enthält kein Lernpaket (erwartet wird ein JSON-Objekt { … }).')
    return done(null)
  }
  const r = input
  if (r.format !== PACKAGE_FORMAT) {
    if (r.format === undefined) c.err('format', `Das Feld „format“ fehlt. Es muss "${PACKAGE_FORMAT}" lauten – so erkennt Study OS ein Lernpaket.`)
    else c.err('format', `Unbekanntes Format „${String(r.format)}“ – erwartet wird "${PACKAGE_FORMAT}".`)
  }
  const version = typeof r.version === 'number' ? r.version : Number(r.version)
  if (r.version === undefined) c.warn('version', `„version“ fehlt – Version ${PACKAGE_VERSION} angenommen.`)
  else if (!Number.isInteger(version) || version < 1) c.err('version', '„version“ muss eine ganze Zahl sein (aktuell 1).')
  else if (version > PACKAGE_VERSION) c.err('version', `Dieses Paket hat Version ${version}; diese Study-OS-Version kann bis Version ${PACKAGE_VERSION} lesen. Bitte Study OS aktualisieren.`)

  const subject = c.text(r, 'subject', 'subject', 'Das Fach („subject“)', { required: true, max: 60 })
  const topic = c.text(r, 'topic', 'topic', 'Das Thema („topic“)', { required: true, max: 120 })
  let id = c.text(r, 'id', 'id', 'Die Paket-ID („id“)', { max: 80 })
  if (!id && subject && topic) {
    id = slugify(`${subject}-${topic}`)
    c.warn('id', `„id“ fehlt – „${id}“ aus Fach und Thema gebildet. Gib eine feste ID an, damit ein erneuter Import erkannt wird.`)
  } else if (id && !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    const s = slugify(id)
    if (!s) c.err('id', 'Die Paket-ID darf nur aus Buchstaben a–z, Ziffern und Bindestrichen bestehen.')
    else {
      c.warn('id', `Paket-ID „${id}“ zu „${s}“ vereinheitlicht.`)
      id = s
    }
  }
  const title = c.text(r, 'title', 'title', 'Der Titel', { max: LIMITS.short }) ?? (topic ? `${topic}${subject ? ` (${subject})` : ''}` : undefined)
  const grade = r.grade === undefined ? undefined : number(c, r, 'grade', 'grade', 'Die Klassenstufe („grade“)', false)

  // ── sections ──
  const notes: PkgNote[] = list(c, r, 'notes').map((o, i) => {
    const w = `Notizen Nr. ${i + 1}`
    c.unknown(o, ['id', 'title', 'content'], w)
    return { id: c.text(o, 'id', w, 'Die ID', { max: 80 }), title: c.text(o, 'title', w, 'Der Titel', { required: true, max: LIMITS.short }) ?? '', content: c.text(o, 'content', w, 'Der Inhalt', { required: true, max: LIMITS.note }) ?? '' }
  })
  const examples: PkgExample[] = list(c, r, 'examples').map((o, i) => {
    const w = `Beispiele Nr. ${i + 1}`
    c.unknown(o, ['id', 'title', 'task', 'steps', 'result', 'content'], w)
    const steps = o.steps === undefined ? undefined : Array.isArray(o.steps)
      ? o.steps.map((s, j) => {
          const sw = `${w} › Schritt ${j + 1}`
          if (typeof s === 'string') return { step: s.trim(), why: '' }
          if (!isObj(s)) {
            c.err(sw, 'Muss ein Objekt { "step": …, "why": … } sein.')
            return { step: '', why: '' }
          }
          c.unknown(s, ['step', 'why'], sw)
          const step = c.text(s, 'step', sw, 'Der Schritt', { required: true }) ?? ''
          const why = c.text(s, 'why', sw, 'Die Begründung („why“)') ?? ''
          if (!why) c.warn(sw, 'Ohne Begründung („why“) – besser erklären, warum der Schritt richtig ist.')
          return { step, why }
        })
      : (c.err(w, '„steps“ muss eine Liste sein.'), undefined)
    const ex: PkgExample = { id: c.text(o, 'id', w, 'Die ID', { max: 80 }), title: c.text(o, 'title', w, 'Der Titel', { required: true, max: LIMITS.short }) ?? '', task: c.text(o, 'task', w, 'Die Aufgabe', { max: LIMITS.note }), steps, result: c.text(o, 'result', w, 'Das Ergebnis', { max: LIMITS.note }), content: c.text(o, 'content', w, 'Der Inhalt', { max: LIMITS.note }) }
    if (!ex.task && !ex.steps?.length && !ex.result && !ex.content) c.err(w, 'Das Beispiel hat keinen Inhalt (task, steps, result oder content).')
    return ex
  })
  const keyTerms: PkgKeyTerm[] = list(c, r, 'keyTerms').map((o, i) => {
    const w = `Fachbegriffe Nr. ${i + 1}`
    c.unknown(o, ['term', 'definition', 'example'], w)
    return { term: c.text(o, 'term', w, 'Der Begriff', { required: true, max: LIMITS.short }) ?? '', definition: c.text(o, 'definition', w, 'Die Definition', { required: true }) ?? '', example: c.text(o, 'example', w, 'Das Beispiel') }
  })
  const questions: PkgQuestion[] = list(c, r, 'questions').map((o, i) => {
    const w = `Fragen Nr. ${i + 1}`
    const type = String(o.type ?? '')
    const aliases: Record<string, PkgQuestion['type']> = { mc: 'multiple-choice', 'multiple-choice': 'multiple-choice', multiplechoice: 'multiple-choice', 'true-false': 'true-false', tf: 'true-false', truefalse: 'true-false', 'wahr-falsch': 'true-false', open: 'open', offen: 'open', text: 'open', number: 'number', numeric: 'number', zahl: 'number' }
    const t = aliases[type.toLowerCase()]
    if (!t) c.err(w, type ? `Unbekannter Fragetyp „${type}“ – erlaubt: ${QUESTION_TYPES.join(', ')}.` : `Der Fragetyp („type“) fehlt – erlaubt: ${QUESTION_TYPES.join(', ')}.`)
    else if (t !== type) c.warn(w, `Fragetyp „${type}“ als „${t}“ übernommen.`)
    const base = {
      id: c.text(o, 'id', w, 'Die ID', { max: 80 }),
      prompt: c.text(o, 'prompt', w, 'Die Frage („prompt“)', { required: true, max: LIMITS.prompt }) ?? '',
      explanation: c.text(o, 'explanation', w, 'Die Erklärung („explanation“) – eine Lösung braucht immer eine Begründung –', { required: true }) ?? '',
      difficulty: difficulty(c, o, w),
      hints: c.textList(o, 'hints', w, 'Hinweis'),
      exam: o.exam === undefined ? undefined : !!o.exam,
    }
    const common = ['id', 'type', 'prompt', 'explanation', 'difficulty', 'hints', 'exam']
    if (t === 'multiple-choice') {
      c.unknown(o, [...common, 'options', 'correct', 'optionExplanations'], w)
      const options = c.textList(o, 'options', w, 'Antwortmöglichkeit') ?? []
      if (options.length < 2) c.err(w, 'Eine Auswahlfrage braucht mindestens 2 Antwortmöglichkeiten („options“).')
      if (options.length > 10) c.err(w, 'Höchstens 10 Antwortmöglichkeiten.')
      if (new Set(options.map((x) => x.toLowerCase())).size !== options.length) c.err(w, 'Zwei Antwortmöglichkeiten sind gleich.')
      let correct = number(c, o, 'correct', w, 'Die richtige Antwort („correct“, Index ab 0)', true)
      if (correct === undefined && typeof o.correct === 'string') {
        const idx = options.findIndex((x) => x === o.correct)
        if (idx >= 0) {
          correct = idx
          c.errors.pop()
          c.warn(w, '„correct“ war der Antworttext und wurde in die Nummer umgewandelt.')
        }
      }
      if (correct !== undefined && (!Number.isInteger(correct) || correct < 0 || correct >= options.length)) c.err(w, `„correct“ muss zwischen 0 und ${Math.max(0, options.length - 1)} liegen (Zählung ab 0).`)
      const optionExplanations = c.textList(o, 'optionExplanations', w, 'Erklärung zur Antwort')
      if (optionExplanations && optionExplanations.length !== options.length) c.err(w, `„optionExplanations“ braucht genau eine Erklärung pro Antwort (${options.length}).`)
      return { ...base, type: t, options, correct: correct ?? 0, optionExplanations }
    }
    if (t === 'true-false') {
      c.unknown(o, [...common, 'correct', 'statement'], w)
      let prompt = base.prompt
      if (!prompt && typeof o.statement === 'string') {
        prompt = o.statement.trim()
        c.errors = c.errors.filter((e) => !(e.where === w && e.message.startsWith('Die Frage')))
      }
      let correct: boolean | undefined
      if (typeof o.correct === 'boolean') correct = o.correct
      else if (typeof o.correct === 'string' && /^(wahr|richtig|true|ja|falsch|false|nein)$/i.test(o.correct.trim())) {
        correct = /^(wahr|richtig|true|ja)$/i.test(o.correct.trim())
        c.warn(w, `„correct“: „${o.correct}“ als ${correct ? 'wahr' : 'falsch'} übernommen.`)
      } else c.err(w, '„correct“ muss true (wahr) oder false (falsch) sein.')
      return { ...base, prompt, type: t, correct: correct ?? false }
    }
    if (t === 'open') {
      c.unknown(o, [...common, 'solution', 'keywords', 'steps'], w)
      const solution = c.text(o, 'solution', w, 'Die Musterlösung („solution“)', { required: true }) ?? ''
      let keywords: string[][] | undefined
      if (o.keywords !== undefined) {
        if (!Array.isArray(o.keywords) || !o.keywords.every((g) => (Array.isArray(g) && g.every((x) => typeof x === 'string' && x.trim())) || (typeof g === 'string' && g.trim()))) c.err(w, '„keywords“ muss eine Liste von Gruppen sein, z. B. [["Ich-Erzähler", "Ich-Erzählerin"], ["Präsens"]].')
        else keywords = (o.keywords as (string | string[])[]).map((g) => (typeof g === 'string' ? [g.trim()] : g.map((x) => x.trim())))
      }
      return { ...base, type: t, solution, keywords, steps: c.textList(o, 'steps', w, 'Schritt') }
    }
    if (t === 'number') {
      c.unknown(o, [...common, 'answer', 'unit', 'tolerance', 'steps'], w)
      const tolerance = number(c, o, 'tolerance', w, 'Die Toleranz', false)
      if (tolerance !== undefined && tolerance < 0) c.err(w, 'Die Toleranz darf nicht negativ sein.')
      return { ...base, type: t, answer: number(c, o, 'answer', w, 'Das Ergebnis („answer“)', true) ?? 0, unit: c.text(o, 'unit', w, 'Die Einheit', { max: 40 }), tolerance, steps: c.textList(o, 'steps', w, 'Schritt') }
    }
    return { ...base, type: 'open', solution: '' } as PkgQuestion
  })
  const flashcards: PkgFlashcard[] = list(c, r, 'flashcards').map((o, i) => {
    const w = `Karteikarten Nr. ${i + 1}`
    c.unknown(o, ['front', 'back', 'example'], w)
    return { front: c.text(o, 'front', w, 'Die Vorderseite („front“)', { required: true, max: 2000 }) ?? '', back: c.text(o, 'back', w, 'Die Rückseite („back“)', { required: true, max: 4000 }) ?? '', example: c.text(o, 'example', w, 'Das Beispiel', { max: 2000 }) }
  })
  const exercises: PkgExercise[] = list(c, r, 'exercises').map((o, i) => {
    const w = `Übungen Nr. ${i + 1}`
    c.unknown(o, ['id', 'level', 'prompt', 'solution', 'explanation', 'steps', 'answer', 'unit', 'tolerance'], w)
    return {
      id: c.text(o, 'id', w, 'Die ID', { max: 80 }), level: difficulty(c, o, w, 'level', true) ?? 'medium',
      prompt: c.text(o, 'prompt', w, 'Die Aufgabe („prompt“)', { required: true, max: LIMITS.prompt }) ?? '',
      solution: c.text(o, 'solution', w, 'Die Lösung („solution“)', { required: true }) ?? '',
      explanation: c.text(o, 'explanation', w, 'Die Erklärung („explanation“)', { required: true }) ?? '',
      steps: c.textList(o, 'steps', w, 'Schritt'), answer: number(c, o, 'answer', w, 'Das Ergebnis', false), unit: c.text(o, 'unit', w, 'Die Einheit', { max: 40 }), tolerance: number(c, o, 'tolerance', w, 'Die Toleranz', false),
    }
  })
  const mistakes: PkgMistake[] = list(c, r, 'mistakes').map((o, i) => {
    const w = `Typische Fehler Nr. ${i + 1}`
    c.unknown(o, ['mistake', 'why', 'fix'], w)
    return { mistake: c.text(o, 'mistake', w, 'Der Fehler („mistake“)', { required: true }) ?? '', why: c.text(o, 'why', w, 'Die Begründung'), fix: c.text(o, 'fix', w, 'Die Abhilfe („fix“)', { required: true }) ?? '' }
  })
  itemIds(c, notes, 'Notizen')
  itemIds(c, examples, 'Beispiele')
  itemIds(c, questions, 'Fragen')
  itemIds(c, exercises, 'Übungen')

  let exam: LearningPackage['exam']
  if (r.exam !== undefined) {
    if (!isObj(r.exam)) c.err('exam', 'Muss ein Objekt sein.')
    else {
      c.unknown(r.exam, ['title', 'timeLimitMinutes', 'questionIds'], 'Prüfungsmodus')
      const ids = c.textList(r.exam, 'questionIds', 'Prüfungsmodus', 'Fragen-ID')
      for (const qid of ids ?? []) if (!questions.some((q) => q.id === qid)) c.err('Prüfungsmodus', `Die Frage „${qid}“ gibt es im Paket nicht.`)
      const tl = number(c, r.exam, 'timeLimitMinutes', 'Prüfungsmodus', 'Die Zeit in Minuten', false)
      if (tl !== undefined && !(tl >= 1 && tl <= 300)) c.err('Prüfungsmodus', 'Die Zeit muss zwischen 1 und 300 Minuten liegen.')
      exam = { title: c.text(r.exam, 'title', 'Prüfungsmodus', 'Der Titel', { max: LIMITS.short }), timeLimitMinutes: tl, questionIds: ids }
    }
  }
  c.unknown(r, [...KNOWN_FIELDS], 'Paket')
  if (isObj(r.extra)) c.extras.push({ where: 'Paket › extra', value: r.extra })

  const pkg: LearningPackage = {
    format: PACKAGE_FORMAT, version: PACKAGE_VERSION, id: id ?? '', title: title ?? '', subject: subject ?? '', topic: topic ?? '',
    level: c.text(r, 'level', 'level', 'Die Stufe („level“)', { max: 60 }), grade, language: c.text(r, 'language', 'language', 'Die Sprache', { max: 20 }),
    description: c.text(r, 'description', 'description', 'Die Beschreibung'), author: c.text(r, 'author', 'author', 'Der Autor', { max: LIMITS.short }),
    createdAt: c.text(r, 'createdAt', 'createdAt', 'Das Datum', { max: 40 }), sources: c.textList(r, 'sources', 'Quellen', 'Quelle'),
    objectives: c.textList(r, 'objectives', 'Lernziele', 'Lernziel'), notes, examples, keyTerms, questions, flashcards, exercises, mistakes,
    summary: c.text(r, 'summary', 'summary', 'Die Zusammenfassung', { max: LIMITS.note }), exam,
  }
  const hasContent = notes.length + examples.length + keyTerms.length + questions.length + flashcards.length + exercises.length + mistakes.length + (pkg.objectives?.length ?? 0) > 0 || !!pkg.summary
  if (!hasContent) c.err('Paket', 'Das Paket enthält keine Inhalte (Notizen, Fragen, Karteikarten …).')
  return done(pkg)
}

/** Reads a JSON file and validates it; JSON syntax errors are reported with line and column. */
export function parsePackageJson(text: string): ValidationResult {
  const clean = text.replace(/^\uFEFF/, '')
  try {
    return validatePackage(JSON.parse(clean))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const pos = Number(msg.match(/position (\d+)/)?.[1])
    let where = 'JSON'
    if (Number.isFinite(pos)) {
      const before = clean.slice(0, pos)
      where = `Zeile ${before.split('\n').length}, Spalte ${pos - before.lastIndexOf('\n')}`
    }
    return { pkg: null, errors: [{ where, message: `Die Datei ist kein gültiges JSON (${msg}). Häufige Ursachen: fehlendes Komma, Komma nach dem letzten Eintrag, einfache statt doppelter Anführungszeichen.` }], warnings: [], extras: [] }
  }
}
