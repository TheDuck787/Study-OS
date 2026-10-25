import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../../server/app'
import type { LlmProvider } from '../../server/providers'
import vercelHandler from '../../api/index'

const fakeProvider = (): LlmProvider => ({
  id: 'anthropic',
  label: 'Test',
  model: 'test-model',
  supportsImages: true,
  stream: vi.fn(async ({ onText }) => {
    onText('Hal')
    onText('lo')
    return 'Hallo'
  }),
  complete: vi.fn(async () => 'OK'),
})

const json = (body: unknown, token?: string) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-studyos-token': token } : {}) },
  body: JSON.stringify(body),
})

describe('Study OS API', () => {
  it('reports health and 404 for unknown API routes', async () => {
    const { app } = createApp({ env: {}, provider: null })
    expect((await app.request('/api/health')).status).toBe(200)
    const res = await app.request('/api/gibt-es-nicht')
    expect(res.status).toBe(404)
  })

  it('works without AI: status says not configured, AI routes answer 503', async () => {
    const { app } = createApp({ env: {}, provider: null })
    const st = await (await app.request('/api/ai/status')).json()
    expect(st.configured).toBe(false)
    expect((await app.request('/api/ai/test', { method: 'POST' })).status).toBe(503)
  })

  it('locks AI on Vercel when a key is set but no access code', async () => {
    const provider = fakeProvider()
    const { app, lockedOpen } = createApp({ env: { VERCEL: '1' }, provider })
    expect(lockedOpen).toBe(true)
    const st = await (await app.request('/api/ai/status')).json()
    expect(st.configured).toBe(false)
    expect(st.detail).toContain('APP_ACCESS_TOKEN')
    const res = await app.request('/api/ai/test', { method: 'POST' })
    expect(res.status).toBe(503)
    expect(provider.complete).not.toHaveBeenCalled()
  })

  it('requires the access code and never reveals the key', async () => {
    const provider = fakeProvider()
    const { app } = createApp({ env: { VERCEL: '1', APP_ACCESS_TOKEN: 'geheim-1234567890' }, provider })
    const anon = await (await app.request('/api/ai/status')).json()
    expect(anon).toMatchObject({ configured: false, authorized: false, accessTokenRequired: true, model: null })
    expect((await app.request('/api/ai/test', { method: 'POST' })).status).toBe(403)
    expect((await app.request('/api/ai/test', { method: 'POST', headers: { 'x-studyos-token': 'falsch' } })).status).toBe(403)

    const ok = await (await app.request('/api/ai/status', { headers: { 'x-studyos-token': 'geheim-1234567890' } })).json()
    expect(ok).toMatchObject({ configured: true, authorized: true, model: 'test-model' })
    const test = await app.request('/api/ai/test', { method: 'POST', headers: { 'x-studyos-token': 'geheim-1234567890' } })
    expect(test.status).toBe(200)
    expect(JSON.stringify(ok)).not.toContain('geheim')
  })

  it('validates requests and streams tutor answers as SSE', async () => {
    const { app } = createApp({ env: {}, provider: fakeProvider() })
    expect((await app.request('/api/ai/tutor', json({ messages: 'kaputt' }))).status).toBe(400)
    expect((await app.request('/api/ai/generate', json({ task: 'gibt-es-nicht' }))).status).toBe(400)
    const res = await app.request('/api/ai/tutor', json({ mode: 'simple', student: { grade: 9, schoolType: 'Gesamtschule', region: 'MV' }, subject: 'Mathe', topic: null, materials: [], messages: [{ role: 'user', content: 'Was ist ein Bruch?' }] }))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('event: text')
    expect(text).toContain('event: done')
  })

  it('rate-limits AI requests per client', async () => {
    const { app } = createApp({ env: { AI_RATE_LIMIT_PER_MIN: '2' }, provider: fakeProvider() })
    const call = () => app.request('/api/ai/test', { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' } })
    expect((await call()).status).toBe(200)
    expect((await call()).status).toBe(200)
    expect((await call()).status).toBe(429)
  })
})

describe('Vercel function entry', () => {
  it('restores the original path after the vercel.json rewrite', async () => {
    const res = await vercelHandler.fetch(new Request('https://study.example/api?__path=health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('also handles requests that keep their original path', async () => {
    const res = await vercelHandler.fetch(new Request('https://study.example/api/ai/status?__path=ai/status'))
    expect(res.status).toBe(200)
    expect((await res.json()).configured).toBeDefined()
  })

  it('handles nested paths', async () => {
    const res = await vercelHandler.fetch(new Request('https://study.example/api?__path=ai%2Fstatus'))
    expect(res.status).toBe(200)
  })
})
