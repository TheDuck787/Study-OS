import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Dexie from 'dexie'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { activeKind } from '@/db/index'
import { useToast } from '@/components/ui'
import { exportBackup, wipeDatabase, BACKUP_VERSION } from '@/lib/backup'
import { loadCloudConfig, type CloudConfig } from '@/lib/cloud/config'
import { authErrorFromUrl, cleanAuthParams, getSupabase, redirectUrl, RETURN_KEY } from '@/lib/cloud/client'
import { CloudError, deviceId, supabaseRemote } from '@/lib/cloud/remote'
import { countMeaningful, runSync, SyncGuardError, type RemoteRow, type SyncMode, type SyncResult } from '@/lib/sync/engine'
import { dexieLocalStore, getSyncState, resetSyncState, setSyncState, storeSafetyBackup } from '@/lib/sync/local'
import { SyncSetupDialog, type SetupInfo } from './SyncSetupDialog'
import { SyncGuardDialog } from './SyncGuardDialog'

export type CloudPhase = 'disabled' | 'loading' | 'signedOut' | 'signedIn'
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'setup' | 'confirm'

export interface CloudUser {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}

interface CloudCtx {
  phase: CloudPhase
  /** Why sync is unavailable (phase "disabled"). */
  reason: string | null
  user: CloudUser | null
  sync: { state: SyncState; lastSyncAt: string | null; message: string | null; last: SyncResult | null }
  signIn: () => Promise<void>
  signOut: (opts?: { wipeLocal?: boolean }) => Promise<void>
  syncNow: () => Promise<void>
  openSetup: () => void
  /** After a backup was restored on this device: next sync asks how to combine it with the cloud. */
  afterLocalReplaced: () => Promise<void>
  /** "Alles löschen" while signed in. */
  wipeEverything: (alsoCloud: boolean) => Promise<void>
  deleteCloudData: () => Promise<void>
}

const Ctx = createContext<CloudCtx | null>(null)
export const useCloud = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCloud outside CloudProvider')
  return c
}

const toUser = (u: User): CloudUser => ({
  id: u.id,
  email: u.email ?? null,
  name: (u.user_metadata?.full_name as string | undefined) ?? (u.user_metadata?.name as string | undefined) ?? null,
  avatar: (u.user_metadata?.avatar_url as string | undefined) ?? (u.user_metadata?.picture as string | undefined) ?? null,
})

/** Overlap when pulling, so rows committed slightly out of order are never missed (duplicates are harmless). */
const OVERLAP_MS = 10 * 60_000
const sinceWithOverlap = (iso: string | null) => (iso ? new Date(Date.parse(iso) - OVERLAP_MS).toISOString() : null)

/** Remote rows → a normal Study OS backup file, so a cloud safety copy can be restored like any backup. */
function rowsToBackup(rows: RemoteRow[]): string {
  const tables: Record<string, unknown[]> = {}
  for (const r of rows) if (!r.deleted && r.data) (tables[r.table] ??= []).push(r.data)
  return JSON.stringify({ app: 'study-os', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), database: 'main', tables })
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [phase, setPhase] = useState<CloudPhase>(activeKind === 'demo' ? 'disabled' : 'loading')
  const [reason, setReason] = useState<string | null>(activeKind === 'demo' ? 'In der Demo wird nichts mit deinem Konto synchronisiert.' : null)
  const [user, setUser] = useState<CloudUser | null>(null)
  const [sync, setSync] = useState<CloudCtx['sync']>({ state: 'idle', lastSyncAt: null, message: null, last: null })
  const [setup, setSetup] = useState<SetupInfo | null>(null)
  const [guard, setGuard] = useState<SyncGuardError | null>(null)
  const sbRef = useRef<SupabaseClient | null>(null)
  const cfgRef = useRef<CloudConfig | null>(null)
  const running = useRef<Promise<void> | null>(null)
  const again = useRef(false)

  const remote = useCallback(() => (sbRef.current && user ? supabaseRemote(sbRef.current, user.id, deviceId()) : null), [user])

  const fail = useCallback((e: unknown) => {
    if (e instanceof SyncGuardError) {
      setGuard(e)
      setSync((s) => ({ ...s, state: 'confirm', message: e.message }))
      return
    }
    const ce = e instanceof CloudError ? e : new CloudError(e instanceof Error ? e.message : String(e), 'unknown')
    setSync((s) => ({ ...s, state: ce.code === 'network' || !navigator.onLine ? 'offline' : 'error', message: ce.message }))
    if (ce.code === 'auth') sbRef.current?.auth.refreshSession().catch(() => undefined)
  }, [])

  /** First sync for this account on this device: decide (or ask) how local and cloud data come together. */
  const prepareSetup = useCallback(async (r: NonNullable<ReturnType<typeof remote>>, u: CloudUser) => {
    const st = await getSyncState()
    const otherAccount = !!st.userId && st.userId !== u.id
    if (st.userId !== u.id) await resetSyncState(u.id)
    const [rows, local] = await Promise.all([r.pullSince(null), dexieLocalStore.readAll()])
    const localCount = countMeaningful(local)
    const cloudCount = countMeaningful(rows)
    if (localCount === 0 && cloudCount === 0) return { auto: 'merge' as SyncMode, rows }
    if (localCount === 0) return { auto: 'useCloud' as SyncMode, rows }
    setSetup({ localCount, cloudCount, otherAccount, rows, email: u.email })
    setSync((s) => ({ ...s, state: 'setup', message: 'Bitte entscheide, wie deine Daten zusammengeführt werden.' }))
    return null
  }, [])

  const doSync = useCallback(async (mode?: SyncMode, opts: { force?: boolean; prefetched?: RemoteRow[] } = {}) => {
    const r = remote()
    if (!r || !user || activeKind === 'demo') return
    setSync((s) => ({ ...s, state: 'syncing', message: null }))
    try {
      const st = await getSyncState()
      let m = mode
      let prefetched = opts.prefetched
      if (!m && (!st.setupDone || st.userId !== user.id)) {
        const plan = await prepareSetup(r, user)
        if (!plan) return
        m = plan.auto
        prefetched = plan.rows
      }
      const result = await runSync({ local: dexieLocalStore, remote: r, mode: m ?? 'normal', since: sinceWithOverlap(st.lastPulledAt), prefetched, force: opts.force })
      const now = new Date().toISOString()
      await setSyncState({ userId: user.id, setupDone: true, lastPulledAt: result.lastPulledAt, lastSyncAt: now })
      setSync({ state: 'idle', lastSyncAt: now, message: null, last: result })
      if (m === 'useCloud' && result.downloaded > 0) toast({ title: 'Daten aus deinem Konto geladen', description: `${result.downloaded} Einträge auf dieses Gerät übertragen.`, tone: 'success' })
      if (result.conflicts > 0) toast({ title: `${result.conflicts} Konflikt${result.conflicts === 1 ? '' : 'e'} gelöst`, description: 'Die neuere Version wurde behalten, die andere liegt unter Einstellungen → Konto.', tone: 'accent' })
    } catch (e) {
      fail(e)
    }
  }, [remote, user, prepareSetup, fail, toast])

  /** Serialises syncs (also across tabs via the Web Locks API) and coalesces requests. */
  const syncNow = useCallback(async (): Promise<void> => {
    if (running.current) {
      again.current = true
      return running.current
    }
    const exec = async () => {
      do {
        again.current = false
        await doSync()
      } while (again.current)
    }
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    const p: Promise<void> = (locks ? (locks.request('studyos-sync', exec) as Promise<unknown>) : exec()).then(() => undefined).finally(() => {
      running.current = null
    })
    running.current = p
    return p
  }, [doSync])

  // ── Boot: config, session, redirect handling ──
  useEffect(() => {
    if (activeKind === 'demo') return
    let unsub: (() => void) | undefined
    let alive = true
    ;(async () => {
      const urlError = authErrorFromUrl()
      const { config, reason: why } = await loadCloudConfig()
      if (!alive) return
      if (!config) {
        setPhase('disabled')
        setReason(why ?? 'Die Cloud-Synchronisierung ist nicht eingerichtet.')
        if (urlError) cleanAuthParams()
        return
      }
      cfgRef.current = config
      try {
        const sb = await getSupabase(config)
        sbRef.current = sb
        const { data } = await sb.auth.getSession() // also completes the ?code= exchange after the Google redirect
        if (!alive) return
        cleanAuthParams()
        if (urlError) toast({ title: 'Anmeldung nicht möglich', description: urlError, tone: 'danger' })
        const u = data.session?.user
        setUser(u ? toUser(u) : null)
        setPhase(u ? 'signedIn' : 'signedOut')
        const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
          const next = session?.user ? toUser(session.user) : null
          setUser((prev) => (prev?.id === next?.id ? prev : next))
          setPhase(next ? 'signedIn' : 'signedOut')
          if (event === 'SIGNED_IN' && next) toast({ title: 'Angemeldet', description: next.email ?? undefined, tone: 'success' })
        })
        unsub = () => sub.subscription.unsubscribe()
      } catch (e) {
        setPhase('disabled')
        setReason(`Die Anmeldung konnte nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()
    getSyncState().then((s) => setSync((x) => ({ ...x, lastSyncAt: s.lastSyncAt })))
    return () => {
      alive = false
      unsub?.()
    }
  }, [toast])

  // ── Automatic sync: on sign-in, when online/visible again, after local changes, every minute ──
  useEffect(() => {
    if (phase !== 'signedIn' || !user) return
    syncNow()
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => syncNow(), ms)
    }
    const onMutate = (parts: Record<string, unknown>) => {
      if (running.current) return // our own writes while applying cloud changes
      if (Object.keys(parts).some((k) => k.startsWith('idb://studyos-main/'))) soon(4000)
    }
    const onVisible = () => document.visibilityState === 'visible' && soon(300)
    const onOnline = () => soon(500)
    Dexie.on('storagemutated', onMutate)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    const iv = setInterval(() => document.visibilityState === 'visible' && navigator.onLine && syncNow(), 60_000)
    return () => {
      clearTimeout(timer)
      clearInterval(iv)
      Dexie.on('storagemutated').unsubscribe(onMutate)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [phase, user, syncNow])

  const signIn = useCallback(async () => {
    const sb = sbRef.current
    if (!sb) {
      toast({ title: 'Anmeldung nicht verfügbar', description: reason ?? undefined, tone: 'danger' })
      return
    }
    try {
      sessionStorage.setItem(RETURN_KEY, location.hash || '#/')
    } catch {
      /* ignore */
    }
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } } })
    if (error) toast({ title: 'Anmeldung fehlgeschlagen', description: error.message, tone: 'danger' })
  }, [reason, toast])

  const signOut = useCallback(async (opts: { wipeLocal?: boolean } = {}) => {
    // last chance to upload pending changes (ignored when offline)
    if (!opts.wipeLocal) await syncNow().catch(() => undefined)
    await sbRef.current?.auth.signOut({ scope: 'local' })
    setUser(null)
    setPhase('signedOut')
    setSync({ state: 'idle', lastSyncAt: null, message: null, last: null })
    if (opts.wipeLocal) {
      await wipeDatabase()
      await resetSyncState()
      location.hash = '#/'
      location.reload()
    }
  }, [syncNow])

  const runSetup = useCallback(async (mode: SyncMode | 'later') => {
    const info = setup
    setSetup(null)
    if (!info || !user) return
    if (mode === 'later') {
      setSync((s) => ({ ...s, state: 'setup', message: 'Synchronisierung pausiert – sie startet, sobald du entscheidest, wie die Daten zusammengeführt werden.' }))
      return
    }
    // Safety copies before anything is replaced – stored on this device and restorable like any backup.
    if (mode === 'useCloud') await storeSafetyBackup('Gerätedaten vor „Nur Konto-Daten verwenden“', await exportBackup(false))
    if (mode === 'useLocal') await storeSafetyBackup('Konto-Daten vor „Nur Gerät-Daten verwenden“', rowsToBackup(info.rows))
    if (mode === 'merge') await storeSafetyBackup('Gerätedaten vor dem ersten Zusammenführen', await exportBackup(false))
    await doSync(mode, { prefetched: info.rows })
  }, [setup, user, doSync])

  const openSetup = useCallback(() => {
    if (!user) return
    resetSyncState(user.id).then(() => syncNow())
  }, [user, syncNow])

  const afterLocalReplaced = useCallback(async () => {
    await resetSyncState(user?.id ?? null)
    if (user) syncNow()
  }, [user, syncNow])

  const deleteCloudData = useCallback(async () => {
    const r = remote()
    if (!r || !user) return
    await storeSafetyBackup('Konto-Daten vor dem Löschen in der Cloud', rowsToBackup(await r.pullSince(null)))
    await r.deleteAll()
    await resetSyncState(user.id)
  }, [remote, user])

  const wipeEverything = useCallback(async (alsoCloud: boolean) => {
    if (alsoCloud && user) {
      await deleteCloudData()
      await wipeDatabase()
      await resetSyncState(user.id)
    } else {
      // only this device: sign out first, otherwise the next sync would bring everything back
      await signOut({ wipeLocal: false })
      await wipeDatabase()
      await resetSyncState()
    }
  }, [user, deleteCloudData, signOut])

  const value = useMemo<CloudCtx>(() => ({ phase, reason, user, sync, signIn, signOut, syncNow, openSetup, afterLocalReplaced, wipeEverything, deleteCloudData }), [phase, reason, user, sync, signIn, signOut, syncNow, openSetup, afterLocalReplaced, wipeEverything, deleteCloudData])

  return (
    <Ctx.Provider value={value}>
      {children}
      <SyncSetupDialog info={setup} onChoose={runSetup} />
      <SyncGuardDialog error={guard} onClose={(proceed) => {
        setGuard(null)
        if (proceed) doSync(undefined, { force: true })
        else setSync((s) => ({ ...s, state: 'error', message: 'Synchronisierung angehalten. Prüfe deine Daten oder stelle eine Sicherung wieder her.' }))
      }} />
    </Ctx.Provider>
  )
}
