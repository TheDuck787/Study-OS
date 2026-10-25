import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export interface ImageInput {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  base64: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmProvider {
  id: 'anthropic' | 'openai' | 'openai-compatible'
  label: string
  model: string
  supportsImages: boolean
  /** Streams text; resolves with the full answer. */
  stream(opts: { system: string; messages: ChatMessage[]; maxTokens: number; onText: (delta: string) => void; signal?: AbortSignal; effort?: 'low' | 'medium' | 'high' }): Promise<string>
  complete(opts: { system: string; user: string; maxTokens: number; images?: ImageInput[]; signal?: AbortSignal; effort?: 'low' | 'medium' | 'high' }): Promise<string>
}

/** Errors with a German message that is safe to show to the student. */
export class ProviderError extends Error {
  constructor(public code: 'auth' | 'rate_limit' | 'connection' | 'refusal' | 'bad_request' | 'unavailable' | 'unknown', message: string, public status = 502) {
    super(message)
  }
}

// Models for which the server-side refusal fallback ("fallbacks": "default") is documented.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5-5'])

function mapAnthropicError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e
  if (e instanceof Anthropic.AuthenticationError) return new ProviderError('auth', 'Der Anthropic-API-Schlüssel ist ungültig oder abgelaufen.', 401)
  if (e instanceof Anthropic.PermissionDeniedError) return new ProviderError('auth', 'Der API-Schlüssel hat keine Berechtigung für dieses Modell.', 403)
  if (e instanceof Anthropic.NotFoundError) return new ProviderError('bad_request', 'Das eingestellte Modell wurde nicht gefunden. Prüfe ANTHROPIC_MODEL.', 400)
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('rate_limit', 'Zu viele Anfragen oder Guthaben aufgebraucht. Bitte später erneut versuchen.', 429)
  if (e instanceof Anthropic.BadRequestError) return new ProviderError('bad_request', `Die Anfrage wurde abgelehnt: ${e.message}`, 400)
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError('connection', 'Keine Verbindung zu Anthropic. Ist der Server online?', 503)
  if (e instanceof Anthropic.APIError) return new ProviderError('unknown', `Fehler beim KI-Anbieter (${e.status ?? '?'}).`, 502)
  return new ProviderError('unknown', e instanceof Error ? e.message : String(e))
}

export function createAnthropicProvider(apiKey: string, model: string, opts: { baseURL?: string; fallbacks: boolean }): LlmProvider {
  const client = new Anthropic({ apiKey, ...(opts.baseURL ? { baseURL: opts.baseURL } : {}) })
  const useFallbacks = opts.fallbacks && FALLBACK_MODELS.has(model) && !opts.baseURL
  const extra = useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}

  const run = async (system: string, messages: Anthropic.Beta.BetaMessageParam[], maxTokens: number, effort: 'low' | 'medium' | 'high', onText?: (d: string) => void, signal?: AbortSignal) => {
    try {
      const stream = client.beta.messages.stream({ model, max_tokens: maxTokens, system, messages, output_config: { effort }, ...extra }, { signal })
      if (onText) stream.on('text', (delta) => onText(delta))
      const msg = await stream.finalMessage()
      if (msg.stop_reason === 'refusal') throw new ProviderError('refusal', 'Die KI hat diese Anfrage aus Sicherheitsgründen abgelehnt. Formuliere die Frage anders.', 422)
      const text = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('')
      if (msg.stop_reason === 'max_tokens') return text + '\n\n_(Antwort wurde wegen Längenbegrenzung abgeschnitten.)_'
      return text
    } catch (e) {
      throw mapAnthropicError(e)
    }
  }

  return {
    id: 'anthropic',
    label: 'Anthropic Claude',
    model,
    supportsImages: true,
    stream: ({ system, messages, maxTokens, onText, signal, effort = 'medium' }) => run(system, messages, maxTokens, effort, onText, signal),
    complete: ({ system, user, maxTokens, images, signal, effort = 'medium' }) => {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...(images ?? []).map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 } })),
        { type: 'text' as const, text: user },
      ]
      return run(system, [{ role: 'user', content }], maxTokens, effort, undefined, signal)
    },
  }
}

function mapOpenAiError(e: unknown, label: string): ProviderError {
  if (e instanceof ProviderError) return e
  if (e instanceof OpenAI.AuthenticationError) return new ProviderError('auth', `Der API-Schlüssel für ${label} ist ungültig.`, 401)
  if (e instanceof OpenAI.NotFoundError) return new ProviderError('bad_request', 'Das eingestellte Modell wurde nicht gefunden. Prüfe OPENAI_MODEL.', 400)
  if (e instanceof OpenAI.RateLimitError) return new ProviderError('rate_limit', 'Zu viele Anfragen oder Guthaben aufgebraucht.', 429)
  if (e instanceof OpenAI.BadRequestError) return new ProviderError('bad_request', `Die Anfrage wurde abgelehnt: ${e.message}`, 400)
  if (e instanceof OpenAI.APIConnectionError) return new ProviderError('connection', `Keine Verbindung zu ${label}. Läuft der Dienst?`, 503)
  if (e instanceof OpenAI.APIError) return new ProviderError('unknown', `Fehler beim KI-Anbieter (${e.status ?? '?'}).`, 502)
  return new ProviderError('unknown', e instanceof Error ? e.message : String(e))
}

export function createOpenAiProvider(apiKey: string, model: string, opts: { baseURL?: string; compatible: boolean; supportsImages: boolean }): LlmProvider {
  const client = new OpenAI({ apiKey, ...(opts.baseURL ? { baseURL: opts.baseURL } : {}) })
  const label = opts.compatible ? 'dem OpenAI-kompatiblen Dienst' : 'OpenAI'
  return {
    id: opts.compatible ? 'openai-compatible' : 'openai',
    label: opts.compatible ? 'OpenAI-kompatibel' : 'OpenAI',
    model,
    supportsImages: opts.supportsImages,
    async stream({ system, messages, onText, signal }) {
      try {
        const stream = await client.chat.completions.create({ model, stream: true, messages: [{ role: 'system', content: system }, ...messages] }, { signal })
        let text = ''
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            text += delta
            onText(delta)
          }
        }
        return text
      } catch (e) {
        throw mapOpenAiError(e, label)
      }
    },
    async complete({ system, user, images, signal }) {
      try {
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
          ...(images ?? []).map((img) => ({ type: 'image_url' as const, image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })),
          { type: 'text' as const, text: user },
        ]
        const res = await client.chat.completions.create({ model, messages: [{ role: 'system', content: system }, { role: 'user', content }] }, { signal })
        return res.choices[0]?.message?.content ?? ''
      } catch (e) {
        throw mapOpenAiError(e, label)
      }
    },
  }
}

export interface ProviderConfig {
  provider: LlmProvider | null
  detail: string
}

/**
 * Reads the provider from environment variables. Keys never leave the server.
 * AI_PROVIDER = auto | anthropic | openai | openai-compatible | none
 */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const choice = (env.AI_PROVIDER ?? 'auto').toLowerCase()
  if (choice === 'none') return { provider: null, detail: 'KI ist auf dem Server ausgeschaltet (AI_PROVIDER=none).' }
  const wantAnthropic = choice === 'anthropic' || (choice === 'auto' && !!env.ANTHROPIC_API_KEY)
  if (wantAnthropic) {
    if (!env.ANTHROPIC_API_KEY) return { provider: null, detail: 'AI_PROVIDER=anthropic, aber ANTHROPIC_API_KEY ist nicht gesetzt.' }
    const model = env.ANTHROPIC_MODEL || 'claude-opus-5-5'
    return {
      provider: createAnthropicProvider(env.ANTHROPIC_API_KEY, model, { baseURL: env.STUDYOS_ANTHROPIC_BASE_URL || undefined, fallbacks: env.ANTHROPIC_FALLBACKS !== 'off' }),
      detail: `Anthropic mit Modell ${model}.`,
    }
  }
  const wantOpenAi = choice === 'openai' || choice === 'openai-compatible' || (choice === 'auto' && !!env.OPENAI_API_KEY)
  if (wantOpenAi) {
    const compatible = choice === 'openai-compatible' || !!env.OPENAI_BASE_URL
    const key = env.OPENAI_API_KEY || (compatible ? 'not-needed' : '')
    if (!key) return { provider: null, detail: 'AI_PROVIDER=openai, aber OPENAI_API_KEY ist nicht gesetzt.' }
    if (!env.OPENAI_MODEL) return { provider: null, detail: 'OPENAI_MODEL ist nicht gesetzt. Trage den genauen Modellnamen deines Anbieters ein (Study OS rät keine Modellnamen).' }
    return {
      provider: createOpenAiProvider(key, env.OPENAI_MODEL, { baseURL: env.OPENAI_BASE_URL || undefined, compatible, supportsImages: env.OPENAI_SUPPORTS_IMAGES === 'true' }),
      detail: `${compatible ? `OpenAI-kompatibler Dienst (${env.OPENAI_BASE_URL})` : 'OpenAI'} mit Modell ${env.OPENAI_MODEL}.`,
    }
  }
  return { provider: null, detail: 'Kein KI-Anbieter konfiguriert. Setze ANTHROPIC_API_KEY oder OPENAI_API_KEY in der Datei .env auf dem Server.' }
}
