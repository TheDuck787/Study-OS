import type { BrowserContext } from '@playwright/test'

/** Simulated Supabase (Auth with Google PKCE redirect + PostgREST sync_records) for E2E tests. */
const SB = 'https://test-project.supabase.co'
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'finn@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Finn Test' }, created_at: '2026-10-25T10:00:00Z' }

export interface Row { user_id: string; table_name: string; record_id: string; data: unknown; deleted: boolean; updated_at: string; device_id?: string }
export class FakeSupabase {
  rows = new Map<string, Row>()
  authorizeUrls: string[] = []
  tokenExchanges = 0
  missingTable = false
  t = Date.now()
  live(table: string) {
    return [...this.rows.values()].filter((r) => r.table_name === table && !r.deleted)
  }
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const fakeJwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, role: 'authenticated', email: USER.email, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated' })}.c2lnbmF0dXJl`

export async function mockCloud(ctx: BrowserContext, fake: FakeSupabase, opts: { configured?: boolean } = {}) {
  await ctx.route('**/api/config', (r) => r.fulfill({ json: opts.configured === false ? { supabase: null, reason: 'Die Cloud-Synchronisierung ist auf dem Server nicht eingerichtet (SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY fehlen).' } : { supabase: { url: SB, publishableKey: 'sb_publishable_test' } } }))
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/auth/v1/authorize') {
      fake.authorizeUrls.push(url.toString())
      const back = new URL(url.searchParams.get('redirect_to')!)
      back.searchParams.set('code', 'test-auth-code')
      return route.fulfill({ status: 302, headers: { location: back.toString() } })
    }
    if (url.pathname === '/auth/v1/token') {
      fake.tokenExchanges++
      return route.fulfill({ headers: cors, json: { access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-test', user: USER } })
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers: cors, json: USER })
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/rest/v1/sync_records') {
      if (fake.missingTable) return route.fulfill({ status: 404, headers: cors, json: { code: 'PGRST205', message: "Could not find the table 'public.sync_records' in the schema cache" } })
      if (req.method() === 'GET') {
        const gt = url.searchParams.get('updated_at')?.replace(/^gt\./, '')
        const offset = Number(url.searchParams.get('offset') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 1000)
        const list = [...fake.rows.values()].filter((r) => !gt || r.updated_at > gt).sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        return route.fulfill({ headers: cors, json: list.slice(offset, offset + limit) })
      }
      if (req.method() === 'POST') {
        const body = JSON.parse(req.postData() ?? '[]') as Row[]
        const saved = (Array.isArray(body) ? body : [body]).map((r) => {
          if (r.user_id !== USER.id) throw new Error('RLS would reject')
          const row = { ...r, updated_at: new Date(++fake.t).toISOString() }
          fake.rows.set(`${r.table_name}/${r.record_id}`, row)
          return row
        })
        return route.fulfill({ status: 201, headers: cors, json: saved })
      }
      if (req.method() === 'DELETE') {
        fake.rows.clear()
        return route.fulfill({ status: 204, headers: cors })
      }
    }
    return route.fulfill({ status: 404, headers: cors, json: { message: `not mocked: ${url.pathname}` } })
  })
}

