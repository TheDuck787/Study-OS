import { z } from 'zod'

/**
 * Shared AI contract between the browser and the optional server proxy.
 * Prompts are built here (not from free client text) so every provider gets the same
 * honesty rules: separate material vs. extra explanation, admit uncertainty, hints first.
 * No DOM or Node APIs in this file.
 */

export const EXPLANATION_MODES = {
  simple: { label: 'Super einfach', instruction: 'Erkläre super einfach: kurze Sätze, Vergleiche aus dem Alltag, Fachwörter nur mit sofortiger Erklärung. Höchstens etwa 120 Wörter. Vereinfache, aber bleib fachlich korrekt.' },
  normal: { label: 'Wie im Unterricht', instruction: 'Erkläre so, wie es im Unterricht der Klassenstufe üblich ist: Fachbegriffe verwenden und kurz erklären. Höchstens etwa 200 Wörter.' },
  detailed: { label: 'Ausführlich', instruction: 'Erkläre ausführlich: Hintergründe, Zusammenhänge, typische Fehler und ein Beispiel. Gliedere mit kurzen Zwischenüberschriften.' },
  examples: { label: 'Mit Beispielen', instruction: 'Erkläre vor allem über zwei bis drei konkrete Beispiele aus dem Alltag von Jugendlichen. Leite erst danach die allgemeine Regel ab.' },
  steps: { label: 'Schritt für Schritt üben', instruction: 'Übe Schritt für Schritt: Gib immer nur EINEN kleinen Schritt oder eine kleine Teilaufgabe vor und warte auf die Antwort. Gib dann Feedback und erst danach den nächsten Schritt. Verrate keine späteren Schritte oder die Endlösung im Voraus.' },
} as const

export type ExplanationModeKey = keyof typeof EXPLANATION_MODES

export const tutorRequestSchema = z.object({
  mode: z.enum(['simple', 'normal', 'detailed', 'examples', 'steps']),
  student: z.object({ grade: z.number().int().min(1).max(13), schoolType: z.string().max(60), region: z.string().max(60) }),
  subject: z.string().max(80).nullable(),
  topic: z.string().max(160).nullable(),
  materials: z.array(z.object({ title: z.string().max(200), text: z.string().max(60_000) })).max(5),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(20_000) })).min(1).max(60),
})
export type TutorRequest = z.infer<typeof tutorRequestSchema>

export function tutorSystemPrompt(r: Omit<TutorRequest, 'messages'>): string {
  const m = EXPLANATION_MODES[r.mode]
  const parts = [
    `Du bist ein geduldiger, ermutigender Lern-Tutor für eine Schülerin oder einen Schüler der Klasse ${r.student.grade} (${r.student.schoolType}, ${r.student.region}).`,
    r.subject ? `Fach: ${r.subject}.` : '',
    r.topic ? `Thema: ${r.topic}.` : '',
    '',
    'Regeln:',
    '- Antworte auf Deutsch. (Im Fach Englisch dürfen Beispiele und Übungen auf Englisch sein.)',
    `- Erklärmodus „${m.label}“: ${m.instruction}`,
    '- Sei ehrlich: Wenn du dir nicht sicher bist oder etwas nicht weißt, sag das deutlich. Erfinde keine Fakten, Zahlen, Zitate oder Quellen.',
    '- Bei Aufgaben gibst du zuerst einen Hinweis, nicht sofort die Lösung – außer der Schüler bittet ausdrücklich um die Lösung.',
    '- Wenn eine Antwort falsch ist: freundlich bleiben, nie abwertend. Erkläre, WARUM sie falsch ist und welcher Denkfehler vermutlich dahintersteckt. Lobe, was richtig war.',
    '- Prüfe Verständnis: Stelle am Ende einer Erklärung eine kurze Kontrollfrage, wenn es passt.',
    '- Mathematik: Formeln in LaTeX zwischen $…$, Rechenwege Schritt für Schritt. Rechne sorgfältig nach.',
    '- Garantiere niemals eine bestimmte Note.',
    '- Nutze Markdown sparsam (kurze Absätze, Listen). Keine Emojis.',
  ]
  if (r.materials.length > 0) {
    parts.push(
      '',
      'Der Schüler hat folgendes eigenes Lernmaterial bereitgestellt. Trenne in deiner Antwort klar:',
      '- Inhalte aus dem Material beginnst du mit „**Aus deinem Material:**“ (nenne den Titel).',
      '- Eigene, zusätzliche Erklärungen beginnst du mit „**Zusätzlich erklärt:**“.',
      '- Wenn die Antwort nicht im Material steht, sag das ausdrücklich. Behaupte nie, etwas stehe im Material, wenn es dort nicht steht.',
      '',
      ...r.materials.map((mat, i) => `<material nummer="${i + 1}" titel="${mat.title.replace(/"/g, "'")}">\n${mat.text}\n</material>`),
    )
  } else {
    parts.push('', 'Es wurde kein Lernmaterial mitgeschickt. Behaupte nicht, Dokumente oder Arbeitsblätter des Schülers zu kennen.')
  }
  return parts.filter((p, i, a) => !(p === '' && a[i - 1] === '')).join('\n')
}

// ───────────── Generation tasks (structured JSON output) ─────────────

export const generateRequestSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('summary'), title: z.string().max(200), text: z.string().min(1).max(60_000), grade: z.number().int() }),
  z.object({ task: z.literal('flashcards'), title: z.string().max(200), text: z.string().min(1).max(60_000), count: z.number().int().min(1).max(40), grade: z.number().int() }),
  z.object({ task: z.literal('questions'), title: z.string().max(200), text: z.string().min(1).max(60_000), count: z.number().int().min(1).max(30), grade: z.number().int(), subject: z.string().max(80).nullable() }),
  z.object({ task: z.literal('practice'), subject: z.string().max(80), topic: z.string().max(160), description: z.string().max(1000), count: z.number().int().min(1).max(20), difficulty: z.number().int().min(1).max(4), grade: z.number().int() }),
  z.object({ task: z.literal('grade'), question: z.string().max(4000), modelAnswer: z.string().max(4000), studentAnswer: z.string().max(4000), grade: z.number().int() }),
  z.object({ task: z.literal('explain-mistake'), question: z.string().max(4000), correctAnswer: z.string().max(4000), studentAnswer: z.string().max(4000), grade: z.number().int(), mode: z.enum(['simple', 'normal', 'detailed', 'examples', 'steps']) }),
])
export type GenerateRequest = z.infer<typeof generateRequestSchema>

export const summaryOutput = z.object({
  summary: z.string().min(1),
  keyConcepts: z.array(z.string()).max(30),
  notInMaterial: z.array(z.string()).max(10).default([]),
})
export const flashcardsOutput = z.object({
  cards: z.array(z.object({ front: z.string().min(1).max(500), back: z.string().min(1).max(1500), example: z.string().max(500).optional().default('') })).max(40),
})
const genQuestion = z.object({
  type: z.enum(['mc', 'tf', 'text', 'numeric']),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.string()).max(6).optional(),
  correctIndex: z.number().int().optional(),
  correctBool: z.boolean().optional(),
  answer: z.string().max(2000).default(''),
  keywords: z.array(z.array(z.string())).max(6).optional(),
  explanation: z.string().max(2000).default(''),
  hints: z.array(z.string()).max(4).default([]),
  difficulty: z.number().int().min(1).max(4).optional(),
})
export const questionsOutput = z.object({ questions: z.array(genQuestion).max(30) })
export const gradeOutput = z.object({ score: z.union([z.literal(0), z.literal(0.5), z.literal(1)]), feedback: z.string().min(1).max(2000), misconception: z.string().max(1000).nullable().optional() })
export const explainOutput = z.object({ explanation: z.string().min(1).max(4000) })

export type GeneratedQuestion = z.infer<typeof genQuestion>

const JSON_RULE = 'Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt ohne Markdown-Codeblock und ohne Text davor oder danach.'

export function generatePrompt(r: GenerateRequest): { system: string; user: string } {
  const base = `Du hilfst einer Schülerin oder einem Schüler der Klasse ${r.grade}. Schreibe auf Deutsch, klar und fachlich korrekt. Erfinde nichts.`
  switch (r.task) {
    case 'summary':
      return {
        system: `${base} Du fasst Lernmaterial zusammen und verwendest dabei NUR Informationen aus dem Material. ${JSON_RULE}`,
        user: `Fasse das Material „${r.title}“ als Lernzusammenfassung zusammen (Markdown mit kurzen Überschriften und Stichpunkten, höchstens 250 Wörter). Nenne die wichtigsten Fachbegriffe. Falls das Material lückenhaft oder unklar ist, nenne das in "notInMaterial".\n\nJSON-Format: {"summary": string, "keyConcepts": string[], "notInMaterial": string[]}\n\n<material>\n${r.text}\n</material>`,
      }
    case 'flashcards':
      return {
        system: `${base} Du erstellst Karteikarten NUR aus Inhalten des Materials. ${JSON_RULE}`,
        user: `Erstelle bis zu ${r.count} Karteikarten zum Material „${r.title}“. Vorderseite: Begriff oder kurze Frage. Rückseite: kurze, korrekte Antwort aus dem Material. Optional ein Beispiel.\n\nJSON-Format: {"cards": [{"front": string, "back": string, "example": string}]}\n\n<material>\n${r.text}\n</material>`,
      }
    case 'questions':
      return {
        system: `${base} Du erstellst Übungsfragen NUR zu Inhalten des Materials. Jede Frage muss eindeutig beantwortbar sein. ${JSON_RULE}`,
        user: `Erstelle bis zu ${r.count} abwechslungsreiche Übungsfragen zum Material „${r.title}“${r.subject ? ` (Fach ${r.subject})` : ''}.
Typen: "mc" (4 Optionen, correctIndex 0-3), "tf" (correctBool), "text" (kurze Antwort; keywords = Liste von Gruppen gleichwertiger Schlüsselwörter, z. B. [["Licht","Sonne"],["Glucose","Zucker"]]), "numeric" (answer als Zahl mit Punkt als Dezimaltrenner).
Jede Frage braucht "explanation" (warum die Antwort stimmt) und 1-2 "hints", die nicht die Lösung verraten.

JSON-Format: {"questions": [{"type": "mc"|"tf"|"text"|"numeric", "prompt": string, "options"?: string[], "correctIndex"?: number, "correctBool"?: boolean, "answer": string, "keywords"?: string[][], "explanation": string, "hints": string[], "difficulty": 1-4}]}

<material>
${r.text}
</material>`,
      }
    case 'practice':
      return {
        system: `${base} Du erstellst Übungsaufgaben passend zum Lehrplan der Klassenstufe. ${JSON_RULE}`,
        user: `Erstelle ${r.count} Übungsaufgaben im Fach ${r.subject} zum Thema „${r.topic}“ (${r.description}). Schwierigkeit ${r.difficulty} von 4. Nur Aufgaben, deren Lösung du sicher kennst.
Typen: "mc", "tf", "text" (mit keywords), "numeric". Jede Aufgabe mit "explanation" und 1-2 "hints".

JSON-Format: {"questions": [{"type": "mc"|"tf"|"text"|"numeric", "prompt": string, "options"?: string[], "correctIndex"?: number, "correctBool"?: boolean, "answer": string, "keywords"?: string[][], "explanation": string, "hints": string[], "difficulty": 1-4}]}`,
      }
    case 'grade':
      return {
        system: `${base} Du bewertest eine Schülerantwort fair und ermutigend. Gleichwertige Formulierungen sind richtig. ${JSON_RULE}`,
        user: `Frage: ${r.question}\nMusterlösung: ${r.modelAnswer}\nAntwort des Schülers: ${r.studentAnswer}\n\nBewerte mit score 1 (richtig), 0.5 (teilweise richtig) oder 0 (falsch). Gib kurzes, freundliches Feedback: Was stimmt, was fehlt, und WARUM. Falls ein typischer Denkfehler erkennbar ist, beschreibe ihn in "misconception", sonst null.\n\nJSON-Format: {"score": 0|0.5|1, "feedback": string, "misconception": string|null}`,
      }
    case 'explain-mistake':
      return {
        system: `${base} ${EXPLANATION_MODES[r.mode].instruction} Sei freundlich und nie abwertend. ${JSON_RULE}`,
        user: `Aufgabe: ${r.question}\nRichtige Antwort: ${r.correctAnswer}\nAntwort des Schülers: ${r.studentAnswer}\n\nErkläre, warum die Antwort des Schülers nicht stimmt, welcher Denkfehler wahrscheinlich dahintersteckt und wie man richtig vorgeht. Wenn die Schülerantwort doch gleichwertig richtig ist, sag das ehrlich.\n\nJSON-Format: {"explanation": string}`,
      }
  }
}

export const OUTPUT_SCHEMAS = {
  summary: summaryOutput,
  flashcards: flashcardsOutput,
  questions: questionsOutput,
  practice: questionsOutput,
  grade: gradeOutput,
  'explain-mistake': explainOutput,
} as const

/** Extracts the first JSON object from model output (tolerates code fences or stray text). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Die KI hat kein gültiges JSON geliefert.')
  return JSON.parse(candidate.slice(start, end + 1))
}

export const OCR_PROMPT =
  'Schreibe den Text auf diesem Bild (Arbeitsblatt, Notizen oder Buchseite) möglichst wortgetreu ab. Behalte Überschriften und Aufzählungen bei. Formeln in LaTeX zwischen $…$. Unleserliche Stellen markierst du mit [unleserlich]. Erfinde nichts dazu und fasse nicht zusammen. Gib nur den abgeschriebenen Text aus.'

export interface AiStatusInfo {
  configured: boolean
  provider: string
  model: string | null
  supportsImages: boolean
  /** German explanation for the settings page */
  detail: string
}
