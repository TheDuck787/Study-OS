import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

test.describe('Lernpakete', () => {
  test('example package: preview → import into a new subject → saved after reload → exam mode → no duplicates on re-import', async ({ page }) => {
    await onboard(page, 'Finn', false)
    await page.goto('/#/bibliothek')
    await page.getByRole('link', { name: 'Lernpaket' }).click()
    await expect(page.getByRole('heading', { name: 'Lernpaket importieren' })).toBeVisible()
    await page.getByRole('button', { name: /Beispiel laden/ }).click()

    // preview
    await expect(page.getByRole('heading', { name: 'Textanalyse – Klasse 9' })).toBeVisible()
    await expect(page.getByText('Gültig')).toBeVisible()
    const contents = page.getByRole('list', { name: 'Inhalt des Pakets' }).or(page.locator('dl[aria-label="Inhalt des Pakets"]'))
    await expect(contents).toContainText('Fragen20')
    await expect(contents).toContainText('Karteikarten15')
    await page.getByText(/^Fragen \(20\)$/).click()
    await expect(page.getByText(/\[Auswahl, Prüfung\] Was gehört in die Einleitung/)).toBeVisible()

    // target: "Deutsch" does not exist yet (onboarding chose Mathe + Englisch) → new subject + new topic
    await expect(page.getByLabel('Fach', { exact: true })).toHaveValue('__new__')
    await expect(page.getByLabel('Name des neuen Fachs')).toHaveValue('Deutsch')
    await expect(page.getByLabel('Name des neuen Themas')).toHaveValue('Textanalyse')
    await page.getByRole('button', { name: 'Importieren', exact: true }).click()

    // summary
    await expect(page.getByRole('heading', { name: '„Textanalyse – Klasse 9“ ist jetzt in Study OS' })).toBeVisible()
    const sum = page.locator('dl[aria-label="Import-Zusammenfassung"]')
    await expect(sum).toContainText('Fragen20')
    await expect(sum).toContainText('Übungen9')
    await expect(sum).toContainText('Karteikarten33') // 15 cards + 18 key terms

    await page.getByRole('link', { name: 'Thema öffnen' }).click()
    await expect(page.getByRole('heading', { name: 'Textanalyse', level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Fragen (29)' })).toBeVisible() // 20 questions + 9 exercises survive a reload
    await expect(page.getByText('Überblick: Textanalyse')).toBeVisible()
    await expect(page.getByText('Lernzettel: Textanalyse')).toBeVisible()

    // exam mode with the marked questions
    await page.getByRole('button', { name: 'Prüfungsmodus' }).click()
    await expect(page.getByText(/Frage 1 von 8/)).toBeVisible()

    // flashcards are in the deck list
    await page.goto('/#/karteikarten')
    await expect(page.getByText('Textanalyse – Karteikarten')).toBeVisible()

    // importing again creates nothing twice
    await page.goto('/#/bibliothek/lernpaket')
    await page.getByRole('button', { name: /Beispiel laden/ }).click()
    await expect(page.getByText('Dieses Paket wurde schon importiert')).toBeVisible()
    await expect(page.getByLabel('Fach', { exact: true })).not.toHaveValue('__new__') // "Deutsch" now exists and is chosen
    await page.getByRole('button', { name: 'Importieren', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Alles war schon vorhanden' })).toBeVisible()
    await expect(page.locator('dl[aria-label="Import-Zusammenfassung"]')).toContainText('20 schon vorhanden')
  })

  test('invalid files show clear errors and import nothing; Markdown import into an existing topic; export as package', async ({ page }) => {
    await onboard(page, 'Ada', false)
    await page.goto('/#/bibliothek/lernpaket')
    const input = page.getByLabel('Lernpaket-Datei')

    await input.setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{ "format": "studyos-learning-package", "id": "x", }') })
    await expect(page.getByText(/Die Datei kann so nicht importiert werden/)).toBeVisible()
    await expect(page.getByText(/Zeile 1, Spalte \d+:/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importieren', exact: true })).toHaveCount(0)

    await input.setInputFiles({ name: 'fehler.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'studyos-learning-package', version: 1, id: 'm', title: 'T', subject: 'Mathematik', topic: 'Brüche', questions: [{ type: 'multiple-choice', prompt: 'P?', options: ['a', 'b'], correct: 5 }] })) })
    await expect(page.getByText(/Fragen Nr\. 1:.*„correct“ muss zwischen 0 und 1 liegen/)).toBeVisible()
    await expect(page.getByText(/Fragen Nr\. 1:.*Die Erklärung/)).toBeVisible()

    // Markdown package into the existing subject "Mathematik" and an existing topic
    await page.goto('/#/faecher')
    await page.getByRole('link', { name: 'Mathematik' }).first().click()
    await page.getByRole('button', { name: 'Fach-Aktionen' }).click()
    await page.getByRole('menuitem', { name: 'Lernpaket importieren' }).click()
    const md = `---\nid: mathe-brueche-6\nsubject: Mathematik\ntopic: Brüche kürzen\nlevel: Klasse 6\n---\n# Brüche kürzen\n\n## Notizen\n### Kürzen\nZähler und Nenner durch dieselbe Zahl teilen.\n\n## Fragen\n### Zahl: Kürze 6/8. Wie lautet der neue Nenner?\nLösung: 4\nErklärung: 6/8 = 3/4, beide durch 2 geteilt.\n\n### WF: Beim Kürzen ändert sich der Wert des Bruchs.\nLösung: falsch\nErklärung: Der Wert bleibt gleich, nur die Darstellung ändert sich.\n\n## Karteikarten\n- Kürzen :: Zähler und Nenner durch dieselbe Zahl teilen\n`
    await page.getByLabel('Lernpaket-Datei').setInputFiles({ name: 'brueche.md', mimeType: 'text/markdown', buffer: Buffer.from(md) })
    await expect(page.getByText('Vorschau · Markdown/TXT')).toBeVisible()
    await expect(page.getByLabel('Fach', { exact: true })).toHaveValue(/.+/)
    await expect(page.getByLabel('Fach', { exact: true }).locator('option:checked')).toHaveText('Mathematik')
    await page.getByRole('button', { name: 'Importieren', exact: true }).click()
    const sum = page.locator('dl[aria-label="Import-Zusammenfassung"]')
    await expect(sum).toContainText('Fragen2')
    await expect(sum).toContainText('Karteikarten1')
    await page.getByRole('link', { name: 'Thema öffnen' }).click()
    await expect(page.getByRole('heading', { name: 'Brüche kürzen', level: 1 })).toBeVisible()

    // export the topic as a learning package
    const [dl] = await Promise.all([page.waitForEvent('download'), (async () => {
      await page.getByRole('button', { name: 'Weitere Aktionen zum Thema' }).click()
      await page.getByRole('menuitem', { name: 'Als Lernpaket exportieren (JSON)' }).click()
    })()])
    const pkg = JSON.parse(readFileSync((await dl.path())!, 'utf8'))
    expect(pkg).toMatchObject({ format: 'studyos-learning-package', version: 1, id: 'mathe-brueche-6', subject: 'Mathematik', topic: 'Brüche kürzen' })
    expect(pkg.questions).toHaveLength(2)
    expect(pkg.flashcards).toHaveLength(1)
  })
})
