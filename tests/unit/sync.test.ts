import { beforeEach, describe, expect, it } from 'vitest'
import { db, useTestDatabase as selectTestDb } from '@/db/index'
import * as repo from '@/db/repo'
import * as cal from '@/db/calendar'
import { countMeaningful, runSync, SyncGuardError, type PushRow, type RemoteRow, type RemoteStore, type SyncMode } from '@/lib/sync/engine'
import { dexieLocalStore, getSyncDb, getSyncState, resetSyncState, setSyncState, selectTestSyncDb } from '@/lib/sync/local'
import { hashRecord, stableStringify } from '@/lib/sync/hash'

/** Behaves like public.sync_records: server-assigned increasing timestamps, upsert, tombstones. */
class FakeCloud implements RemoteStore {
  rows = new Map<string, RemoteRow>()
  private t = Date.parse('2026-11-01T10:00:00Z')
  pulls = 0
  async pullSince(since: string | null) {
    this.pulls++
    return [...this.rows.values()].filter((r) => !since || r.updatedAt > since).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map((r) => structuredClone(r))
  }
  async push(rows: PushRow[]) {
    return rows.map((r) => {
      const row: RemoteRow = { table: r.table, id: r.id, data: r.deleted ? null : JSON.parse(JSON.stringify(r.data)), deleted: r.deleted, updatedAt: new Date(this.t++).toISOString() }
      this.rows.set(`${r.table}/${r.id}`, row)
      return structuredClone(row)
    })
  }
  live(table?: string) {
    return [...this.rows.values()].filter((r) => !r.deleted && (!table || r.table === table))
  }
}

let n = 0
const devices = new Map<string, { db: string; sync: string }>()
/** Switches the module-level databases to the given simulated device. */
function on(device: string) {
  if (!devices.has(device)) devices.set(device, { db: `sync-${device}-${n}`, sync: `syncstate-${device}-${n}` })
  const d = devices.get(device)!
  selectTestDb(d.db)
  selectTestSyncDb(d.sync)
}
async function sync(cloud: FakeCloud, mode: SyncMode = 'normal', opts: { force?: boolean } = {}) {
  const st = await getSyncState()
  const res = await runSync({ local: dexieLocalStore, remote: cloud, mode, since: st.lastPulledAt, force: opts.force })
  await setSyncState({ setupDone: true, lastPulledAt: res.lastPulledAt, userId: 'u1' })
  return res
}
const snapshot = async () => {
  const out: Record<string, unknown[]> = {}
  for (const t of ['profile', 'subjects', 'topics', 'notes', 'events', 'tasks', 'cards', 'decks'] as const) out[t] = (await db.table(t).toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)))
  return out
}

beforeEach(() => {
  n++
  devices.clear()
})

describe('hashing', () => {
  it('is independent of key order and ignores undefined (like Postgres jsonb)', () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}')
    expect(hashRecord({ a: 1, b: 2 })).toBe(hashRecord({ b: 2, a: 1 }))
    expect(hashRecord({ a: 1 })).not.toBe(hashRecord({ a: 2 }))
  })
})

describe('sync between PC and phone', () => {
  it('first device uploads, second device downloads, both end identical; edits and deletions travel both ways', async () => {
    const cloud = new FakeCloud()
    on('pc')
    await repo.saveProfile({ name: 'Finn' })
    const sid = await repo.createSubject('Mathematik')
    const tid = await repo.createTopic(sid, 'Pythagoras')
    await repo.saveNote({ title: 'Merkzettel', content: 'a² + b² = c²', subjectId: sid, topicId: tid })
    await cal.saveTask(cal.emptyTask({ title: 'S. 42 Nr. 3', subjectId: sid, dueDate: '2026-11-03' }))
    await cal.saveEvent(cal.emptyEvent('2026-11-02', { title: 'Mathe', category: 'lesson', subjectId: sid, recurrence: { freq: 'weekly', interval: 1, byWeekday: [], until: null, count: null, exceptions: [] } }))
    const up = await sync(cloud, 'merge')
    expect(up.uploaded).toBeGreaterThan(5)
    expect(countMeaningful(cloud.live())).toBeGreaterThanOrEqual(5)
    const pc = await snapshot()

    on('phone')
    const down = await sync(cloud, 'useCloud')
    expect(down.downloaded).toBe(up.uploaded)
    expect(await snapshot()).toEqual(pc)

    // edit on the phone → arrives on the PC
    const note = (await db.notes.toArray())[0]
    await repo.saveNote({ ...note, content: 'a² + b² = c² (nur im rechtwinkligen Dreieck)' })
    await sync(cloud)
    on('pc')
    const r = await sync(cloud)
    expect(r.downloaded).toBe(1)
    expect((await db.notes.toArray())[0].content).toContain('rechtwinkligen')

    // deletion on the PC → tombstone → gone on the phone
    const task = (await db.tasks.toArray())[0]
    await cal.deleteTask(task.id)
    const d = await sync(cloud)
    expect(d.deletedThere).toBe(1)
    on('phone')
    const d2 = await sync(cloud)
    expect(d2.deletedHere).toBe(1)
    expect(await db.tasks.count()).toBe(0)
    // nothing left to do
    const idle = await sync(cloud)
    expect(idle).toMatchObject({ uploaded: 0, downloaded: 0, deletedHere: 0, deletedThere: 0, conflicts: 0 })
  })

  it('concurrent offline edits: the newer version wins, the other is kept as a conflict copy', async () => {
    const cloud = new FakeCloud()
    on('pc')
    const id = await repo.saveNote({ title: 'Vokabeln', content: 'v1' })
    await sync(cloud, 'merge')
    on('phone')
    await sync(cloud, 'useCloud')

    // phone edits first (older), PC edits later (newer) – both offline
    const base = (await db.notes.get(id))!
    await db.notes.put({ ...base, content: 'vom Handy', updatedAt: '2026-11-01T10:00:00.000Z' })
    on('pc')
    await db.notes.put({ ...(await db.notes.get(id))!, content: 'vom PC', updatedAt: '2026-11-01T11:00:00.000Z' })
    await sync(cloud) // PC uploads its newer version
    on('phone')
    const r = await sync(cloud)
    expect(r.conflicts).toBe(1)
    expect((await db.notes.get(id))!.content).toBe('vom PC')
    const [c] = await getSyncDb().conflicts.toArray()
    expect(c).toMatchObject({ table: 'notes', recordId: id, kept: 'remote' })
    expect((c.replaced as { content: string }).content).toBe('vom Handy') // nothing lost
  })

  it('an edit on one device beats a deletion on the other', async () => {
    const cloud = new FakeCloud()
    on('pc')
    const id = await repo.saveNote({ title: 'Wichtig', content: 'x' })
    await sync(cloud, 'merge')
    on('phone')
    await sync(cloud, 'useCloud')
    await repo.deleteNote(id)
    on('pc')
    await repo.saveNote({ ...(await db.notes.get(id))!, content: 'bearbeitet' })
    await sync(cloud)
    on('phone')
    await sync(cloud)
    expect((await db.notes.get(id))?.content).toBe('bearbeitet')
  })

  it('merge never deletes and resolves the same record from two onboardings by recency', async () => {
    const cloud = new FakeCloud()
    on('pc')
    await repo.saveProfile({ name: 'Finn (PC)' })
    await repo.createSubject('Mathematik')
    await sync(cloud, 'merge')
    on('phone')
    await repo.saveProfile({ name: 'Finn (Handy)' }) // later → newer updatedAt
    await repo.createSubject('Englisch')
    const r = await sync(cloud, 'merge')
    expect(r.deletedHere + r.deletedThere).toBe(0)
    expect((await db.subjects.toArray()).map((s) => s.name).sort()).toEqual(['Englisch', 'Mathematik'])
    expect((await db.profile.get('me'))!.name).toBe('Finn (Handy)')
    expect(r.conflicts).toBe(1)
    expect(cloud.live('subjects')).toHaveLength(2)
  })

  it('"Nur Gerät-Daten verwenden" replaces the cloud; the other device follows', async () => {
    const cloud = new FakeCloud()
    on('pc')
    await repo.createSubject('Alt 1')
    await repo.createSubject('Alt 2')
    await sync(cloud, 'merge')
    on('phone')
    await sync(cloud, 'useCloud')
    on('tablet')
    await repo.createSubject('Neu')
    await sync(cloud, 'useLocal')
    expect(cloud.live('subjects').map((r) => (r.data as { name: string }).name)).toEqual(['Neu'])
    on('phone')
    await sync(cloud)
    expect((await db.subjects.toArray()).map((s) => s.name)).toEqual(['Neu'])
  })

  it('stops before writing when a sync would delete unusually much, and continues when confirmed', async () => {
    const cloud = new FakeCloud()
    on('pc')
    for (let i = 0; i < 40; i++) await repo.createSubject(`Fach ${i}`)
    await sync(cloud, 'merge')
    const ids = (await db.subjects.toArray()).slice(0, 30).map((s) => s.id)
    await db.subjects.bulkDelete(ids)
    await expect(sync(cloud)).rejects.toBeInstanceOf(SyncGuardError)
    expect(cloud.live('subjects')).toHaveLength(40) // nothing was written
    await sync(cloud, 'normal', { force: true })
    expect(cloud.live('subjects')).toHaveLength(10)
  })

  it('after a restore (reset state) the next sync merges instead of pushing deletions', async () => {
    const cloud = new FakeCloud()
    on('pc')
    await repo.createSubject('A')
    await repo.createSubject('B')
    await sync(cloud, 'merge')
    // restore an older backup that only has "A"
    await db.subjects.filter((s) => s.name === 'B').delete()
    await resetSyncState('u1')
    const r = await sync(cloud, 'merge')
    expect(r.deletedThere).toBe(0)
    expect((await db.subjects.toArray()).map((s) => s.name).sort()).toEqual(['A', 'B'])
  })

  it('original files stay on their device; the extracted text syncs', async () => {
    const cloud = new FakeCloud()
    on('pc')
    const mid = await repo.addMaterial({
      subjectId: null, topicId: null, title: 'Arbeitsblatt', fileName: 'ab.pdf', mimeType: 'application/pdf', size: 10, text: 'Photosynthese\u0000 Text',
      sections: [], extraction: { status: 'complete', method: 'pdf-text', warnings: [] }, summary: '', summarySource: 'none', tags: [],
    }, new Blob(['%PDF']))
    expect((await db.materials.get(mid))!.hasBlob).toBe(true)
    await sync(cloud, 'merge')
    const row = cloud.live('materials')[0]
    expect(row.data).toMatchObject({ hasBlob: false, text: 'Photosynthese Text' }) // NUL removed for Postgres
    expect((await db.materials.get(mid))!.hasBlob).toBe(true) // still true here
    on('phone')
    await sync(cloud, 'useCloud')
    expect((await db.materials.get(mid))!).toMatchObject({ hasBlob: false, text: 'Photosynthese Text' })
    // a later sync on the PC does not take its file flag away
    on('pc')
    await sync(cloud)
    expect((await db.materials.get(mid))!.hasBlob).toBe(true)
  })

  it('incremental pulls only download what changed', async () => {
    const cloud = new FakeCloud()
    on('pc')
    for (let i = 0; i < 5; i++) await repo.createSubject(`F${i}`)
    await sync(cloud, 'merge')
    on('phone')
    await sync(cloud, 'useCloud')
    on('pc')
    await repo.createSubject('F5')
    await sync(cloud)
    on('phone')
    const st = await getSyncState()
    const pulled = await cloud.pullSince(st.lastPulledAt)
    expect(pulled.map((r) => (r.data as { name?: string })?.name)).toEqual(['F5'])
    const r = await sync(cloud)
    expect(r.downloaded).toBe(1)
  })
})
