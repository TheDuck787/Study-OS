/**
 * OCR with tesseract.js. The OCR engine and German/English language data (~ 10–20 MB)
 * are downloaded on first use, so this needs an internet connection once.
 */
export interface OcrResult {
  text: string
  confidence: number // 0..100
}

type Progress = (status: string, progress: number) => void

const STATUS_DE: Record<string, string> = {
  'loading tesseract core': 'Lade Texterkennung …',
  'initializing tesseract': 'Starte Texterkennung …',
  'loading language traineddata': 'Lade Sprachdaten (Deutsch/Englisch) …',
  'initializing api': 'Bereite Erkennung vor …',
  'recognizing text': 'Erkenne Text …',
}

export async function ocrImages(images: Blob[], onProgress?: Progress): Promise<OcrResult[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['deu', 'eng'], 1, {
    logger: (m: { status: string; progress: number }) => onProgress?.(STATUS_DE[m.status] ?? m.status, m.progress),
  })
  try {
    const out: OcrResult[] = []
    for (const img of images) {
      const { data } = await worker.recognize(img)
      out.push({ text: data.text.trim(), confidence: data.confidence })
    }
    return out
  } finally {
    await worker.terminate()
  }
}
