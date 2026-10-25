import { hashRecord } from './hash'

/**
 * Local-first sync between this browser's IndexedDB and the user's rows in Supabase (`sync_records`).
 *
 * Every record is compared with a "shadow" entry: the content hash it had at the last successful sync.
 * - changed only here  → upload
 * - changed only there → download
 * - changed on both    → conflict: the newer `updatedAt` wins (edits beat deletions); the other version is
 *                        stored as a conflict copy so nothing is lost silently.
 * Deletions travel as tombstones. Nothing in here touches the network or IndexedDB directly – the stores are
 * injected, which keeps the algorithm unit-testable.
 */

export const SYNC_TABLES = [
  'profile', 'subjects', 'topics', 'notes', 'materials', 'decks', 'cards', 'cardReviews', 'questions', 'attempts', 'answers',
  'exams', 'gradingScales', 'teacherGrades', 'sessions', 'xpEvents', 'achievements', 'tutorChats', 'meta', 'events', 'tasks', 'eventCategories',
] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

/** Tables that count as "real learning data" when deciding whether a device or account is empty. */
export const MEANINGFUL_TABLES: SyncTable[] = ['profile', 'subjects', 'topics', 'notes', 'materials', 'decks', 'cards', 'answers', 'exams', 'events', 'tasks', 'teacherGrades', 'tutorChats']

export type Data = Record<string, unknown>

export interface LocalRecord {
  table: SyncTable
  id: string
  /** Already in the form that is stored remotely (see toRemote in local.ts). */
  data: Data
}

export interface RemoteRow {
  table: SyncTable
  id: string
  data: Data | null
  deleted: boolean
  updatedAt: string
}

export interface PushRow {
  table: SyncTable
  id: string
  data: Data | null
  deleted: boolean
}

export interface ShadowEntry {
  key: string
  hash: string
  remoteAt: string
}

export interface Conflict {
  id: string
  table: SyncTable
  recordId: string
  /** Which version was kept automatically. */
  kept: 'local' | 'remote'
  /** The version that was replaced (null = it was a deletion). */
  replaced: Data | null
  at: string
}

export interface RemoteStore {
  /** Rows changed since the timestamp (null = everything), including tombstones. */
  pullSince(since: string | null): Promise<RemoteRow[]>
  /** Upserts rows and returns them with the server timestamp. */
  push(rows: PushRow[]): Promise<RemoteRow[]>
}

export interface LocalStore {
  readAll(): Promise<LocalRecord[]>
  apply(puts: LocalRecord[], deletes: { table: SyncTable; id: string }[]): Promise<void>
  getShadow(): Promise<Map<string, ShadowEntry>>
  putShadow(entries: ShadowEntry[], removeKeys: string[]): Promise<void>
  clearShadow(): Promise<void>
  addConflicts(c: Conflict[]): Promise<void>
}

export type SyncMode = 'normal' | 'merge' | 'useCloud' | 'useLocal'

export interface SyncResult {
  uploaded: number
  downloaded: number
  deletedHere: number
  deletedThere: number
  conflicts: number
  lastPulledAt: string | null
}

/** Thrown before anything is written when a sync would delete unusually much – the user has to confirm. */
export class SyncGuardError extends Error {
  constructor(public where: 'local' | 'remote', public count: number, public total: number) {
    super(`Synchronisierung angehalten: ${count} von ${total} Einträgen würden ${where === 'local' ? 'auf diesem Gerät' : 'in deinem Konto'} gelöscht.`)
    this.name = 'SyncGuardError'
  }
}

export const DELETED = '__deleted__'
export const keyOf = (table: string, id: string) => `${table}/${id}`

function updatedAtOf(d: Data | null): number | null {
  const v = d && (d.updatedAt ?? d.updated_at)
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

let seq = 0
const conflictId = () => `cf_${Date.now().toString(36)}_${(seq++).toString(36)}`

export interface RunOptions {
  local: LocalStore
  remote: RemoteStore
  mode: SyncMode
  since: string | null
  /** Already downloaded rows (setup dialog) – avoids a second download. */
  prefetched?: RemoteRow[]
  /** Skip the mass-deletion guard (after the user confirmed). */
  force?: boolean
  now?: Date
}

export async function runSync(o: RunOptions): Promise<SyncResult> {
  const now = (o.now ?? new Date()).toISOString()
  if (o.mode === 'merge' || o.mode === 'useCloud' || o.mode === 'useLocal') await o.local.clearShadow()
  const [remoteRows, localRecords, shadow] = await Promise.all([
    o.prefetched ?? o.remote.pullSince(o.mode === 'normal' ? o.since : null),
    o.local.readAll(),
    o.local.getShadow(),
  ])
  // newest row per key (pages may overlap)
  const remote = new Map<string, RemoteRow>()
  for (const r of remoteRows) {
    const k = keyOf(r.table, r.id)
    const prev = remote.get(k)
    if (!prev || prev.updatedAt <= r.updatedAt) remote.set(k, r)
  }
  const local = new Map(localRecords.map((r) => [keyOf(r.table, r.id), { ...r, hash: hashRecord(r.data) }]))

  const push: PushRow[] = []
  const puts: LocalRecord[] = []
  const deletes: { table: SyncTable; id: string }[] = []
  const conflicts: Conflict[] = []
  const shadowUpdates: ShadowEntry[] = []
  const shadowRemovals: string[] = []
  let maxAt: string | null = null
  for (const r of remoteRows) if (!maxAt || r.updatedAt > maxAt) maxAt = r.updatedAt

  const keys = new Set<string>([...local.keys(), ...remote.keys(), ...(o.mode === 'normal' ? shadow.keys() : [])])
  for (const k of keys) {
    const L = local.get(k)
    const R = remote.get(k)
    const S = o.mode === 'normal' ? shadow.get(k) : undefined
    const [table, ...rest] = k.split('/')
    const id = rest.join('/')
    const t = table as SyncTable
    const remoteHash = R ? (R.deleted ? DELETED : hashRecord(R.data)) : undefined

    if (o.mode === 'useCloud') {
      if (R && !R.deleted) {
        if (!L || L.hash !== remoteHash) puts.push({ table: t, id, data: R.data! })
        shadowUpdates.push({ key: k, hash: remoteHash!, remoteAt: R.updatedAt })
      } else {
        if (L) deletes.push({ table: t, id })
        if (R) shadowUpdates.push({ key: k, hash: DELETED, remoteAt: R.updatedAt })
      }
      continue
    }
    if (o.mode === 'useLocal') {
      if (L) {
        if (remoteHash !== L.hash) push.push({ table: t, id, data: L.data, deleted: false })
        else shadowUpdates.push({ key: k, hash: L.hash, remoteAt: R!.updatedAt })
      } else if (R && !R.deleted) push.push({ table: t, id, data: null, deleted: true })
      continue
    }

    const localChanged = L ? !S || S.hash !== L.hash : !!S && S.hash !== DELETED
    const remoteChanged = !!R && (S ? S.hash !== remoteHash : true)
    if (!localChanged && !remoteChanged) continue
    // identical on both sides (e.g. first sync of the same data, or built-in grading scales)
    if (L && R && !R.deleted && L.hash === remoteHash) {
      shadowUpdates.push({ key: k, hash: L.hash, remoteAt: R.updatedAt })
      continue
    }
    if (!L && R?.deleted) {
      shadowUpdates.push({ key: k, hash: DELETED, remoteAt: R.updatedAt })
      continue
    }
    const takeRemote = () => {
      if (R!.deleted) {
        if (L) deletes.push({ table: t, id })
        shadowUpdates.push({ key: k, hash: DELETED, remoteAt: R!.updatedAt })
      } else {
        puts.push({ table: t, id, data: R!.data! })
        shadowUpdates.push({ key: k, hash: remoteHash!, remoteAt: R!.updatedAt })
      }
    }
    const takeLocal = () => push.push(L ? { table: t, id, data: L.data, deleted: false } : { table: t, id, data: null, deleted: true })

    if (localChanged && !remoteChanged) {
      // without shadow (merge) a missing local record is not a deletion
      if (!L && !S) continue
      takeLocal()
    } else if (!localChanged && remoteChanged) {
      takeRemote()
    } else {
      // changed on both sides → keep the newer version, edits beat deletions, keep a copy of the other
      const lData = L?.data ?? null
      const rData = R && !R.deleted ? R.data : null
      let keepLocal: boolean
      if (!lData) keepLocal = false
      else if (!rData) keepLocal = true
      else {
        const lt = updatedAtOf(lData)
        const rt = updatedAtOf(rData)
        keepLocal = lt !== null && rt !== null ? lt > rt : false
      }
      const replaced = keepLocal ? rData : lData
      if (replaced) conflicts.push({ id: conflictId(), table: t, recordId: id, kept: keepLocal ? 'local' : 'remote', replaced, at: now })
      if (keepLocal) takeLocal()
      else takeRemote()
    }
  }

  // Safety net: unusually many deletions stop the sync before anything is written.
  if (!o.force && o.mode === 'normal') {
    const remoteDeletes = push.filter((p) => p.deleted).length
    const known = Math.max(shadow.size, 1)
    if (remoteDeletes > 20 && remoteDeletes > known * 0.5) throw new SyncGuardError('remote', remoteDeletes, known)
    if (deletes.length > 20 && deletes.length > local.size * 0.5) throw new SyncGuardError('local', deletes.length, local.size)
  }

  // Upload first: if it fails, nothing local has changed yet.
  let uploaded = 0
  for (let i = 0; i < push.length; i += 200) {
    const res = await o.remote.push(push.slice(i, i + 200))
    for (const r of res) {
      shadowUpdates.push({ key: keyOf(r.table, r.id), hash: r.deleted ? DELETED : hashRecord(r.data), remoteAt: r.updatedAt })
      if (!maxAt || r.updatedAt > maxAt) maxAt = r.updatedAt
    }
    uploaded += res.length
  }
  await o.local.apply(puts, deletes)
  for (const k of keys) if (!local.has(k) && !remote.has(k) && o.mode === 'normal' && shadow.get(k)?.hash === DELETED) shadowRemovals.push(k)
  await o.local.putShadow(shadowUpdates, shadowRemovals)
  if (conflicts.length) await o.local.addConflicts(conflicts)
  return {
    uploaded,
    downloaded: puts.length,
    deletedHere: deletes.length,
    deletedThere: push.filter((p) => p.deleted).length,
    conflicts: conflicts.length,
    lastPulledAt: maxAt ?? o.since,
  }
}

/** Counts meaningful records (used to decide whether a device or the account already holds data). */
export function countMeaningful(rows: { table: string; deleted?: boolean }[]): number {
  return rows.filter((r) => !r.deleted && (MEANINGFUL_TABLES as string[]).includes(r.table)).length
}
