import { expect, test } from '@playwright/test'
import { noHorizontalScroll, onboard } from './helpers'

const SHOTS = process.env.SHOTS_DIR

test('Android phone: import the example package and read it without sideways scrolling', async ({ page }) => {
  await onboard(page, 'Lea', false)
  await page.goto('/#/bibliothek/lernpaket')
  await noHorizontalScroll(page)
  await page.getByRole('button', { name: /Beispiel laden/ }).click()
  await expect(page.getByText('Gültig')).toBeVisible()
  await page.getByText(/^Fragen \(20\)$/).click()
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pkg-preview-phone.png`, fullPage: true })
  await page.getByRole('button', { name: 'Importieren', exact: true }).click()
  await expect(page.getByRole('heading', { name: /ist jetzt in Study OS/ })).toBeVisible()
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pkg-done-phone.png`, fullPage: true })
  await page.getByRole('link', { name: 'Thema öffnen' }).click()
  await page.getByText('Beispiel: Komplette Textanalyse zu „Grüne Ampel“').click()
  await expect(page.getByText(/Lösungsweg – Schritt für Schritt/)).toBeVisible()
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pkg-example-phone.png`, fullPage: true })
})
