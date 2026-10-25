import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

/** The motion system: feedback appears and cleans up after itself; reduced motion turns it off. */
test.describe('Animationen & Mikro-Interaktionen', () => {
  test('completing a task gives feedback that cleans up; segmented indicator glides; dialogs open and close', async ({ page }) => {
    await onboard(page, 'Mo', false)
    await page.goto('/#/aufgaben')
    await page.getByLabel('Neue Aufgabe').fill('Vokabeln lernen')
    await page.getByLabel('Neue Aufgabe').press('Enter')
    // toast slides in with an icon and can be closed
    const toast = page.getByText('Aufgabe angelegt')
    await expect(toast).toBeVisible()
    await page.getByRole('button', { name: 'Meldung schließen' }).first().click()
    await expect(toast).toBeHidden()

    await page.getByRole('checkbox', { name: '„Vokabeln lernen“ erledigt' }).click()
    await expect.poll(() => page.locator('.confetti-piece').count()).toBeGreaterThan(0)
    await expect.poll(() => page.locator('.confetti-piece').count(), { timeout: 4000 }).toBe(0) // removed after the burst

    // the segmented control's indicator moves to the chosen option
    await page.goto('/#/kalender')
    const view = page.getByRole('radiogroup', { name: 'Ansicht' })
    const indicator = view.locator('span[aria-hidden]').first()
    await expect(indicator).toBeVisible()
    const before = await indicator.evaluate((el) => (el as HTMLElement).style.transform)
    await view.getByRole('radio', { name: 'Tag' }).click()
    await expect.poll(() => indicator.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before)

    // dialog opens (top layer) and closes again with Escape
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('reduced motion: no confetti and (almost) no animation time', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } })
    const page = await ctx.newPage()
    await onboard(page, 'Ida', false)
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.page-enter')!).animationDuration)
    expect(parseFloat(dur)).toBeLessThan(0.01)
    await page.goto('/#/aufgaben')
    await page.getByLabel('Neue Aufgabe').fill('Lesen')
    await page.getByLabel('Neue Aufgabe').press('Enter')
    await page.getByRole('checkbox', { name: '„Lesen“ erledigt' }).click()
    await expect(page.getByText('Erledigt', { exact: true }).first()).toBeVisible() // toast
    expect(await page.locator('.confetti-piece').count()).toBe(0)
    await ctx.close()
  })
})
