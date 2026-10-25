import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { SeriesScope } from '@/db/calendar'
import { Button, Dialog } from '@/components/ui'

/** Asks which occurrences of a recurring entry a change should affect. */
export function ScopeDialog({ open, title, onPick }: { open: boolean; title: string; onPick: (s: SeriesScope | null) => void }) {
  return (
    <Dialog open={open} onClose={() => onPick(null)} title={title} size="sm" description="Dieser Eintrag wiederholt sich. Was soll sich ändern?">
      <div className="flex flex-col gap-2">
        <Button onClick={() => onPick('single')} className="justify-start">Nur dieser Termin</Button>
        <Button onClick={() => onPick('following')} className="justify-start">Dieser und alle folgenden</Button>
        <Button onClick={() => onPick('all')} className="justify-start">Alle Termine der Serie</Button>
        <Button variant="ghost" onClick={() => onPick(null)}>Abbrechen</Button>
      </div>
    </Dialog>
  )
}

export function useScopeAsk(): [ReactNode, (title: string) => Promise<SeriesScope | null>] {
  const [state, setState] = useState<{ title: string } | null>(null)
  const resolver = useRef<(s: SeriesScope | null) => void>(() => {})
  const ask = useCallback((title: string) => new Promise<SeriesScope | null>((resolve) => {
    resolver.current = resolve
    setState({ title })
  }), [])
  const el = <ScopeDialog open={!!state} title={state?.title ?? ''} onPick={(s) => {
    setState(null)
    resolver.current(s)
  }} />
  return [el, ask]
}
