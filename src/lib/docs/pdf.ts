/**
 * PDF text extraction with pdf.js (lazy-loaded). Pages without a text layer are
 * reported so the UI can offer OCR – nothing is silently dropped.
 */
export interface PdfPageText {
  page: number
  text: string
}

export interface PdfExtraction {
  pages: PdfPageText[]
  pageCount: number
  /** Pages that have (almost) no extractable text – probably scanned images. */
  emptyPages: number[]
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export async function extractPdfText(data: ArrayBuffer, onProgress?: (done: number, total: number) => void): Promise<PdfExtraction> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const pages: PdfPageText[] = []
  const emptyPages: number[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    let lastY: number | null = null
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n'
      text += item.str
      if (item.hasEOL) text += '\n'
      lastY = y
    }
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (text.replace(/\s/g, '').length < 20) emptyPages.push(i)
    pages.push({ page: i, text })
    onProgress?.(i, doc.numPages)
  }
  await doc.destroy()
  return { pages, pageCount: pages.length, emptyPages }
}

/** Renders a PDF page to a PNG blob (for OCR or AI vision). */
export async function renderPdfPage(data: ArrayBuffer, pageNumber: number, scale = 2): Promise<Blob> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  await doc.destroy()
  if (!blob) throw new Error('Seite konnte nicht als Bild gerendert werden.')
  return blob
}
