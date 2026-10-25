/** Public Supabase settings: from /api/config (Vercel env), else build-time VITE_ variables. Cached for offline starts. */
export interface CloudConfig {
  url: string
  publishableKey: string
}

const CACHE_KEY = 'studyos.cloud.config'

function cached(): CloudConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    return v && typeof v.url === 'string' && typeof v.publishableKey === 'string' ? v : null
  } catch {
    return null
  }
}

function buildTime(): CloudConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined
  return url && key ? { url, publishableKey: key } : null
}

export interface ConfigResult {
  config: CloudConfig | null
  /** German explanation when sync is unavailable. */
  reason?: string
}

let pending: Promise<ConfigResult> | null = null

export function loadCloudConfig(): Promise<ConfigResult> {
  pending ??= (async () => {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(new URL('api/config', document.baseURI), { signal: ctrl.signal, headers: { accept: 'application/json' } })
      clearTimeout(t)
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        const j = (await res.json()) as { supabase: { url: string; publishableKey: string } | null; reason?: string }
        if (j.supabase) {
          const config = { url: j.supabase.url, publishableKey: j.supabase.publishableKey }
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(config))
          } catch {
            /* offline cache is optional */
          }
          return { config }
        }
        const fallback = buildTime()
        return fallback ? { config: fallback } : { config: null, reason: j.reason }
      }
    } catch {
      /* offline or no API (static hosting) */
    }
    const c = buildTime() ?? cached()
    return c ? { config: c } : { config: null, reason: 'Die Cloud-Synchronisierung ist für diese Website nicht eingerichtet.' }
  })()
  return pending
}
