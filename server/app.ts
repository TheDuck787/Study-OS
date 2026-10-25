import { Hono, type Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { bodyLimit } from 'hono/body-limit'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { providerFromEnv, ProviderError, type ImageInput, type LlmProvider } from './providers.js'
import { publicConfig } from './publicConfig.js'
import { tutorRequestSchema, tutorSystemPrompt, generateRequestSchema, generatePrompt, OUTPUT_SCHEMAS, extractJson, OCR_PROMPT, type AiStatusInfo } from '../src/shared/ai.js'

/**
 * The Study OS API (AI proxy). Shared by two hosts:
 * - Vercel: api/index.ts exports this app as a serverless function.
 * - Self-hosting: server/index.ts serves it together with the built web app.
 * API keys are read from server-side environment variables only.
 */
export interface AppOptions {
  env?: NodeJS.ProcessEnv
  /** Inject a provider (tests). */
  provider?: LlmProvider | null
}

// Vercel's request body limit for functions is 4.5 MB – stay below it.
const MAX_JSON_BODY = 600 * 1024
const MAX_OCR_BODY = 4 * 1024 * 1024

export function createApp(opts: AppOptions = {}) {
  const env = opts.env ?? process.env
  const fromEnv = opts.provider === undefined ? providerFromEnv(env) : { provider: opts.provider, detail: opts.provider ? `Test-Anbieter ${opts.provider.label}` : 'Kein KI-Anbieter (Test).' }
  const provider = fromEnv.provider
  const ACCESS_TOKEN = env.APP_ACCESS_TOKEN ?? ''
  const RATE_PER_MIN = Number(env.AI_RATE_LIMIT_PER_MIN ?? 20)
  const ALLOWED_ORIGINS = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  // A public deployment with an API key but no access code would let anyone spend the owner's credits.
  const PUBLIC_HOST = !!env.VERCEL || env.STUDYOS_PUBLIC === 'true'
  const lockedOpen = PUBLIC_HOST && !!provider && !ACCESS_TOKEN
  const detail = lockedOpen
    ? 'Ein KI-Schlüssel ist gesetzt, aber APP_ACCESS_TOKEN fehlt. Auf einer öffentlichen Website ist das aus Sicherheitsgründen gesperrt – lege in Vercel die Variable APP_ACCESS_TOKEN an und deploye neu.'
    : fromEnv.detail

  const app = new Hono()

  app.use('*', async (c, next) => {
    await next()
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('Referrer-Policy', 'no-referrer')
    c.header('Cache-Control', 'no-store')
  })

  // Optional CORS for a frontend hosted on another origin (off by default).
  app.use('/api/*', async (c, next) => {
    const origin = c.req.header('origin')
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Vary', 'Origin')
      c.header('Access-Control-Allow-Headers', 'content-type, x-studyos-token')
      c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      if (c.req.method === 'OPTIONS') return c.body(null, 204)
    }
    await next()
  })

  const tokenOk = (c: Context): boolean => {
    if (!ACCESS_TOKEN) return true
    const got = Buffer.from(c.req.header('x-studyos-token') ?? '')
    const want = Buffer.from(ACCESS_TOKEN)
    return got.length === want.length && timingSafeEqual(got, want)
  }

  // Best-effort limit per IP and instance (serverless instances do not share memory).
  const hits = new Map<string, { n: number; reset: number }>()
  const rateOk = (c: Context): boolean => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local'
    const now = Date.now()
    const h = hits.get(ip)
    if (!h || h.reset < now) {
      hits.set(ip, { n: 1, reset: now + 60_000 })
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      return true
    }
    h.n++
    return h.n <= RATE_PER_MIN
  }

  app.get('/api/health', (c) => c.json({ ok: true }))

  // Public browser config (Supabase URL + publishable key). Never contains secrets – see publicConfig.ts.
  const cfg = publicConfig(env)
  app.get('/api/config', (c) => c.json(cfg))

  // Status is readable without the access code so the app can say *why* AI is unavailable.
  app.get('/api/ai/status', (c) => {
    const authorized = tokenOk(c)
    const info: AiStatusInfo = {
      configured: !!provider && !lockedOpen && authorized,
      provider: provider?.label ?? 'none',
      model: authorized ? (provider?.model ?? null) : null,
      supportsImages: provider?.supportsImages ?? false,
      detail: lockedOpen ? detail : !authorized ? 'Der Server verlangt einen Zugangscode. Trage ihn unter Einstellungen → KI-Anbieter ein.' : detail,
    }
    return c.json({ ...info, accessTokenRequired: !!ACCESS_TOKEN, authorized })
  })

  app.use('/api/ai/*', async (c, next) => {
    if (c.req.path === '/api/ai/status') return next()
    if (lockedOpen) return c.json({ error: detail, code: 'unavailable' }, 503)
    if (!tokenOk(c)) return c.json({ error: 'Zugangscode fehlt oder ist falsch. Trage ihn unter Einstellungen → KI-Anbieter ein.', code: 'forbidden' }, 403)
    if (!rateOk(c)) return c.json({ error: 'Zu viele KI-Anfragen. Bitte eine Minute warten.', code: 'rate_limit' }, 429)
    await next()
  })

  const errorResponse = (c: Context, e: unknown) => {
    if (e instanceof ProviderError) return c.json({ error: e.message, code: e.code }, e.status as 400)
    if (e instanceof z.ZodError) return c.json({ error: 'Ungültige Anfrage.', code: 'bad_request', issues: e.issues.slice(0, 3) }, 400)
    console.error(e)
    return c.json({ error: 'Unerwarteter Serverfehler.', code: 'unknown' }, 500)
  }

  app.post('/api/ai/test', async (c) => {
    if (!provider) return c.json({ ok: false, error: detail }, 503)
    const t0 = Date.now()
    try {
      const text = await provider.complete({ system: 'Antworte knapp.', user: 'Antworte nur mit dem Wort OK.', maxTokens: 50, effort: 'low' })
      return c.json({ ok: true, latencyMs: Date.now() - t0, sample: text.slice(0, 40) })
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  app.post('/api/ai/tutor', bodyLimit({ maxSize: MAX_JSON_BODY }), async (c) => {
    if (!provider) return c.json({ error: detail, code: 'unavailable' }, 503)
    let req
    try {
      req = tutorRequestSchema.parse(await c.req.json())
    } catch (e) {
      return errorResponse(c, e)
    }
    const system = tutorSystemPrompt(req)
    return streamSSE(c, async (stream) => {
      const ctrl = new AbortController()
      stream.onAbort(() => ctrl.abort())
      try {
        const text = await provider.stream({
          system, messages: req.messages, maxTokens: req.mode === 'detailed' ? 6000 : 3000, signal: ctrl.signal,
          onText: (delta) => void stream.writeSSE({ event: 'text', data: JSON.stringify({ delta }) }),
        })
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ text, provider: provider.label, model: provider.model }) })
      } catch (e) {
        const msg = e instanceof ProviderError ? e.message : 'Unerwarteter Fehler bei der KI-Anfrage.'
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: msg }) })
      }
    })
  })

  app.post('/api/ai/generate', bodyLimit({ maxSize: MAX_JSON_BODY }), async (c) => {
    if (!provider) return c.json({ error: detail, code: 'unavailable' }, 503)
    try {
      const req = generateRequestSchema.parse(await c.req.json())
      const { system, user } = generatePrompt(req)
      const text = await provider.complete({ system, user, maxTokens: 8000, effort: req.task === 'grade' ? 'low' : 'medium' })
      const parsed = OUTPUT_SCHEMAS[req.task].safeParse(extractJson(text))
      if (!parsed.success) return c.json({ error: 'Die KI-Antwort hatte ein unerwartetes Format. Bitte erneut versuchen.', code: 'bad_output' }, 502)
      return c.json({ result: parsed.data, provider: provider.label, model: provider.model })
    } catch (e) {
      if (e instanceof SyntaxError || (e instanceof Error && e.message.includes('JSON'))) return c.json({ error: 'Die KI-Antwort war kein gültiges JSON. Bitte erneut versuchen.', code: 'bad_output' }, 502)
      return errorResponse(c, e)
    }
  })

  const ocrSchema = z.object({ images: z.array(z.object({ mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']), base64: z.string().min(10) })).min(1).max(5) })

  app.post('/api/ai/ocr', bodyLimit({ maxSize: MAX_OCR_BODY, onError: (c) => c.json({ error: 'Die Bilder sind zu groß (höchstens 4 MB pro Anfrage). Wähle weniger Seiten.', code: 'too_large' }, 413) }), async (c) => {
    if (!provider) return c.json({ error: detail, code: 'unavailable' }, 503)
    if (!provider.supportsImages) return c.json({ error: 'Der eingestellte KI-Anbieter kann keine Bilder lesen.', code: 'unsupported' }, 400)
    try {
      const { images } = ocrSchema.parse(await c.req.json())
      const text = await provider.complete({ system: 'Du bist ein sorgfältiger Abschreiber.', user: OCR_PROMPT, maxTokens: 8000, images: images as ImageInput[] })
      return c.json({ text, provider: provider.label, model: provider.model })
    } catch (e) {
      return errorResponse(c, e)
    }
  })

  app.all('/api/*', (c) => c.json({ error: 'Nicht gefunden.' }, 404))

  return { app, provider, detail, accessTokenSet: !!ACCESS_TOKEN, lockedOpen }
}
