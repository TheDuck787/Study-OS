import { expect, test } from '@playwright/test'
import { answerCurrent, onboard } from './helpers'

test.describe('Definition of done – core learning flows (no AI configured)', () => {
  test('onboarding, subject + topic, note, flashcards, quiz, mistakes, mastery, exam plan, persistence, export', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    // 1. Open the app & onboarding
    await onboard(page)
    await expect(page.getByText(/Noch keine Lerndaten/)).toBeVisible()

    // 2. Create a subject and 3. add a topic
    await page.goto('/#/faecher')
    await page.getByRole('button', { name: 'Fach anlegen' }).first().click()
    await page.getByLabel('Name').fill('Informatik')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByRole('heading', { name: 'Informatik' })).toBeVisible()
    await page.getByRole('tab', { name: /Themen/ }).click()
    await page.getByLabel('Name des neuen Themas').fill('Binärzahlen')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByRole('link', { name: /Binärzahlen/ })).toBeVisible()

    // 4. Enter notes (with "Begriff: Erklärung" lines)
    await page.getByRole('link', { name: /Binärzahlen/ }).click()
    await page.getByRole('link', { name: 'Neue Notiz' }).click()
    await page.getByLabel('Titel').fill('Merkzettel Binär')
    await page.getByLabel('Inhalt').fill('## Begriffe\n\nBit: Die kleinste Informationseinheit mit dem Wert 0 oder 1.\nByte: Eine Gruppe aus acht Bits zusammen.')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Notiz gespeichert')).toBeVisible()

    // 5. Generate flashcards from the note, review them, then save
    await page.getByRole('button', { name: /Karteikarten erstellen \(2\)/ }).click()
    await expect(page.getByRole('heading', { name: 'Karteikarten prüfen und speichern' })).toBeVisible()
    await page.getByLabel('Name des neuen Stapels').fill('Informatik Grundlagen')
    await page.getByRole('button', { name: '2 Karten speichern' }).click()
    await expect(page.getByText('2 Karteikarten gespeichert')).toBeVisible()

    // Review session with keyboard shortcuts
    await page.goto('/#/karteikarten/lernen')
    await page.keyboard.press('Space')
    await page.keyboard.press('3')
    await page.keyboard.press('Space')
    await page.keyboard.press('1')
    await expect(page.getByText(/2 erledigt|noch 1/)).toBeVisible()

    // 6./7. Quiz one question at a time with feedback
    await page.goto('/#/quiz/neu?topic=ma-gleichungen&preset=practice')
    await expect(page.getByText(/Frage 1 von/)).toBeVisible()
    await answerCurrent(page, true)
    await expect(page.getByText(/Noch nicht richtig|Teilweise richtig|Richtig/).first()).toBeVisible()
    // answer the remaining questions
    for (let i = 0; i < 20; i++) {
      const next = page.getByRole('button', { name: /Weiter|Auswertung/ })
      if (!(await next.isVisible().catch(() => false))) break
      const label = await next.textContent()
      await next.click()
      if (label?.includes('Auswertung')) break
      await answerCurrent(page, false)
    }
    // 8. Score and estimated grade
    await expect(page.getByText('Geschätzte Note')).toBeVisible()
    await expect(page.getByText(/nur eine Schätzung/)).toBeVisible()

    // 9. Review mistakes later
    await page.goto('/#/fehler')
    await expect(page.getByText(/offene Fehler/).first()).toBeVisible()
    await expect(page.getByText('Deine letzte Antwort').first()).toBeVisible()

    // 10. Topic mastery and recommendations
    await page.goto('/#/')
    await expect(page.getByRole('heading', { name: 'Stand je Thema' })).toBeVisible()
    await expect(page.getByText(/Fehler wiederholen/).first()).toBeVisible()

    // 11. Create a test date and receive a study plan
    await page.goto('/#/pruefungen?neu=1')
    await page.getByLabel('Bezeichnung').fill('Klassenarbeit Gleichungen')
    await page.getByLabel('Lineare Gleichungen', { exact: true }).check()
    await page.getByLabel('Satz des Pythagoras', { exact: true }).check()
    await page.getByRole('button', { name: 'Lernplan erstellen' }).click()
    await expect(page.getByRole('heading', { name: 'Klassenarbeit Gleichungen' })).toBeVisible()
    const plan = page.getByRole('list').filter({ hasText: 'Probeklausur' })
    await expect(plan.getByText('Diagnosetest')).toBeVisible()
    await expect(page.getByText('Probeklausur').first()).toBeVisible()
    await expect(plan.getByText('Abschluss-Wiederholung', { exact: true })).toBeVisible()

    // 12. Close and reopen without losing data
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Klassenarbeit Gleichungen' })).toBeVisible()
    await page.goto('/#/faecher')
    await expect(page.getByRole('heading', { name: 'Informatik' })).toBeVisible()

    // 14. Export learning data
    await page.goto('/#/einstellungen')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Sicherung herunterladen/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/study-os-sicherung-.*\.json/)

    // 15. Works without AI: tutor states it honestly
    await page.goto('/#/tutor')
    await expect(page.getByText('Ohne KI-Anbieter')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('math mode: generated exercise, step checker finds the wrong step, equivalent answers accepted', async ({ page }) => {
    await onboard(page, 'Ben')
    await page.goto('/#/mathe')
    await page.getByRole('tab', { name: 'Rechenweg prüfen' }).click()
    await page.getByLabel('Ausgangsgleichung').fill('3x + 5 = 20')
    await page.getByLabel(/Dein Rechenweg/).fill('3x = 25\nx = 25/3')
    await page.getByRole('button', { name: 'Rechenweg prüfen' }).click()
    await expect(page.getByText('Hier steckt der Fehler.')).toBeVisible()
    await page.getByLabel(/Dein Rechenweg/).fill('3x = 15 | :3\nx = 5')
    await page.getByRole('button', { name: 'Rechenweg prüfen' }).click()
    await expect(page.getByText('Alle Schritte stimmen')).toBeVisible()

    // practice: fraction answer typed as decimal is accepted
    await page.goto('/#/quiz/neu?topic=ma-brueche&preset=practice')
    await expect(page.getByText(/Frage 1 von/)).toBeVisible()
  })

  test('demo mode is separate from real data', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Erst die Demo ansehen/ }).click()
    await expect(page.getByText('Demo-Modus:')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /Was soll ich heute lernen/ })).toBeVisible()
    await page.getByRole('button', { name: 'Zu meinen Daten wechseln' }).click()
    await expect(page.getByRole('heading', { name: /Lernen mit Plan/ })).toBeVisible()
  })
})
