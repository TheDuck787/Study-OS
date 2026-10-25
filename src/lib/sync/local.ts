import Dexie, { type Table } from 'dexie'
import { db } from '@/db/index'
import { DELETED, SYNC_TABLES, type Conflict, type Data, type LocalRecord, type LocalStore, type ShadowEntry, type SyncTable } from './engine'

/**
 * Sync bookkeeping lives in its own small database, so backups, restores and "Alles löschen" of the learning
 * data never mix with it.
 */
export interface SyncState {
  key: 'state'
  userId: string | null
  setupDone: boolean
  lastPulledAt: string | null
  lastSyncAt: string | null
}

export interface SafetyBackup {
  id: string
  at: string
  reason: string
  /** A complete Study OS backup (JSON) that "Sicherung wiederherstellen" can read. */
  json: string
}

class SyncDB extends Dexie {
  shadow!: Table<ShadowEntry, string>
  state!: Table<SyncState, string>
  conflicts!: Table<Conflict, string>
  backups!: Table<SafetyBackup, string>
  constructor(name: string) {
    super(name)
    this.version(1).stores({ shadow: 'key', state: 'key', conflicts: 'id, at', backups: 'id, at' })
  }
}

let syncDb = new SyncDB('studyos-sync')
export const getSyncDb = () => syncDb
/** For tests. */
export function selectTestSyncDb(name: string) {
  syncDb = new SyncDB(name)
  return syncDb
}

const EMPTY_STATE: SyncState = { key: 'state', userId: null, setupDone: false, lastPulledAt: null, lastSyncAt: null }

export async function getSyncState(): Promise<SyncState> {
  return (await syncDb.state.get('state')) ?? EMPTY_STATE
}

export async function setSyncState(patch: Partial<SyncState>) {
  await syncDb.state.put({ ...(await getSyncState()), ...patch, key: 'state' })
}

/** After restore/wipe or a new account: forget what was synced, so the next sync asks before merging. */
export async function resetSyncState(userId: string | null = null) {
  await syncDb.transaction('rw', syncDb.shadow, syncDb.state, async () => {
    await syncDb.shadow.clear()
    await syncDb.state.put({ ...EMPTY_STATE, userId })
  })
}

/** Removes characters Postgres jsonb cannot store (NUL) and fields that only make sense on this device. */
function clean(v: unknown): unknown {
  if (typeof v === 'string') return v.includes('\u0000') ? v.split('\u0000').join('') : v
  if (Array.isArray(v)) return v.map(clean)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = clean(x)
    return out
  }
  return v
}

export function toRemote(table: SyncTable, rec: Data): Data {
  const d = clean(rec) as Data
  // original files (PDFs, photos) stay on the device that imported them – the extracted text syncs
  if (table === 'materials') d.hasBlob = false
  return d
}

function fromRemote(table: SyncTable, data: Data, existing: Data | undefined, blobIds: Set<string>): Data {
  if (table === 'materials') return { ...data, hasBlob: !!existing?.hasBlob && blobIds.has(String(data.id)) }
  return data
}

export const recordId = (table: SyncTable, rec: Data) => String(table === 'meta' ? rec.key : rec.id)

export const dexieLocalStore: LocalStore = {
  async readAll() {
    const out: LocalRecord[] = []
    for (const t of SYNC_TABLES) {
      const rows = (await db.table(t).toArray()) as Data[]
      for (const r of rows) out.push({ table: t, id: recordId(t, r), data: toRemote(t, r) })
    }
    return out
  },
  async apply(puts, deletes) {
    if (!puts.length && !deletes.length) return
    const tables = [...new Set([...puts.map((p) => p.table), ...deletes.map((d) => d.table)])]
    const blobIds = new Set((await db.materialBlobs.toCollection().primaryKeys()) as string[])
    await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
      for (const t of tables) {
        const tablePuts = puts.filter((p) => p.table === t)
        const existing = t === 'materials' ? new Map(((await db.materials.bulkGet(tablePuts.map((p) => p.id))) as (Data | undefined)[]).map((e, i) => [tablePuts[i].id, e])) : new Map<string, Data | undefined>()
        if (tablePuts.length) await db.table(t).bulkPut(tablePuts.map((p) => fromRemote(t, p.data, existing.get(p.id), blobIds)))
        const del = deletes.filter((d) => d.table === t).map((d) => d.id)
        if (del.length) await db.table(t).bulkDelete(del)
      }
    })
  },
  async getShadow() {
    return new Map((await syncDb.shadow.toArray()).map((s) => [s.key, s]))
  },
  async putShadow(entries, removeKeys) {
    await syncDb.transaction('rw', syncDb.shadow, async () => {
      if (entries.length) await syncDb.shadow.bulkPut(entries)
      if (removeKeys.length) await syncDb.shadow.bulkDelete(removeKeys)
    })
  },
  async clearShadow() {
    await syncDb.shadow.clear()
  },
  async addConflicts(c) {
    await syncDb.conflicts.bulkPut(c)
  },
}

export async function storeSafetyBackup(reason: string, json: string): Promise<SafetyBackup> {
  const b: SafetyBackup = { id: `bk_${Date.now().toString(36)}`, at: new Date().toISOString(), reason, json }
  await syncDb.transaction('rw', syncDb.backups, async () => {
    await syncDb.backups.add(b)
    // keep the five newest
    const old = await syncDb.backups.orderBy('at').reverse().offset(5).primaryKeys()
    await syncDb.backups.bulkDelete(old as string[])
  })
  return b
}

/** Restores the replaced version of a conflict (it then syncs as a normal local change). */
export async function restoreConflict(c: Conflict) {
  if (c.replaced) await db.table(c.table).put(c.replaced)
  await syncDb.conflicts.delete(c.id)
}

export { DELETED }
