import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

// Checks what only exists in the production build: installable web app, offline start, API routing.
test.skip(process.env.E2E_PROD !== '1', 'needs the production build (npm run test:e2e:prod)')

test('installable: manifest, icons and service worker', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Study OS', display: 'standalone', start_url: './' })
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons) expect((await request.get(`/${icon.src}`)).status()).toBe(200)
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200)

  await page.goto('/')
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toMatch(/\/$/)
})

test('opens offline after the first visit, data stays', async ({ page, context }) => {
  await onboard(page, 'Offline-Ole')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload() // now controlled by the service worker
  await expect(page.getByRole('heading', { name: /Was soll ich heute lernen/ })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Was soll ich heute lernen/ })).toBeVisible()
  await page.goto('/#/karteikarten')
  await expect(page.getByRole('heading', { name: 'Karteikarten', exact: true })).toBeVisible()
  await context.setOffline(false)
})

test('API is reachable from the same address and asks for the access code', async ({ page, request }) => {
  expect(await (await request.get('/api/health')).json()).toEqual({ ok: true })
  expect((await request.get('/api/gibt-es-nicht')).status()).toBe(404)

  // Simulates a deployment with API key + APP_ACCESS_TOKEN (the server logic itself is unit-tested).
  await page.route('**/api/ai/status', (route) => {
    const ok = route.request().headers()['x-studyos-token'] === 'mein-code-123'
    return route.fulfill({
      json: { configured: ok, provider: 'Anthropic Claude', model: ok ? 'claude-opus-5-5' : null, supportsImages: true, accessTokenRequired: true, authorized: ok, detail: ok ? 'Anthropic mit Modell claude-opus-5-5.' : 'Der Server verlangt einen Zugangscode. Trage ihn unter Einstellungen → KI-Anbieter ein.' },
    })
  })
  await onboard(page, 'Code-Carla')
  await page.goto('/#/einstellungen')
  await expect(page.getByText('API erreichbar, aber der Zugangscode fehlt oder ist falsch.')).toBeVisible()
  await page.getByLabel('Zugangscode').fill('mein-code-123')
  await page.getByLabel('Zugangscode').blur()
  await expect(page.getByText('Verfügbar: Anthropic Claude (claude-opus-5-5)')).toBeVisible()
  // the code is remembered on this device
  await page.reload()
  await expect(page.getByText('Verfügbar: Anthropic Claude (claude-opus-5-5)')).toBeVisible()
})
