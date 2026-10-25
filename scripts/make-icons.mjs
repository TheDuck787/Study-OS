// Renders the PNG app icons from public/icon.svg (needs the Playwright Chromium):
// icon-192/512 (normal), icon-maskable-512 (Android adaptive icon, glyph inside the 80 % safe zone)
// and apple-touch-icon (180 px, iOS home screen).
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const glyph = svg.replace(/<rect[^>]*\/>/, '')
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname
const browser = await chromium.launch()
async function render(name, size, html) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<body style="margin:0;background:#3d5ce6;display:flex;align-items:center;justify-content:center;height:${size}px">${html}</body>`)
  await page.screenshot({ path: out(name) })
  await page.close()
}
for (const size of [192, 512]) await render(`icon-${size}.png`, size, svg.replace('<svg', `<svg width="${size}" height="${size}"`))
await render('icon-maskable-512.png', 512, glyph.replace('<svg', '<svg width="340" height="340"'))
await render('apple-touch-icon.png', 180, glyph.replace('<svg', '<svg width="150" height="150"'))
await browser.close()
