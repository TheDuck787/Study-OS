import type { ExtractionMethod, ExtractionStatus, MaterialSection } from '@/db/types'
import { extractSections } from './structure'

export interface ImportResult {
  title: string
  fileName: string | null
  mimeType: string
  size: number
  text: string
  sections: MaterialSection[]
  status: ExtractionStatus
  method: ExtractionMethod
  pages?: number
  pagesWithText?: number
  emptyPages?: number[]
  /** Text per PDF page (index 0 = page 1), so OCR results can be merged in page order. */
  pageTexts?: string[]
  warnings: string[]
  /** Original file, kept so the student can open the source later. */
  blob: Blob | null
  /** True if OCR could still improve the result (scanned PDF pages, images). */
  ocrPossible: boolean
}

export const SUPPORTED_ACCEPT = '.pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,.gif,.bmp,text/plain,text/markdown,application/pdf,image/*'
export const MAX_FILE_MB = 25

export type FileKind = 'pdf' | 'text' | 'image' | 'unsupported'

export function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) return 'image'
  if (file.type.startsWith('text/') || /\.(txt|md|markdown|csv)$/.test(name)) return 'text'
  return 'unsupported'
}

const baseTitle = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Unbenanntes Material'

export async function importFile(file: File, onProgress?: (msg: string, p: number) => void): Promise<ImportResult> {
  const kind = detectKind(file)
  const base = { title: baseTitle(file.name), fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { ...base, text: '', sections: [], status: 'unsupported', method: 'plain-text', warnings: [`Die Datei ist größer als ${MAX_FILE_MB} MB und wurde nicht verarbeitet.`], blob: null, ocrPossible: false }
  }
  if (kind === 'unsupported') {
    return {
      ...base, text: '', sections: [], status: 'unsupported', method: 'plain-text', blob: null, ocrPossible: false,
      warnings: [`Der Dateityp „${file.name.split('.').pop()}“ wird nicht unterstützt. Unterstützt sind PDF, Bilder (PNG, JPG, WebP) sowie Text- und Markdown-Dateien. Tipp: Word-Dokumente als PDF speichern.`],
    }
  }
  if (kind === 'text') {
    const text = (await file.text()).replace(/\r\n?/g, '\n')
    return { ...base, mimeType: file.type || 'text/plain', text, sections: extractSections(text), status: text.trim() ? 'complete' : 'failed', method: 'plain-text', warnings: text.trim() ? [] : ['Die Datei ist leer.'], blob: file, ocrPossible: false }
  }
  if (kind === 'image') {
    return { ...base, text: '', sections: [], status: 'partial', method: 'image-ocr', warnings: ['Bilder enthalten keinen auslesbaren Text. Starte die Texterkennung (OCR), um den Text zu erkennen.'], blob: file, ocrPossible: true }
  }
  // PDF
  onProgress?.('Lese PDF …', 0)
  const { extractPdfText } = await import('./pdf')
  try {
    const res = await extractPdfText(await file.arrayBuffer(), (done, total) => onProgress?.(`Lese Seite ${done} von ${total} …`, done / total))
    const text = res.pages.filter((p) => p.text).map((p) => p.text).join('\n\n')
    const pagesWithText = res.pageCount - res.emptyPages.length
    const warnings: string[] = []
    let status: ExtractionStatus = 'complete'
    if (pagesWithText === 0) {
      status = 'partial'
      warnings.push('Dieses PDF enthält keinen Text – vermutlich ist es eingescannt. Starte die Texterkennung (OCR).')
    } else if (res.emptyPages.length > 0) {
      status = 'partial'
      warnings.push(`Auf ${res.emptyPages.length} von ${res.pageCount} Seiten wurde kein Text gefunden (Seite ${res.emptyPages.join(', ')}). Diese Seiten sind vermutlich Bilder – OCR kann helfen.`)
    }
    warnings.push('Tabellen, Formeln und Abbildungen werden aus PDFs nur als Text übernommen und können unvollständig sein.')
    return { ...base, mimeType: 'application/pdf', text, sections: extractSections(text), status, method: 'pdf-text', pages: res.pageCount, pagesWithText, emptyPages: res.emptyPages, pageTexts: res.pages.map((p) => p.text), warnings, blob: file, ocrPossible: res.emptyPages.length > 0 }
  } catch (e) {
    return { ...base, text: '', sections: [], status: 'failed', method: 'pdf-text', warnings: [`Das PDF konnte nicht gelesen werden: ${e instanceof Error ? e.message : String(e)}. Ist es passwortgeschützt oder beschädigt?`], blob: file, ocrPossible: false }
  }
}
