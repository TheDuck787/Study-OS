import { defineConfig, devices } from '@playwright/test'

// E2E_PROD=1 tests the production build (dist/, as deployed) served by the Node server
// instead of the Vite dev server. Run `npm run build` first.
const PROD = process.env.E2E_PROD === '1'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5179',
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'android', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: PROD ? 'node dist-server/index.js' : 'npx vite --port 5179 --strictPort',
    env: PROD ? { PORT: '5179', AI_PROVIDER: 'none' } : {},
    url: 'http://localhost:5179',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
