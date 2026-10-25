import { expect, test } from '@playwright/test'
import { noHorizontalScroll, onboard } from './helpers'

test('Android phone: navigation, no sideways scrolling, quiz usable', async ({ page }) => {
  await onboard(page, 'Lea')
  await noHorizontalScroll(page)
  const nav = page.getByRole('navigation', { name: 'Navigation' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Stundenplan' })).toBeVisible()
  await nav.getByRole('button', { name: 'Mehr' }).click()
  await page.getByRole('dialog', { name: 'Weitere Bereiche' }).getByRole('button', { name: 'Fächer' }).click()
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

test('Android phone: calendar views, quick add and touch editing without sideways scrolling', async ({ page }) => {
  await onboard(page, 'Mo', false)
  await page.getByRole('navigation', { name: 'Navigation' }).getByRole('link', { name: 'Kalender' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Ansicht' })).toBeVisible()
  await noHorizontalScroll(page)
  // quick add via the floating button
  await page.getByRole('button', { name: 'Neuer Eintrag' }).click()
  const dl = page.locator('dialog[open]')
  await dl.getByLabel('Titel').fill('Gitarrenunterricht')
  await dl.getByRole('tab', { name: 'Zeit' }).click()
  await dl.getByLabel('Beginn', { exact: true }).fill('17:00')
  await dl.getByLabel('Ende', { exact: true }).fill('18:00')
  await dl.getByRole('button', { name: 'Speichern' }).click()
  for (const v of ['Monat', 'Woche', 'Tag', 'Liste', 'Halbjahr']) {
    await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: v }).click()
    await page.waitForTimeout(250)
    await noHorizontalScroll(page)
  }
  // month: tap today → list below → details sheet → move via form (touch alternative to drag & drop)
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Monat' }).click()
  await page.getByRole('button', { name: /Gitarrenunterricht/ }).first().click()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.getByRole('heading', { name: 'Gitarrenunterricht' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Verschieben', exact: true }).click()
  await sheet.getByLabel('Beginn').fill('18:30')
  await sheet.getByRole('button', { name: 'Hierhin verschieben' }).click()
  await expect(sheet.getByText(/18:30–19:30/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  for (const path of ['/#/mein-tag', '/#/aufgaben', '/#/wochenplanung']) {
    await page.goto(path)
    await page.waitForTimeout(400)
    await noHorizontalScroll(page)
  }
})
