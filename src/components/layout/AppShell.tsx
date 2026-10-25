import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Ellipsis, FlaskConical, Search, X } from 'lucide-react'
import { NAV, MOBILE_PRIMARY } from './nav'
import { cn, Kbd } from '../ui'
import { activeKind, switchDatabase } from '@/db/index'
import { useOpenMistakes, useProfile } from '@/hooks/data'
import { CommandPalette } from './CommandPalette'
import { useAchievementSync } from '@/features/progress/useAchievementSync'
import { useReminders } from '@/features/settings/useReminders'
import { useCalendarReminders } from '@/features/calendar/useCalendarReminders'
import { SyncIndicator } from '@/features/account/SyncIndicator'

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--accent-solid)" />
        <path d="M9 21.5c2.2 1.4 4.6 2 7 2 3.6 0 6-1.7 6-4.3 0-2.4-1.9-3.4-5.4-4.2-2.6-.6-3.5-1.1-3.5-2.2 0-1 1-1.7 2.8-1.7 1.6 0 3.2.5 4.6 1.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[1.05rem] font-semibold tracking-tight">Study OS</span>
    </div>
  )
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const mistakes = useOpenMistakes()
  const groups: { key: string; label?: string }[] = [{ key: 'main' }, { key: 'learn', label: 'Lernen' }, { key: 'organize', label: 'Organisieren' }]
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-0.5">
          {g.label && <div className="eyebrow px-2.5 pb-1">{g.label}</div>}
          {NAV.filter((n) => n.group === g.key).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-surface-2 text-fg font-medium' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
                )
              }
            >
              <n.icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{n.label}</span>
              {n.to === '/fehler' && mistakes && mistakes.length > 0 && <span className="rounded-full bg-warn-soft px-1.5 text-xs text-warn tabular">{mistakes.length}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function DemoBanner() {
  if (activeKind !== 'demo') return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warn/30 bg-warn-soft px-4 py-2 text-sm">
      <FlaskConical className="size-4 text-warn" aria-hidden />
      <span>
        <strong>Demo-Modus:</strong> Beispieldaten der erfundenen Schülerin „Alex“. Deine echten Daten sind davon getrennt.
      </span>
      <button type="button" onClick={() => switchDatabase('main')} className="font-semibold text-accent underline underline-offset-2 cursor-pointer">
        Zu meinen Daten wechseln
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const profile = useProfile()
  useAchievementSync()
  useReminders()
  useCalendarReminders()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setMoreOpen(false)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [location.pathname])

  const mobileItems = NAV.filter((n) => MOBILE_PRIMARY.includes(n.to))
  // The calendar uses the whole screen (own scrolling areas) instead of the centred content column.
  const fullBleed = location.pathname === '/kalender'

  return (
    <div className="flex h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Zum Inhalt springen
      </a>
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-subtle px-3 py-4 lg:flex">
          <Brand />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mt-5 mb-5 flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-fg-subtle hover:border-border-strong cursor-pointer"
          >
            <Search className="size-4" aria-hidden />
            <span className="flex-1 text-left">Suchen …</span>
            <Kbd>Strg K</Kbd>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SideNav />
          </div>
          <SyncIndicator variant="sidebar" localName={profile?.name} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/95 py-2 backdrop-blur lg:hidden" style={{ paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))', paddingRight: 'max(12px, env(safe-area-inset-right, 0px))' }}>
            <Brand />
            <div className="flex items-center gap-1">
            <SyncIndicator variant="icon" />
            <button type="button" aria-label="Suchen" onClick={() => setPaletteOpen(true)} className="flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 cursor-pointer">
              <Search className="size-5" aria-hidden />
            </button>
            </div>
          </header>
          <main id="main" tabIndex={-1} className={cn('min-h-0 flex-1 outline-none', fullBleed ? 'overflow-hidden' : 'overflow-y-auto')}>
            {fullBleed ? (
              <div key={location.pathname} className="page-enter h-full pb-[calc(var(--mobile-nav-h,0px)+env(safe-area-inset-bottom,0px))] lg:pb-0">{children}</div>
            ) : (
              <div key={location.pathname} className="page-enter mx-auto w-full max-w-6xl pt-6 pb-28 lg:pt-8 lg:pb-12" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
                {children}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
        <div className="grid grid-cols-5">
          {mobileItems.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cn('flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[0.7rem]', isActive ? 'text-accent' : 'text-fg-muted')}>
              <n.icon className="size-5" aria-hidden />
              <span className="max-w-full truncate">{n.label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} aria-expanded={moreOpen} className="flex flex-col items-center gap-0.5 py-2 text-[0.7rem] text-fg-muted cursor-pointer">
            <Ellipsis className="size-5" aria-hidden />
            Mehr
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Weitere Bereiche">
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-[var(--overlay)] cursor-default" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface px-4 pt-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Alle Bereiche</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Schließen" className="flex size-9 items-center justify-center rounded-md text-fg-muted cursor-pointer">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <button key={n.to} type="button" onClick={() => navigate(n.to)} className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2 py-3 text-xs text-fg cursor-pointer">
                  <n.icon className="size-5 text-fg-muted" aria-hidden />
                  <span className="text-center leading-tight">{n.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
