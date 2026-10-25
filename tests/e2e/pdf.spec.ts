import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

/** Builds a tiny valid one-page PDF with a text layer (byte offsets computed for the xref table). */
function makePdf(text: string): Buffer {
  const content = `BT /F1 14 Tf 72 720 Td (${text}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('PDF import extracts the text layer (pdf.js 6)', async ({ page }) => {
  await onboard(page, 'Pia', false)
  await page.goto('/#/bibliothek/import')
  await page.getByLabel('Datei auswählen').setInputFiles({ name: 'photosynthese.pdf', mimeType: 'application/pdf', buffer: makePdf('Photosynthese wandelt Lichtenergie in chemische Energie um.') })
  await expect(page.getByLabel('Erkannter Text – du kannst ihn korrigieren')).toHaveValue(/Photosynthese wandelt Lichtenergie/, { timeout: 20_000 })
})
