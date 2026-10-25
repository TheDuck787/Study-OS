import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { onboard } from './helpers'

const SHOTS = process.env.SHOTS_DIR

async function setupRaster(page: Page) {
  await page.getByRole('button', { name: 'Raster anlegen' }).click()
  const dlg = page.getByRole('dialog', { name: 'Stammdaten' })
  await dlg.getByLabel('1. Stunde beginnt').fill('07:45')
  await dlg.getByRole('button', { name: 'Raster erzeugen' }).click()
  await expect(dlg.getByLabel('Beginn 3. Stunde')).toHaveValue('09:40')
  await dlg.getByRole('button', { name: 'Raster speichern' }).click()
  await expect(page.getByText('Stundenraster gespeichert')).toBeVisible()
  await dlg.getByRole('button', { name: 'Schließen' }).first().click()
}

async function addLesson(page: Page, o: { subject: string; day: string; from: string; to?: string; teacher?: string; room?: string }) {
  const dlg = page.getByRole('dialog', { name: /Stunde eintragen/ })
  await expect(dlg).toBeVisible()
  await dlg.getByLabel('Fach').selectOption({ label: o.subject })
  await dlg.getByRole('radiogroup', { name: 'Wochentag' }).getByRole('radio', { name: o.day }).click()
  await dlg.getByLabel('Von Stunde').selectOption({ value: o.from })
  if (o.to) await dlg.getByLabel('Bis Stunde').selectOption({ value: o.to })
  if (o.teacher) await dlg.getByLabel('Lehrkraft').fill(o.teacher)
  if (o.room) await dlg.getByLabel('Raum').fill(o.room)
  await dlg.getByRole('button', { name: 'Speichern' }).click()
  await expect(dlg).toBeHidden()
}

test('Stundenplan: raster, lessons, cancellation, homework, views, export and import', async ({ page }) => {
  await onboard(page, 'Finn', false)
  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Stundenplan' }).click()
  await expect(page.getByRole('heading', { name: 'Dein Stundenplan ist noch leer' })).toBeVisible()
  await setupRaster(page)

  await page.getByRole('button', { name: 'Erste Stunde' }).click()
  await addLesson(page, { subject: 'Mathematik', day: 'Mo', from: '1', to: '2', teacher: 'MÜL', room: '104' })
  await page.getByRole('button', { name: 'Stunde', exact: true }).click()
  await addLesson(page, { subject: 'Englisch', day: 'Di', from: '3', teacher: 'KUR', room: '201' })
  await page.getByRole('button', { name: 'Stunde', exact: true }).click()
  await addLesson(page, { subject: 'Englisch', day: 'Do', from: '5' })

  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Woche' }).click()
  const grid = page.getByRole('grid', { name: 'Wochenstundenplan' })
  const math = grid.getByRole('button', { name: /^Mathematik, Montag/ })
  await expect(math).toBeVisible()
  await expect(math).toContainText('104')
  await expect(math).toContainText('MÜL')
  // double lesson is twice as tall as a single one
  const mh = (await math.boundingBox())!.height
  const eh = (await grid.getByRole('button', { name: /^Englisch, Dienstag/ }).boundingBox())!.height
  expect(mh).toBeGreaterThan(eh * 1.8)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/week-desktop.png`, fullPage: true })

  // cancel Monday's maths lesson for this week only
  await math.click()
  const sheet = page.getByRole('dialog', { name: /Mathematik/ })
  await sheet.getByRole('button', { name: 'Entfall / Vertretung' }).click()
  await sheet.getByLabel('Notiz').fill('Lehrkraft auf Klassenfahrt')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Montag.*Entfall/ })).toBeVisible()
  // next week the lesson takes place as usual
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Montag/ })).not.toContainText('Entfall')
  await page.getByRole('button', { name: 'Vorherige Woche' }).click()

  // homework in Tuesday's English lesson → due at the next English lesson (Thursday)
  await grid.getByRole('button', { name: /^Englisch, Dienstag/ }).click()
  const en = page.getByRole('dialog', { name: /Englisch/ })
  await en.getByRole('button', { name: 'Hausaufgabe' }).click()
  await expect(en.getByText(/Nächste Englisch-Stunde: Do/)).toBeVisible()
  await en.getByLabel('Hausaufgabe', { exact: true }).fill('Vokabeln Unit 3')
  await en.getByRole('button', { name: 'Hausaufgabe speichern' }).click()
  await expect(page.getByText('Hausaufgabe eingetragen')).toBeVisible()
  await en.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(grid.getByRole('button', { name: /^Englisch, Donnerstag.*1 Hausaufgabe fällig/ })).toBeVisible()

  // the homework is a normal task, the lesson is in the calendar too
  await page.goto('/#/aufgaben')
  await page.getByRole('tab', { name: /Demnächst/ }).click()
  await expect(page.getByText('Vokabeln Unit 3')).toBeVisible()

  // day and list views
  await page.goto('/#/stundenplan')
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Tag' }).click()
  await page.getByRole('tablist', { name: 'Tag wählen' }).getByRole('tab', { name: /Do/ }).click()
  await expect(page.getByRole('list', { name: 'Stunden des Tages' }).getByRole('button', { name: /^Englisch, Donnerstag/ })).toBeVisible()
  await expect(page.getByText('Fällig am Do')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Liste' }).click()
  await expect(page.getByRole('button', { name: /^Mathematik, Montag.*Entfall/ }).first()).toBeVisible()

  // CSV export
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
    await page.getByRole('button', { name: 'Weitere Aktionen' }).click()
    await page.getByRole('menuitem', { name: 'Als CSV exportieren' }).click()
  })()])
  const csv = readFileSync((await dl.path())!, 'utf8')
  expect(csv).toContain('Tag;Stunde;Bis Stunde;Beginn;Ende;Fach')
  expect(csv).toMatch(/Montag;1;2;07:45;09:20;Mathematik;;MÜL;104/)

  // CSV import with a new subject; importing again skips duplicates
  const file = { name: 'plan.csv', mimeType: 'text/csv', buffer: Buffer.from('Tag;Stunde;Bis Stunde;Fach;Lehrkraft;Raum\nFreitag;2;;Physik;SCH;Labor\nMontag;1;2;Mathematik;MÜL;104\n') }
  for (const round of [1, 2]) {
    await page.getByRole('button', { name: 'Weitere Aktionen' }).click()
    await page.getByRole('menuitem', { name: 'Importieren (CSV / ICS)' }).click()
    const imp = page.getByRole('dialog', { name: 'Stundenplan importieren' })
    await imp.getByLabel('Datei für den Import').setInputFiles(file)
    await expect(imp.getByRole('cell', { name: /Physik/ })).toBeVisible()
    if (round === 1) await expect(imp.getByText(/Fehlende Fächer anlegen \(Physik\)/)).toBeVisible()
    await imp.getByRole('button', { name: /2 Stunden importieren/ }).click()
    await expect(page.getByText(round === 1 ? /1 Stunde importiert/ : /0 Stunden importiert/)).toBeVisible()
  }
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Woche' }).click()
  await expect(grid.getByRole('button', { name: /^Physik, Freitag/ })).toBeVisible()
  await expect(grid.getByRole('button', { name: /^Mathematik, Montag/ })).toHaveCount(1)

  // daily overview on the start page
  await page.goto('/#/')
  await expect(page.getByRole('region', { name: 'Schulübersicht' })).toBeVisible()
})

test('Stundenplan: edit from a week on, duplicate, delete, master data', async ({ page }) => {
  await onboard(page, 'Ada', false)
  await page.goto('/#/stundenplan')
  await setupRaster(page)
  await page.getByRole('button', { name: 'Erste Stunde' }).click()
  await addLesson(page, { subject: 'Mathematik', day: 'Mi', from: '3', room: '104' })
  await page.getByRole('radiogroup', { name: 'Ansicht' }).getByRole('radio', { name: 'Woche' }).click()
  const grid = page.getByRole('grid', { name: 'Wochenstundenplan' })

  // from next week on in room 210
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await grid.getByRole('button', { name: /^Mathematik, Mittwoch/ }).click()
  await page.getByRole('dialog', { name: /Mathematik/ }).getByRole('button', { name: 'Bearbeiten' }).click()
  const ed = page.getByRole('dialog', { name: 'Stunde bearbeiten' })
  await ed.getByLabel('Raum').fill('210')
  await ed.getByRole('radio', { name: /Ab dieser Woche/ }).click()
  await ed.getByRole('button', { name: 'Speichern' }).click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Mittwoch/ })).toContainText('210')
  await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Mittwoch/ })).toContainText('104')

  // duplicate to Friday, 5th period
  await grid.getByRole('button', { name: /^Mathematik, Mittwoch/ }).click()
  const sheet = page.getByRole('dialog', { name: /Mathematik/ })
  await sheet.getByRole('button', { name: 'Duplizieren' }).click()
  await sheet.getByRole('radiogroup', { name: 'Wochentag' }).getByRole('radio', { name: 'Fr' }).click()
  await sheet.getByLabel('Ab Stunde').selectOption('5')
  await sheet.getByRole('button', { name: 'Duplizieren' }).last().click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Freitag.*5\. Std/ })).toBeVisible()

  // delete the Friday copy in all weeks
  await grid.getByRole('button', { name: /^Mathematik, Freitag/ }).click()
  const fr = page.getByRole('dialog', { name: /Mathematik/ })
  await fr.getByRole('button', { name: 'Löschen' }).click()
  await fr.getByRole('button', { name: 'In allen Wochen löschen' }).click()
  await expect(grid.getByRole('button', { name: /^Mathematik, Freitag/ })).toHaveCount(0)

  // master data: subject code and colour are used in the timetable
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click()
  await page.getByRole('menuitem', { name: /Stammdaten/ }).click()
  const md = page.getByRole('dialog', { name: 'Stammdaten' })
  await md.getByRole('tab', { name: 'Fächer' }).click()
  await md.getByLabel('Kürzel für Mathematik').fill('MA')
  await md.getByRole('button', { name: 'Speichern' }).first().click()
  await expect(page.getByText('Fach gespeichert')).toBeVisible()
  await md.getByRole('tab', { name: 'Wochen & Tage' }).click()
  await md.getByRole('radio', { name: /= A-Woche/ }).click()
  await expect(page.getByText(/ist jetzt eine A-Woche/)).toBeVisible()
  await md.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(page.getByText(/· A-Woche/)).toBeVisible()
})
