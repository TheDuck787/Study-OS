import { expect, test } from '@playwright/test'
import { noHorizontalScroll, onboard } from './helpers'

test('Android phone: navigation, no sideways scrolling, quiz usable', async ({ page }) => {
  await onboard(page, 'Lea')
  await noHorizontalScroll(page)
  const nav = page.getByRole('navigation', { name: 'Navigation' })
  await expect(nav).toBeVisible()
  await nav.getByRole('link', { name: 'Fächer' }).click()
  await expect(page.getByRole('heading', { name: 'Deine Fächer' })).toBeVisible()
  await noHorizontalScroll(page)
  await nav.getByRole('button', { name: 'Mehr' }).click()
  await page.getByRole('dialog', { name: 'Weitere Bereiche' }).getByRole('button', { name: 'Prüfungen' }).click()
  await expect(page.getByRole('heading', { name: 'Prüfungen und Lernpläne' })).toBeVisible()
  await noHorizontalScroll(page)
  for (const path of ['/#/mathe', '/#/karteikarten', '/#/fortschritt', '/#/einstellungen', '/#/bibliothek', '/#/tutor', '/#/quiz']) {
    await page.goto(path)
    await page.waitForTimeout(300)
    await noHorizontalScroll(page)
  }
  await page.goto('/#/quiz/neu?topic=ma-prozent&preset=practice')
  await expect(page.getByText(/Frage 1 von/)).toBeVisible()
  await noHorizontalScroll(page)
})
