import { Link } from 'react-router-dom'
import { AlertTriangle, Cloud, CloudOff, RefreshCcw } from 'lucide-react'
import { cn } from '@/components/ui'
import { useCloud } from './CloudProvider'
import { syncStatusText } from './AccountSection'

/** Small account/sync status: sidebar footer (desktop) or icon (mobile header). Links to Einstellungen → Konto. */
export function SyncIndicator({ variant, localName }: { variant: 'sidebar' | 'icon'; localName?: string }) {
  const cloud = useCloud()
  const s = cloud.sync
  const Icon = cloud.phase !== 'signedIn' ? CloudOff : s.state === 'syncing' ? RefreshCcw : s.state === 'idle' ? Cloud : s.state === 'offline' ? CloudOff : AlertTriangle
  const tone = cloud.phase !== 'signedIn' ? 'text-fg-subtle' : s.state === 'idle' || s.state === 'syncing' ? 'text-success' : 'text-warn'
  const text = cloud.phase === 'signedIn' ? syncStatusText(s) : cloud.phase === 'signedOut' ? 'Nur auf diesem Gerät – zum Synchronisieren anmelden' : 'Nur auf diesem Gerät gespeichert'
  if (variant === 'icon') {
    if (cloud.phase === 'disabled' || cloud.phase === 'loading') return null
    return (
      <Link to="/einstellungen#konto" aria-label={`Konto: ${text}`} title={text} className="flex size-9 items-center justify-center rounded-md hover:bg-surface-2">
        <Icon className={cn('size-5', tone, s.state === 'syncing' && 'animate-spin')} />
      </Link>
    )
  }
  return (
    <Link to="/einstellungen#konto" className="mt-4 flex items-start gap-2 border-t border-border px-2.5 pt-3 text-xs text-fg-subtle hover:text-fg" title={text}>
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', tone, s.state === 'syncing' && 'animate-spin')} />
      <span className="min-w-0">
        <span className="block truncate">{cloud.user ? cloud.user.name ?? cloud.user.email : localName ? `Lokal als ${localName}` : 'Lokal'}</span>
        <span className="block truncate">{cloud.phase === 'signedIn' ? syncStatusText(s) : cloud.phase === 'signedOut' ? 'Mit Google anmelden für Sync' : 'nicht synchronisiert'}</span>
      </span>
    </Link>
  )
}
