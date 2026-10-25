import { describe, expect, it } from 'vitest'
import { isPublishableKey, isSecretKey, publicConfig } from '../../server/publicConfig'
import { createApp } from '../../server/app'

describe('public config never exposes secrets', () => {
  it('/api/config returns only URL and publishable key', async () => {
    const { app } = createApp({ env: { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_never' }, provider: null })
    const body = await (await app.request('/api/config')).text()
    expect(JSON.parse(body)).toEqual({ supabase: { url: 'https://p.supabase.co', publishableKey: 'sb_publishable_x' } })
    expect(body).not.toContain('sb_secret')
  })

  const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, ref: 'x' })).toString('base64url')}.c2lnbmF0dXJlLXNpZ25hdHVyZQ`
  it('accepts publishable and anon keys, refuses secret and service-role keys', () => {
    expect(isPublishableKey('sb_publishable_abc')).toBe(true)
    expect(isPublishableKey(jwt('anon'))).toBe(true)
    expect(isSecretKey('sb_secret_abc')).toBe(true)
    expect(isSecretKey(jwt('service_role'))).toBe(true)
    expect(publicConfig({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toEqual({ supabase: { url: 'https://p.supabase.co', publishableKey: 'sb_publishable_x' } })
    expect(publicConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://p.supabase.co/', NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') }).supabase?.url).toBe('https://p.supabase.co')
    const bad = publicConfig({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_ANON_KEY: jwt('service_role') })
    expect(bad.supabase).toBeNull()
    expect(bad.reason).toMatch(/geheimer/)
    expect(publicConfig({ SUPABASE_URL: 'https://p.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_123' }).supabase).toBeNull()
    expect(publicConfig({}).supabase).toBeNull()
  })
})
