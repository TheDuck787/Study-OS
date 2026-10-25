import { expect, type Page } from '@playwright/test'

/** Completes onboarding for Mathematik + Englisch – with the optional example content unless `example` is false. */
export async function onboard(page: Page, name = 'Mia', example = true) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Lernen mit Plan/ })).toBeVisible()
  await page.getByRole('button', { name: /Eigenes Profil einrichten/ }).click()
  await page.getByLabel('Name oder Spitzname').fill(name)
  await page.getByRole('button', { name: 'Weiter' }).click()
  // keep only Mathematik and Englisch to make seeding quick
  for (const s of ['Deutsch', 'Biologie', 'Chemie', 'Physik', 'Geografie', 'Geschichte']) {
    const box = page.getByLabel(s, { exact: true })
    if (await box.isChecked()) await box.uncheck()
  }
  const exampleBox = page.getByLabel(/Beispielthemen, Beispielaufgaben und Vokabeln/)
  await expect(exampleBox).not.toBeChecked() // subjects start empty by default
  if (example) await exampleBox.check()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Fertig', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Was soll ich heute lernen/ })).toBeVisible()
}

/** Answers the current practice question (wrong on purpose if `wrong`). */
export async function answerCurrent(page: Page, wrong: boolean) {
  const radios = page.getByRole('radiogroup', { name: 'Antwortmöglichkeiten' })
  if (await radios.isVisible().catch(() => false)) {
    await radios.getByRole('radio').nth(wrong ? 0 : 1).click()
  } else {
    await page.getByLabel('Deine Antwort').fill(wrong ? '999999' : '1')
  }
  await page.getByRole('button', { name: 'Prüfen' }).click()
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}
