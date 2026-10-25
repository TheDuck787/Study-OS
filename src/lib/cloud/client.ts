import type { SupabaseClient } from '@supabase/supabase-js'
import type { CloudConfig } from './config'

/** Where to return after the Google redirect (the hash route is not part of the OAuth redirect URL). */
export const RETURN_KEY = 'studyos.auth.return'

let client: Promise<SupabaseClient> | null = null

/** The Supabase client is loaded on demand, so the learning app itself stays small and fully offline-capable. */
export function getSupabase(cfg: CloudConfig): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(cfg.url, cfg.publishableKey, {
      auth: {
        // PKCE: Google sends a one-time ?code= that the browser exchanges itself – works with the #/ hash router
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'studyos-auth',
      },
    }),
  )
  return client
}

/** URL Google/Supabase sends the user back to: this page without hash and query. */
export function redirectUrl(): string {
  return `${location.origin}${location.pathname}`
}

/** Removes ?code / ?error from the address bar after sign-in and returns to the saved page. */
export function cleanAuthParams() {
  const u = new URL(location.href)
  let changed = false
  for (const p of ['code', 'state', 'error', 'error_code', 'error_description', 'sb']) {
    if (u.searchParams.has(p)) {
      u.searchParams.delete(p)
      changed = true
    }
  }
  let ret: string | null = null
  try {
    ret = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
  } catch {
    /* ignore */
  }
  if (changed || ret) {
    history.replaceState(null, '', `${u.pathname}${u.search}${ret ?? u.hash}`)
    // the hash router only listens to popstate/hashchange – tell it about the restored page
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

/** German message for an OAuth error in the redirect URL. */
export function authErrorFromUrl(): string | null {
  const u = new URL(location.href)
  const err = u.searchParams.get('error') ?? new URLSearchParams(u.hash.split('?')[1] ?? '').get('error')
  if (!err) return null
  const desc = u.searchParams.get('error_description') ?? ''
  if (err === 'access_denied') return 'Die Anmeldung wurde abgebrochen.'
  if (/provider is not enabled|Unsupported provider/i.test(desc)) return 'Die Anmeldung mit Google ist im Supabase-Projekt noch nicht aktiviert.'
  if (/redirect/i.test(desc)) return 'Diese Adresse ist in Supabase nicht als Weiterleitungs-URL erlaubt.'
  return `Anmeldung fehlgeschlagen: ${desc || err}`
}
