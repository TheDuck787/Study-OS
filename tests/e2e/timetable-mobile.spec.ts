import { expect, test } from '@playwright/test'
import { noHorizontalScroll, onboard } from './helpers'

const SHOTS = process.env.SHOTS_DIR

test('Android phone: timetable in the bottom bar, day view by default, week view and sheets fit the screen', async ({ page }) => {
  await onboard(page, 'Lea', false)
  const nav = page.getByRole('navigation', { name: 'Navigation' })
  await nav.getByRole('link', { name: 'Stundenplan' }).click()
  await expect(page.getByRole('heading', { name: 'Dein Stundenplan ist noch leer' })).toBeVisible()
  await noHorizontalScroll(page)

  // raster
  await page.getByRole('button', { name: 'Raster anlegen' }).click()
  const md = page.getByRole('dialog', { name: 'Stammdaten' })
  await md.getByLabel('1. Stunde beginnt').fill('08:00')
  await md.getByRole('button', { name: 'Raster erzeugen' }).click()
  await md.getByRole('button', { name: 'Raster speichern' }).click()
  await md.getByRole('button', { name: 'Schließen' }).first().click()

  // two lessons on Monday
  for (const [subject, from] of [['Mathematik', '1'], ['Englisch', '3']] as const) {
    await page.getByRole('button', { name: /^(Erste Stunde|Stunde)$/ }).first().click()
    const dlg = page.getByRole('dialog', { name: 'Stunde eintragen' })
    await dlg.getByLabel('Fach').selectOption({ label: subject })
    await dlg.getByRole('radiogroup', { name: 'Wochentag' }).getByRole('radio', { name: 'Mo' }).click()
    await dlg.getByLabel('Von Stunde').selectOption(from)
    await dlg.getByLabel('Raum').fill('R 12')
    await noHorizontalScroll(page)
    await dlg.getByRole('button', { name: 'Speichern' }).click()
    await expect(dlg).toBeHidden()
  }

  // day view is the default on phones; jump to Monday
  await expect(page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Tag' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('tablist', { name: 'Tag wählen' }).getByRole('tab', { name: /Mo/ }).click()
  const list = page.getByRole('list', { name: 'Stunden des Tages' })
  await expect(list.getByRole('button', { name: /^Mathematik, Montag/ })).toBeVisible()
  await expect(list.getByRole('button', { name: /2\. Stunde frei/ })).toBeVisible() // free period between the lessons
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/day-android.png`, fullPage: true })

  // swipe to the next day
  const area = page.locator('[data-swipe]')
  const box = (await area.boundingBox())!
  await area.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: box.x + box.width - 20, clientY: box.y + 40 }], changedTouches: [{ identifier: 1, clientX: box.x + box.width - 20, clientY: box.y + 40 }] })
  await area.dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: box.x + 20, clientY: box.y + 44 }] })
  await expect(page.getByRole('tablist', { name: 'Tag wählen' }).getByRole('tab', { name: /Di/ })).toHaveAttribute('aria-selected', 'true')

  // week view fits the screen (short subject names)
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Woche' }).click()
  const grid = page.getByRole('grid', { name: 'Wochenstundenplan' })
  await expect(grid.getByRole('button', { name: /^Mathematik, Montag/ })).toBeVisible()
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/week-android.png`, fullPage: true })

  // lesson sheet: substitute for one day
  await grid.getByRole('button', { name: /^Englisch, Montag/ }).click()
  const sheet = page.getByRole('dialog', { name: /Englisch/ })
  await sheet.getByRole('button', { name: 'Entfall / Vertretung' }).click()
  await sheet.getByRole('radio', { name: 'Vertretung' }).click()
  await sheet.getByLabel('Lehrkraft').fill('Fr. Kurz')
  await noHorizontalScroll(page)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sheet-android.png` })
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(grid.getByRole('button', { name: /^Englisch, Montag.*Vertretung/ })).toBeVisible()
  await noHorizontalScroll(page)
})
