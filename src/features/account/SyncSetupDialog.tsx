import { useState } from 'react'
import { AlertTriangle, CloudDownload, CloudUpload, GitMerge, ShieldCheck } from 'lucide-react'
import { Button, cn, Dialog, Input, Notice } from '@/components/ui'
import type { RemoteRow, SyncMode } from '@/lib/sync/engine'

export interface SetupInfo {
  localCount: number
  cloudCount: number
  /** This device was last synced with a different account. */
  otherAccount: boolean
  rows: RemoteRow[]
  email: string | null
}

type Choice = 'merge' | 'useCloud' | 'useLocal'

/** First sign-in on a device with data: the student decides – nothing is overwritten silently. */
export function SyncSetupDialog({ info, onChoose }: { info: SetupInfo | null; onChoose: (m: SyncMode | 'later') => void }) {
  const [choice, setChoice] = useState<Choice>('merge')
  const [confirmText, setConfirmText] = useState('')
  if (!info) return <Dialog open={false} onClose={() => undefined} title="" />
  const cloudEmpty = info.cloudCount === 0
  const options: { id: Choice; icon: typeof GitMerge; title: string; text: string; hidden?: boolean; danger?: boolean }[] = [
    { id: 'merge', icon: cloudEmpty ? CloudUpload : GitMerge, title: cloudEmpty ? 'Daten dieses Geräts in mein Konto hochladen' : 'Zusammenführen (empfohlen)', text: cloudEmpty ? 'Dein Konto ist noch leer. Alles von diesem Gerät wird hochgeladen und ist danach auch auf deinen anderen Geräten verfügbar.' : 'Beides wird kombiniert. Gibt es denselben Eintrag auf beiden Seiten verschieden, gewinnt der neuere – der andere bleibt als Kopie unter „Konflikte“ erhalten.' },
    { id: 'useCloud', icon: CloudDownload, title: 'Nur die Daten aus meinem Konto verwenden', text: 'Dieses Gerät übernimmt den Stand aus der Cloud. Die bisherigen Daten dieses Geräts werden vorher als Sicherung gespeichert.', hidden: cloudEmpty, danger: true },
    { id: 'useLocal', icon: CloudUpload, title: 'Nur die Daten dieses Geräts verwenden', text: 'Dein Konto wird durch den Stand dieses Geräts ersetzt – auch auf deinen anderen Geräten. Der bisherige Cloud-Stand wird vorher als Sicherung gespeichert.', hidden: cloudEmpty, danger: true },
  ]
  const needsConfirm = choice === 'useLocal'
  return (
    <Dialog
      open
      onClose={() => onChoose('later')}
      size="lg"
      title="Daten mit deinem Konto verbinden"
      description={info.email ? `Angemeldet als ${info.email}` : undefined}
      footer={
        <>
          <Button onClick={() => onChoose('later')}>Später entscheiden</Button>
          <Button variant={choice === 'merge' ? 'primary' : 'danger'} disabled={needsConfirm && confirmText.trim().toUpperCase() !== 'ERSETZEN'} onClick={() => onChoose(choice)}>
            {choice === 'merge' ? (cloudEmpty ? 'Hochladen' : 'Zusammenführen') : choice === 'useCloud' ? 'Konto-Daten übernehmen' : 'Konto ersetzen'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-3"><div className="text-xl font-semibold tabular">{info.localCount}</div><div className="text-xs text-fg-muted">Einträge auf diesem Gerät</div></div>
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-3"><div className="text-xl font-semibold tabular">{info.cloudCount}</div><div className="text-xs text-fg-muted">Einträge in deinem Konto</div></div>
        </div>
        {info.otherAccount && <Notice tone="warn" icon={AlertTriangle}>Dieses Gerät war zuletzt mit einem anderen Konto verbunden. Prüfe, ob die Daten hier wirklich zu diesem Konto gehören.</Notice>}
        <div role="radiogroup" aria-label="Wie sollen die Daten zusammengeführt werden?" className="flex flex-col gap-2">
          {options.filter((o) => !o.hidden).map((o) => (
            <label key={o.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', choice === o.id ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}>
              <input type="radio" name="sync-choice" className="mt-1 accent-[var(--accent-solid)]" checked={choice === o.id} onChange={() => setChoice(o.id)} />
              <o.icon className={cn('mt-0.5 size-5 shrink-0', o.danger ? 'text-warn' : 'text-accent')} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{o.title}</span>
                <span className="block text-sm text-fg-muted">{o.text}</span>
              </span>
            </label>
          ))}
        </div>
        {needsConfirm && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sync-confirm" className="text-sm">Tippe <strong>ERSETZEN</strong>, um den Cloud-Stand zu ersetzen:</label>
            <Input id="sync-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
        )}
        <p className="flex gap-2 text-xs text-fg-subtle"><ShieldCheck className="size-4 shrink-0" />Vor jeder Variante speichert Study OS eine Sicherung auf diesem Gerät (Einstellungen → Konto → Sicherheitskopien). Originaldateien (PDFs, Fotos) bleiben auf dem Gerät, auf dem du sie importiert hast; ihr erkannter Text wird synchronisiert.</p>
      </div>
    </Dialog>
  )
}
