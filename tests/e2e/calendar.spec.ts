import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { onboard } from './helpers'

const dialog = (page: Page) => page.locator('dialog[open]')
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Creates an entry through the editor dialog (opened by the caller). */
async function fillEntry(page: Page, o: { kind?: string; title: string; date?: string; start?: string; end?: string; subject?: string }) {
  const dl = dialog(page)
  await expect(dl.getByRole('heading', { name: /Neuer Eintrag|bearbeiten/ })).toBeVisible()
  if (o.kind) await dl.getByRole('radio', { name: o.kind, exact: true }).click()
  await dl.getByLabel('Titel').fill(o.title)
  if (o.subject) await dl.getByLabel('Fach').selectOption({ label: o.subject })
  if (o.date || o.start) {
    await dl.getByRole('tab', { name: /^(Zeit|Termin|Frist & Aufwand)$/ }).click()
    if (o.date) await dl.getByLabel(/^(Datum|Fällig am|Datum der Prüfung)/).fill(o.date)
    if (o.start) await dl.getByLabel('Beginn', { exact: true }).fill(o.start)
    if (o.end) await dl.getByLabel('Ende', { exact: true }).fill(o.end)
  }
}

test.describe('Kalender & Planer', () => {
  test('create, see in every view, edit, move, duplicate, delete + undo, survive reload', async ({ page }) => {
    await onboard(page, 'Kim', false)
    await page.goto(`/#/kalender?ansicht=week&datum=${inDays(1)}`)
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await fillEntry(page, { title: 'Zahnarzt', date: inDays(1), start: '16:00', end: '16:45' })
    await dialog(page).getByRole('tab', { name: 'Details' }).click()
    await dialog(page).getByLabel(/Ort/).fill('Praxis Albers')
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByRole('button', { name: /Zahnarzt, 16:00–16:45/ })).toBeVisible()

    // same data in month, day and agenda view
    for (const v of ['month', 'day', 'agenda']) {
      await page.goto(`/#/kalender?ansicht=${v}&datum=${inDays(1)}`)
      await expect(page.getByText('Zahnarzt').first()).toBeVisible()
    }
    // reload keeps it (IndexedDB)
    await page.reload()
    await expect(page.getByText('Zahnarzt').first()).toBeVisible()

    // edit via detail panel
    await page.goto(`/#/kalender?ansicht=week&datum=${inDays(1)}`)
    await page.getByRole('button', { name: /Zahnarzt, 16:00–16:45/ }).click()
    await expect(page.getByText('Praxis Albers')).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await dialog(page).getByLabel('Titel').fill('Zahnarzt (Kontrolle)')
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 16:00–16:45/ })).toBeVisible()

    // move to another day with the accessible move form
    await page.getByRole('button', { name: /Zahnarzt \(Kontrolle\)/ }).first().click()
    await page.getByRole('button', { name: 'Verschieben', exact: true }).click()
    await page.getByLabel('Neuer Tag').fill(inDays(2))
    await page.getByLabel('Beginn').fill('17:00')
    await page.getByRole('button', { name: 'Hierhin verschieben' }).click()
    await page.goto(`/#/kalender?ansicht=day&datum=${inDays(2)}`)
    await expect(page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00–17:45/ })).toBeVisible()

    // duplicate, then delete the copy and undo the deletion
    await page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00/ }).click()
    await page.getByRole('button', { name: 'Duplizieren' }).click()
    await expect(page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00/ })).toHaveCount(2)
    await page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00/ }).first().click()
    await page.getByRole('button', { name: 'Löschen' }).click()
    await dialog(page).getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00/ })).toHaveCount(1)
    await page.keyboard.press('Control+z')
    await expect(page.getByRole('button', { name: /Zahnarzt \(Kontrolle\), 17:00/ })).toHaveCount(2)
  })

  test('recurring lessons: weekly series, change only one occurrence', async ({ page }) => {
    await onboard(page, 'Ole', false)
    const monday = (() => {
      const d = new Date()
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
      return dayKey(d)
    })()
    await page.goto(`/#/kalender?ansicht=week&datum=${monday}`)
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await fillEntry(page, { kind: 'Unterricht', title: 'Mathematik', subject: 'Mathematik', date: monday, start: '08:00', end: '08:45' })
    await dialog(page).getByLabel('Wiederholung', { exact: true }).selectOption('weekly')
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByRole('button', { name: /Mathematik, 08:00–08:45/ })).toBeVisible()
    await page.getByRole('button', { name: 'Weiter (→)' }).click()
    await expect(page.getByRole('button', { name: /Mathematik, 08:00–08:45/ })).toBeVisible()
    // edit only this occurrence
    await page.getByRole('button', { name: /Mathematik, 08:00–08:45/ }).click()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await dialog(page).getByRole('tab', { name: 'Zeit' }).click()
    await dialog(page).getByLabel('Beginn', { exact: true }).fill('10:00')
    await dialog(page).getByLabel('Ende', { exact: true }).fill('10:45')
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    await dialog(page).getByRole('button', { name: 'Nur dieser Termin' }).click()
    await expect(page.getByRole('button', { name: /Mathematik, 10:00–10:45/ })).toBeVisible()
    await page.getByRole('button', { name: 'Weiter (→)' }).click()
    await expect(page.getByRole('button', { name: /Mathematik, 08:00–08:45/ })).toBeVisible() // series unchanged
  })

  test('tasks: quick add, deadline in calendar, complete from calendar, status everywhere', async ({ page }) => {
    await onboard(page, 'Tia', false)
    await page.goto('/#/aufgaben')
    await page.getByLabel('Neue Aufgabe').fill('Englisch Vokabeln Unit 3')
    await page.getByLabel('Neue Aufgabe').press('Enter')
    await expect(page.getByText('Englisch Vokabeln Unit 3')).toBeVisible()
    await page.goto(`/#/kalender?ansicht=agenda&datum=${dayKey(new Date())}`)
    const row = page.getByRole('button', { name: /Englisch Vokabeln Unit 3/ }).first()
    await expect(row).toBeVisible()
    await page.getByRole('checkbox', { name: '„Englisch Vokabeln Unit 3“ als erledigt markieren' }).first().click()
    await page.goto('/#/aufgaben')
    await page.getByRole('tab', { name: /Erledigt/ }).click()
    await expect(page.getByText('Englisch Vokabeln Unit 3')).toBeVisible()
  })

  test('exam + "Lernplan automatisch erstellen": review, approve, sessions appear, manual entries untouched; filters', async ({ page }) => {
    await onboard(page, 'Eli', true)
    // a manual appointment that must never move
    await page.goto(`/#/kalender?ansicht=week&datum=${inDays(1)}`)
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await fillEntry(page, { title: 'Fußball', date: inDays(1), start: '16:00', end: '17:30' })
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    // exam through the calendar editor
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await fillEntry(page, { kind: 'Prüfung', title: 'Mathearbeit Pythagoras', subject: 'Mathematik', date: inDays(6) })
    await dialog(page).getByRole('tab', { name: 'Themen & Vorbereitung' }).click()
    await dialog(page).getByLabel('Satz des Pythagoras', { exact: true }).check()
    await dialog(page).getByRole('radiogroup', { name: /Wie sicher fühlst du dich bei Satz des Pythagoras/ }).getByRole('radio', { name: '2' }).click()
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText(/Prüfung eingetragen/)).toBeVisible()

    await page.getByRole('button', { name: 'Lernplan automatisch erstellen' }).click()
    await dialog(page).getByRole('button', { name: 'Vorschlag berechnen' }).click()
    await expect(dialog(page).getByText(/Neu: \d+|Verschoben: \d+/).first()).toBeVisible()
    await dialog(page).getByRole('button', { name: /Übernehmen/ }).click()
    await expect(page.getByText('Lernplan übernommen')).toBeVisible()

    await page.goto(`/#/kalender?ansicht=agenda&datum=${dayKey(new Date())}`)
    await expect(page.getByText(/Satz des Pythagoras/).first()).toBeVisible()
    await expect(page.getByText('Fußball').first()).toBeVisible()
    // manual entry unchanged after planning
    await page.goto(`/#/kalender?ansicht=week&datum=${inDays(1)}`)
    await expect(page.getByRole('button', { name: /Fußball, 16:00–17:30/ })).toBeVisible()

    // exam preparation panel uses real data
    await page.goto('/#/pruefungen')
    await page.getByText('Mathearbeit Pythagoras').first().click()
    await expect(page.getByRole('heading', { name: 'Vorbereitung' })).toBeVisible()
    await expect(page.getByText(/0 von 1 Themen sicher/)).toBeVisible()

    // filter: only exams
    await page.goto(`/#/kalender?ansicht=agenda&datum=${dayKey(new Date())}`)
    await page.getByRole('button', { name: 'Prüfungen', exact: true }).click()
    await expect(page.getByText(/Filter aktiv/)).toBeVisible()
    await expect(page.getByText('Fußball')).toHaveCount(0)
    await expect(page.getByText('Mathearbeit Pythagoras').first()).toBeVisible()
    await page.getByRole('button', { name: 'Alle zeigen' }).click()
    await expect(page.getByText('Fußball').first()).toBeVisible()

    // backup contains calendar data
    await page.goto('/#/einstellungen')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Sicherung herunterladen/ }).click()
    const file = await download
    const backup = JSON.parse(readFileSync((await file.path())!, 'utf8'))
    expect(backup.version).toBe(2)
    expect(backup.tables.events.some((e: { title: string }) => e.title === 'Fußball')).toBe(true)
    expect(backup.tables.exams.some((e: { title: string; plan: unknown[] }) => e.title === 'Mathearbeit Pythagoras' && e.plan.length > 0)).toBe(true)
  })

  test('drag to move and resize in the week grid; Mein Tag and Wochenplanung show real data', async ({ page }) => {
    await onboard(page, 'Dan', false)
    await page.goto(`/#/kalender?ansicht=day&datum=${inDays(1)}`)
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await fillEntry(page, { kind: 'Lerneinheit', title: 'Bio lernen', date: inDays(1), start: '15:00', end: '16:00' })
    await dialog(page).getByRole('button', { name: 'Speichern' }).click()
    const block = page.getByRole('button', { name: /Bio lernen, 15:00–16:00/ })
    await expect(block).toBeVisible()
    const box = (await block.boundingBox())!
    // drag down by one hour (48 px per hour)
    await page.mouse.move(box.x + box.width / 2, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 34, { steps: 4 })
    await page.mouse.move(box.x + box.width / 2, box.y + 58, { steps: 4 })
    await page.mouse.up()
    await expect(page.getByRole('button', { name: /Bio lernen, 16:00–17:00/ })).toBeVisible()
    // resize: drag the lower edge 30 minutes down
    const moved = (await page.getByRole('button', { name: /Bio lernen, 16:00–17:00/ }).boundingBox())!
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height - 2)
    await page.mouse.down()
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height + 12, { steps: 3 })
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height + 24, { steps: 3 })
    await page.mouse.up()
    await expect(page.getByRole('button', { name: /Bio lernen, 16:00–17:30/ })).toBeVisible()

    await page.goto('/#/mein-tag')
    await expect(page.getByText('Das solltest du jetzt tun')).toBeVisible()
    await page.goto('/#/wochenplanung')
    await expect(page.getByRole('heading', { name: 'Wochenplanung' })).toBeVisible()
    await expect(page.getByText('Empfehlungen für deine Woche')).toBeVisible()
  })
})

test('entries survive a browser restart (new browser context with the saved storage)', async ({ browser, page, baseURL }) => {
  await onboard(page, 'Rhea', false)
  await page.goto(`/#/kalender?ansicht=week&datum=${inDays(1)}`)
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  await fillEntry(page, { title: 'Klavierstunde', date: inDays(1), start: '15:00', end: '15:45' })
  await dialog(page).getByRole('tab', { name: 'Zeit' }).click()
  await dialog(page).getByLabel('Wiederholung', { exact: true }).selectOption('weekly')
  await dialog(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('button', { name: /Klavierstunde, 15:00–15:45/ })).toBeVisible()
  const state = await page.context().storageState({ indexedDB: true })
  await page.context().close()
  const fresh = await browser.newContext({ storageState: state, baseURL })
  const p2 = await fresh.newPage()
  await p2.goto(`/#/kalender?ansicht=week&datum=${inDays(8)}`)
  await expect(p2.getByRole('button', { name: /Klavierstunde, 15:00–15:45/ })).toBeVisible()
  await fresh.close()
})
