import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushRow, RemoteRow, RemoteStore, SyncTable } from '@/lib/sync/engine'

const TABLE = 'sync_records'
const PAGE = 1000

export class CloudError extends Error {
  constructor(message: string, public code: 'missing-table' | 'auth' | 'network' | 'quota' | 'unknown') {
    super(message)
    this.name = 'CloudError'
  }
}

function toCloudError(e: { message?: string; code?: string; status?: number } | null | undefined): CloudError {
  const msg = e?.message ?? ''
  if (e?.code === '42P01' || e?.code === 'PGRST205' || /sync_records/.test(msg) && /does not exist|not find/i.test(msg)) return new CloudError('Die Cloud-Datenbank ist noch nicht eingerichtet (Tabelle sync_records fehlt). Die Migration muss im Supabase-Projekt angewendet werden.', 'missing-table')
  if (e?.status === 401 || e?.code === 'PGRST301' || /JWT|not authenticated|permission denied/i.test(msg)) return new CloudError('Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.', 'auth')
  if (/Failed to fetch|NetworkError|network|fetch/i.test(msg)) return new CloudError('Keine Verbindung zur Cloud. Es wird später erneut versucht.', 'network')
  if (/payload|too large|size/i.test(msg)) return new CloudError('Ein Eintrag ist zu groß für die Cloud.', 'quota')
  return new CloudError(`Cloud-Fehler: ${msg || 'unbekannt'}`, 'unknown')
}

interface Row {
  table_name: string
  record_id: string
  data: Record<string, unknown> | null
  deleted: boolean
  updated_at: string
}

const fromRow = (r: Row): RemoteRow => ({ table: r.table_name as SyncTable, id: r.record_id, data: r.data, deleted: r.deleted, updatedAt: r.updated_at })

export function supabaseRemote(sb: SupabaseClient, userId: string, deviceId: string): RemoteStore & { deleteAll(): Promise<void>; countLive(): Promise<number> } {
  return {
    async pullSince(since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = sb.from(TABLE).select('table_name,record_id,data,deleted,updated_at').order('updated_at', { ascending: true }).order('table_name').order('record_id').range(from, from + PAGE - 1)
        if (since) q = q.gt('updated_at', since)
        const { data, error } = await q
        if (error) throw toCloudError(error)
        out.push(...(data as Row[]).map(fromRow))
        if (!data || data.length < PAGE) break
      }
      return out
    },
    async push(rows: PushRow[]) {
      if (!rows.length) return []
      const { data, error } = await sb
        .from(TABLE)
        .upsert(rows.map((r) => ({ user_id: userId, table_name: r.table, record_id: r.id, data: r.deleted ? null : r.data, deleted: r.deleted, device_id: deviceId })), { onConflict: 'user_id,table_name,record_id' })
        .select('table_name,record_id,data,deleted,updated_at')
      if (error) throw toCloudError(error)
      return (data as Row[]).map(fromRow)
    },
    async deleteAll() {
      const { error } = await sb.from(TABLE).delete().eq('user_id', userId)
      if (error) throw toCloudError(error)
    },
    async countLive() {
      const { count, error } = await sb.from(TABLE).select('record_id', { count: 'exact', head: true }).eq('deleted', false)
      if (error) throw toCloudError(error)
      return count ?? 0
    },
  }
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem('studyos.deviceId')
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
      localStorage.setItem('studyos.deviceId', id)
    }
    return id
  } catch {
    return 'dev_unknown'
  }
}
