import { z } from 'zod'
import { db, activeKind } from '@/db/index'

export const BACKUP_VERSION = 1

const TABLES = [
  'profile', 'subjects', 'topics', 'notes', 'materials', 'decks', 'cards', 'cardReviews', 'questions', 'attempts', 'answers',
  'exams', 'gradingScales', 'teacherGrades', 'sessions', 'xpEvents', 'achievements', 'tutorChats', 'meta',
] as const
type TableName = (typeof TABLES)[number]

/** Fields every row of a table must have – a light sanity check against foreign or damaged files. */
const REQUIRED: Partial<Record<TableName, string[]>> = {
  subjects: ['id', 'name'],
  topics: ['id', 'subjectId', 'name'],
  notes: ['id', 'title', 'content'],
  materials: ['id', 'title', 'text'],
  decks: ['id', 'name'],
  cards: ['id', 'deckId', 'front', 'back', 'srs'],
  questions: ['id', 'subjectId', 'topicId', 'type', 'prompt'],
  attempts: ['id', 'questionIds', 'startedAt'],
  answers: ['id', 'attemptId', 'questionId', 'topicId', 'at'],
  exams: ['id', 'subjectId', 'date', 'plan'],
  meta: ['key'],
}

const backupSchema = z.object({
  app: z.literal('study-os'),
  version: z.number().int(),
  exportedAt: z.string(),
  database: z.enum(['main', 'demo']),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
  files: z.array(z.object({ id: z.string(), type: z.string(), base64: z.string() })).optional(),
})
export type Backup = z.infer<typeof backupSchema>

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

export async function exportBackup(includeFiles: boolean): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const t of TABLES) tables[t] = await db.table(t).toArray()
  const backup: Backup = { app: 'study-os', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), database: activeKind, tables: tables as Backup['tables'] }
  if (includeFiles) {
    const blobs = await db.materialBlobs.toArray()
    backup.files = await Promise.all(blobs.map(async (b) => ({ id: b.id, type: b.blob.type, base64: await blobToBase64(b.blob) })))
  }
  return JSON.stringify(backup)
}

export interface BackupCheck {
  ok: boolean
  error?: string
  backup?: Backup
  counts?: Record<string, number>
}

export function checkBackup(text: string): BackupCheck {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Das ist keine Study-OS-Sicherung (falsches Format).' }
  const b = parsed.data
  if (b.version > BACKUP_VERSION) return { ok: false, error: 'Die Sicherung stammt aus einer neueren Version von Study OS.' }
  const counts: Record<string, number> = {}
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(TABLES as readonly string[]).includes(name)) return { ok: false, error: `Unbekannte Tabelle „${name}“ in der Sicherung.` }
    const req = REQUIRED[name as TableName] ?? ['id']
    for (const row of rows) {
      for (const k of req) if (!(k in row)) return { ok: false, error: `Beschädigter Eintrag in „${name}“ (Feld „${k}“ fehlt).` }
    }
    counts[name] = rows.length
  }
  return { ok: true, backup: b, counts }
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** Replaces ALL data of the active database with the backup. */
export async function restoreBackup(b: Backup) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    for (const [name, rows] of Object.entries(b.tables)) if (rows.length) await db.table(name).bulkPut(rows)
    if (b.files) for (const f of b.files) await db.materialBlobs.put({ id: f.id, blob: base64ToBlob(f.base64, f.type) })
    // materials whose file was not part of the backup lose their file reference
    const fileIds = new Set((b.files ?? []).map((f) => f.id))
    await db.materials.toCollection().modify((m) => {
      if (m.hasBlob && !fileIds.has(m.id)) m.hasBlob = false
    })
  })
}

export async function wipeDatabase() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}
