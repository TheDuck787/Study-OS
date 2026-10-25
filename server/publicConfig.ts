/**
 * Public client configuration for the browser (Supabase project URL + publishable key).
 * Reads the variables the Vercel ↔ Supabase integration creates, so no rebuild is needed.
 * Publishable/anon keys are meant to be public (access is limited by Row Level Security) –
 * secret/service-role keys are refused here so they can never reach the browser by mistake.
 */
export interface PublicConfig {
  supabase: { url: string; publishableKey: string } | null
  /** Why cloud sync is not available (German, shown to the student). */
  reason?: string
}

function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const json = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof json.role === 'string' ? json.role : null
  } catch {
    return null
  }
}

/** True for keys that must never be public (service role, secret keys). */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  const role = jwtRole(key)
  return role !== null && role !== 'anon'
}

export function isPublishableKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || jwtRole(key) === 'anon'
}

export function publicConfig(env: NodeJS.ProcessEnv): PublicConfig {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const key = (
    env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
  ).trim()
  if (!url && !key) return { supabase: null, reason: 'Die Cloud-Synchronisierung ist auf dem Server nicht eingerichtet (SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY fehlen).' }
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return { supabase: null, reason: 'SUPABASE_URL ist ungültig (erwartet: https://<projekt>.supabase.co).' }
  if (!key) return { supabase: null, reason: 'SUPABASE_PUBLISHABLE_KEY (oder SUPABASE_ANON_KEY) fehlt auf dem Server.' }
  if (isSecretKey(key)) {
    console.error('Refusing to expose a secret Supabase key as public config. Use the publishable/anon key.')
    return { supabase: null, reason: 'Auf dem Server ist statt des öffentlichen Schlüssels ein geheimer Supabase-Schlüssel eingetragen. Aus Sicherheitsgründen wird er nicht verwendet.' }
  }
  if (!isPublishableKey(key)) return { supabase: null, reason: 'Der Supabase-Schlüssel hat ein unbekanntes Format (erwartet: sb_publishable_… oder anon-Schlüssel).' }
  return { supabase: { url, publishableKey: key } }
}
