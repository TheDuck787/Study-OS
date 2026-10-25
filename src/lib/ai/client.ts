import { OUTPUT_SCHEMAS, extractJson, type AiStatusInfo, type GenerateRequest, type TutorRequest } from '@/shared/ai'
import type { z } from 'zod'

/**
 * Browser side of the AI provider abstraction.
 * - "server": the Study OS API (Vercel Function or self-hosted server) holds the API key –
 *   the browser never sees it and only sends the student's request.
 * - "none": everything that needs AI is disabled and clearly labelled.
 */
export type AiChoice = 'auto' | 'server' | 'none'

export interface AiSettings {
  choice: AiChoice
  serverUrl: string // '' = same origin (normal case on Vercel and with `npm start`)
  accessToken: string
}

const KEY = 'studyos.ai'
export function loadAiSettings(): AiSettings {
  const fallback: AiSettings = { choice: 'auto', serverUrl: '', accessToken: '' }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const s = { ...fallback, ...JSON.parse(raw) } as AiSettings
    // settings from the former claude.ai version used a choice that no longer exists
    if (!['auto', 'server', 'none'].includes(s.choice)) s.choice = 'auto'
    return s
  } catch {
    return fallback
  }
}
export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
  cached = null
}

export interface AiAvailability {
  kind: 'server' | 'none'
  ok: boolean
  label: string
  model: string | null
  supportsImages: boolean
  detail: string
}

export class AiError extends Error {
  constructor(message: string, public code = 'unknown') {
    super(message)
  }
}

const apiUrl = (s: AiSettings, path: string) => `${s.serverUrl.replace(/\/$/, '')}${path}`
const headers = (s: AiSettings) => ({ 'content-type': 'application/json', ...(s.accessToken ? { 'x-studyos-token': s.accessToken } : {}) })

export type ServerStatus = AiStatusInfo & { reachable: boolean; accessTokenRequired?: boolean; authorized?: boolean }

export async function serverStatus(s = loadAiSettings()): Promise<ServerStatus | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(apiUrl(s, '/api/ai/status'), { headers: headers(s), signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null
    return { ...(await res.json()), reachable: true }
  } catch {
    return null
  }
}

let cached: Promise<AiAvailability> | null = null

/** Detects whether the AI proxy is usable right now (cached until settings change). */
export function detectAi(force = false): Promise<AiAvailability> {
  if (!cached || force) cached = detect()
  return cached
}

async function detect(): Promise<AiAvailability> {
  const s = loadAiSettings()
  const none = (detail: string): AiAvailability => ({ kind: 'none', ok: false, label: 'Keine KI', model: null, supportsImages: false, detail })
  if (s.choice === 'none') return none('KI ist in den Einstellungen ausgeschaltet. Alle Kernfunktionen funktionieren trotzdem.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return none('Du bist offline. Der Tutor braucht eine Internetverbindung; alles andere funktioniert auch offline.')
  const st = await serverStatus(s)
  if (st?.configured) return { kind: 'server', ok: true, label: st.provider, model: st.model, supportsImages: st.supportsImages, detail: `Über die Study-OS-API: ${st.detail}` }
  if (st) return none(st.detail)
  return none('Kein KI-Anbieter verfügbar: Die Study-OS-API ist nicht erreichbar oder hat keinen API-Schlüssel. Alle Lernfunktionen ohne KI funktionieren trotzdem.')
}

async function readSse(res: Response, onText: (full: string) => void): Promise<string> {
  if (!res.body) throw new AiError('Keine Antwort vom Server.')
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let full = ''
  let finalText: string | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n')
    let idx: number
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const event = /^event: (.*)$/m.exec(block)?.[1]
      const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n')
      if (!data) continue
      const payload = JSON.parse(data)
      if (event === 'text') {
        full += payload.delta
        onText(full)
      } else if (event === 'done') finalText = payload.text
      else if (event === 'error') throw new AiError(payload.error)
    }
  }
  return finalText ?? full
}

async function serverError(res: Response): Promise<AiError> {
  try {
    const j = await res.json()
    return new AiError(j.error ?? `Serverfehler ${res.status}`, j.code)
  } catch {
    return new AiError(res.status === 413 ? 'Die Anfrage ist zu groß.' : `Serverfehler ${res.status}`)
  }
}

/** Streams a tutor answer. `onText` receives the whole answer so far. */
export async function tutorChat(req: TutorRequest, onText: (full: string) => void, signal?: AbortSignal): Promise<{ text: string; provider: string }> {
  const ai = await detectAi()
  if (!ai.ok) throw new AiError(ai.detail, 'unavailable')
  const s = loadAiSettings()
  const res = await fetch(apiUrl(s, '/api/ai/tutor'), { method: 'POST', headers: headers(s), body: JSON.stringify(req), signal })
  if (!res.ok) throw await serverError(res)
  const text = await readSse(res, onText)
  return { text, provider: `${ai.label}${ai.model ? ` (${ai.model})` : ''}` }
}

type OutputOf<T extends GenerateRequest['task']> = z.infer<(typeof OUTPUT_SCHEMAS)[T]>

/** Structured generation (summaries, flashcards, questions, grading). Output is always schema-validated. */
export async function generate<R extends GenerateRequest>(req: R, signal?: AbortSignal): Promise<{ result: OutputOf<R['task']>; provider: string }> {
  const ai = await detectAi()
  if (!ai.ok) throw new AiError(ai.detail, 'unavailable')
  const schema = OUTPUT_SCHEMAS[req.task]
  const s = loadAiSettings()
  const res = await fetch(apiUrl(s, '/api/ai/generate'), { method: 'POST', headers: headers(s), body: JSON.stringify(req), signal })
  if (!res.ok) throw await serverError(res)
  const j = await res.json()
  const parsed = schema.safeParse(j.result)
  if (!parsed.success) throw new AiError('Die KI-Antwort hatte ein unerwartetes Format.', 'bad_output')
  return { result: parsed.data as OutputOf<R['task']>, provider: `${j.provider} (${j.model})` }
}

/** Max total upload for vision requests – the hosting platform rejects bodies above ~4.5 MB. */
const MAX_IMAGE_SIDE = 2000
const MAX_TOTAL_BASE64 = 3_500_000

/** Scales a photo down (keeps text readable) and re-encodes it as JPEG to keep the upload small. */
async function shrinkImage(b: Blob, maxSide: number, quality: number): Promise<{ mediaType: 'image/jpeg' | 'image/png'; base64: string }> {
  const bitmap = await createImageBitmap(b)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AiError('Bild konnte nicht verarbeitet werden.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { mediaType: 'image/jpeg', base64: dataUrl.split(',')[1] ?? '' }
}

export async function prepareImages(images: Blob[]): Promise<{ mediaType: 'image/jpeg' | 'image/png'; base64: string }[]> {
  let side = MAX_IMAGE_SIDE
  let quality = 0.85
  for (let attempt = 0; attempt < 4; attempt++) {
    const out = await Promise.all(images.map((b) => shrinkImage(b, side, quality)))
    if (out.reduce((s, x) => s + x.base64.length, 0) <= MAX_TOTAL_BASE64) return out
    side = Math.round(side * 0.75)
    quality = Math.max(0.6, quality - 0.1)
  }
  throw new AiError('Die Bilder sind zu groß. Wähle weniger Seiten auf einmal.', 'too_large')
}

/** Transcribes images (worksheets, scanned pages) with a vision-capable model via the API. */
export async function aiTranscribe(images: Blob[], signal?: AbortSignal): Promise<{ text: string; provider: string }> {
  const ai = await detectAi()
  if (!ai.ok) throw new AiError(ai.detail, 'unavailable')
  if (!ai.supportsImages) throw new AiError('Der aktuelle KI-Anbieter kann keine Bilder lesen. Nutze die Texterkennung (OCR) ohne KI.', 'unsupported')
  const s = loadAiSettings()
  const payload = { images: await prepareImages(images) }
  const res = await fetch(apiUrl(s, '/api/ai/ocr'), { method: 'POST', headers: headers(s), body: JSON.stringify(payload), signal })
  if (!res.ok) throw await serverError(res)
  const j = await res.json()
  return { text: j.text, provider: `${j.provider} (${j.model})` }
}

export async function testServer(): Promise<{ ok: boolean; message: string }> {
  const s = loadAiSettings()
  try {
    const res = await fetch(apiUrl(s, '/api/ai/test'), { method: 'POST', headers: headers(s) })
    const j = await res.json().catch(() => ({}))
    if (res.ok && j.ok) return { ok: true, message: `Funktioniert (Antwortzeit ${j.latencyMs} ms).` }
    return { ok: false, message: j.error ?? `Fehler ${res.status}` }
  } catch {
    return { ok: false, message: 'Server nicht erreichbar.' }
  }
}

export { extractJson }
