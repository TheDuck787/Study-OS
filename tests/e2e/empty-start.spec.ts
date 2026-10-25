import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

test('subjects start empty; example content can be removed again', async ({ page }) => {
  await onboard(page, 'Leer-Lina', false)
  await page.goto('/#/faecher')
  await page.getByRole('link', { name: /Mathematik/ }).first().click()
  await expect(page.getByText('Dieses Fach ist noch leer')).toBeVisible()
  await page.getByRole('button', { name: 'Erstes Thema anlegen' }).click()
  // the student creates their own topic
  await page.getByLabel('Name des neuen Themas').fill('Lineare Funktionen')
  await page.getByLabel('Name des neuen Themas').press('Enter')
  await expect(page.getByText('Lineare Funktionen').first()).toBeVisible()

  // someone who loaded the examples earlier can remove them
  await page.goto('/#/einstellungen')
  await page.getByText('Beispiel-Lehrplan nachladen (optional)').click()
  await page.getByLabel('Mathematik', { exact: true }).check()
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByText('Beispielinhalte ergänzt')).toBeVisible()
  await page.getByRole('button', { name: 'Beispielinhalte entfernen' }).click()
  await page.getByRole('button', { name: 'Entfernen', exact: true }).click()
  await expect(page.getByText(/Beispielinhalte entfernt/)).toBeVisible()

  await page.goto('/#/faecher')
  await page.getByRole('link', { name: /Mathematik/ }).first().click()
  await expect(page.getByText('Lineare Funktionen').first()).toBeVisible()
  await expect(page.getByText('Satz des Pythagoras')).toHaveCount(0)
})
