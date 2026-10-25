import { expect, test, type Page } from '@playwright/test'
import { onboard } from './helpers'
import { FakeSupabase, mockCloud } from './cloud-mock'

/**
 * End-to-end test of Google sign-in + sync against a simulated Supabase (Auth + PostgREST).
 * The real app code runs unchanged: PKCE redirect, code exchange, session storage, REST upserts.
 * It does NOT test the real Google/Supabase configuration – that needs the manual steps in STATUS.md.
 */
const settings = async (page: Page) => {
  await page.goto('/#/einstellungen')
  await expect(page.getByRole('heading', { name: 'Konto & Synchronisierung' })).toBeVisible()
}

test.describe('Google-Anmeldung & Synchronisierung (simuliertes Supabase)', () => {
  test('PC: sign in, decide on first login, upload; phone: sign in, data arrives; changes sync both ways; sign out keeps data', async ({ browser, baseURL }) => {
    const fake = new FakeSupabase()
    // ── PC with existing local data ──
    const pcCtx = await browser.newContext({ baseURL })
    await mockCloud(pcCtx, fake)
    const pc = await pcCtx.newPage()
    await onboard(pc, 'Finn', false)
    await pc.goto('/#/aufgaben')
    await pc.getByLabel('Neue Aufgabe').fill('Referat Bio vorbereiten')
    await pc.getByLabel('Neue Aufgabe').press('Enter')
    await expect(pc.getByText('Referat Bio vorbereiten')).toBeVisible()
    await settings(pc)
    await pc.getByRole('button', { name: 'Mit Google anmelden' }).click()
    // redirect to Google (simulated) and back with ?code= → PKCE exchange
    await expect(pc.getByRole('heading', { name: 'Daten mit deinem Konto verbinden' })).toBeVisible()
    const authorize = new URL(fake.authorizeUrls[0])
    expect(authorize.searchParams.get('provider')).toBe('google')
    expect(authorize.searchParams.get('code_challenge_method')?.toLowerCase()).toBe('s256')
    expect(authorize.searchParams.get('redirect_to')).toBe(`${baseURL}/`)
    expect(fake.tokenExchanges).toBe(1)
    expect(pc.url()).not.toContain('code=') // address bar cleaned
    expect(pc.url()).toContain('#/einstellungen') // back where the sign-in started …
    await expect(pc.getByRole('heading', { name: 'Konto & Synchronisierung' })).toBeVisible() // … and the page really shows it
    await pc.getByRole('button', { name: 'Hochladen' }).click()
    await expect(pc.getByText(/Synchronisiert/).first()).toBeVisible()
    expect(fake.live('tasks').map((r) => (r.data as { title: string }).title)).toEqual(['Referat Bio vorbereiten'])
    expect(fake.live('profile')).toHaveLength(1)
    expect(fake.live('subjects').length).toBeGreaterThan(0)
    await expect(pc.getByRole('main').getByText('Finn Test')).toBeVisible()

    // ── Phone: empty, signs in from the onboarding screen ──
    const phoneCtx = await browser.newContext({ baseURL })
    await mockCloud(phoneCtx, fake)
    const phone = await phoneCtx.newPage()
    await phone.goto('/')
    await expect(phone.getByText('Schon auf einem anderen Gerät eingerichtet?')).toBeVisible()
    await phone.getByRole('button', { name: 'Mit Google anmelden' }).click()
    await expect(phone.getByRole('heading', { name: /Was soll ich heute lernen/ })).toBeVisible({ timeout: 20_000 })
    await phone.goto('/#/aufgaben') // quick-add default is "due tomorrow" → tab "Heute & morgen"
    await expect(phone.getByText('Referat Bio vorbereiten')).toBeVisible()

    // phone completes the task → PC sees it
    await phone.getByRole('checkbox', { name: '„Referat Bio vorbereiten“ erledigt' }).click()
    await settings(phone)
    await phone.getByRole('button', { name: 'Jetzt synchronisieren' }).click()
    await expect.poll(() => (fake.live('tasks')[0]?.data as { status?: string })?.status).toBe('done')
    await pc.getByRole('button', { name: 'Jetzt synchronisieren' }).click()
    await expect(pc.getByText(/Synchronisiert/).first()).toBeVisible()
    await pc.goto('/#/aufgaben')
    await pc.getByRole('tab', { name: /Erledigt/ }).click()
    await expect(pc.getByText('Referat Bio vorbereiten')).toBeVisible()

    // reload keeps the session
    await pc.reload()
    await settings(pc)
    await expect(pc.getByRole('main').getByText('Finn Test')).toBeVisible()
    // sign out, keep local data
    await pc.getByRole('button', { name: 'Abmelden' }).click()
    await pc.getByRole('button', { name: 'Abmelden – Daten auf diesem Gerät behalten' }).click()
    await expect(pc.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
    await pc.goto('/#/aufgaben')
    await pc.getByRole('tab', { name: /Erledigt/ }).click()
    await expect(pc.getByText('Referat Bio vorbereiten')).toBeVisible()
    await pcCtx.close()
    await phoneCtx.close()
  })

  test('both devices have data: merge is offered and nothing is lost', async ({ browser, baseURL }) => {
    const fake = new FakeSupabase()
    const a = await browser.newContext({ baseURL })
    await mockCloud(a, fake)
    const pa = await a.newPage()
    await onboard(pa, 'Ada', false)
    await settings(pa)
    await pa.getByRole('button', { name: 'Mit Google anmelden' }).click()
    await pa.getByRole('button', { name: 'Hochladen' }).click()
    await expect(pa.getByText(/Synchronisiert/).first()).toBeVisible()
    const cloudSubjects = fake.live('subjects').length

    const b = await browser.newContext({ baseURL })
    await mockCloud(b, fake)
    const pb = await b.newPage()
    await onboard(pb, 'Ada (Handy)', false)
    await pb.goto('/#/faecher')
    await settings(pb)
    await pb.getByRole('button', { name: 'Mit Google anmelden' }).click()
    const dlg = pb.getByRole('dialog', { name: 'Daten mit deinem Konto verbinden' })
    await expect(dlg.getByText('Zusammenführen (empfohlen)')).toBeVisible()
    await expect(dlg.getByText('Nur die Daten aus meinem Konto verwenden')).toBeVisible()
    // replacing the cloud needs typed confirmation
    await dlg.getByText('Nur die Daten dieses Geräts verwenden').click()
    await expect(pb.getByRole('button', { name: 'Konto ersetzen' })).toBeDisabled()
    await dlg.getByText('Zusammenführen (empfohlen)').click()
    await pb.getByRole('button', { name: 'Zusammenführen', exact: true }).click()
    await expect(pb.getByText(/Synchronisiert/).first()).toBeVisible()
    expect(fake.live('subjects').length).toBeGreaterThanOrEqual(cloudSubjects) // nothing deleted
    // a safety copy was stored before merging
    await expect(pb.getByText(/Sicherheitskopien \(1\)/)).toBeVisible()
    await a.close()
    await b.close()
  })

  test('clear errors: not configured, missing database table, cancelled Google sign-in', async ({ browser, baseURL }) => {
    const off = await browser.newContext({ baseURL })
    await mockCloud(off, new FakeSupabase(), { configured: false })
    const p1 = await off.newPage()
    await onboard(p1, 'Ole', false)
    await settings(p1)
    await expect(p1.getByText('Synchronisierung nicht verfügbar')).toBeVisible()
    await expect(p1.getByText(/SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY fehlen/)).toBeVisible()
    await off.close()

    const fake = new FakeSupabase()
    fake.missingTable = true
    const ctx = await browser.newContext({ baseURL })
    await mockCloud(ctx, fake)
    const p2 = await ctx.newPage()
    await onboard(p2, 'Mia', false)
    await settings(p2)
    await p2.getByRole('button', { name: 'Mit Google anmelden' }).click()
    await expect(p2.getByText(/Die Cloud-Datenbank ist noch nicht eingerichtet/).first()).toBeVisible()

    // Google returns with ?error=access_denied
    await p2.goto(`${baseURL}/?error=access_denied&error_description=user+cancelled#/einstellungen`)
    await expect(p2.getByText('Die Anmeldung wurde abgebrochen.')).toBeVisible()
    expect(p2.url()).not.toContain('error=')
    await ctx.close()
  })
})
