import { AlertTriangle } from 'lucide-react'
import { Button, Dialog, Notice } from '@/components/ui'
import type { SyncGuardError } from '@/lib/sync/engine'

/** Shown when a sync would delete unusually many entries – nothing has been changed yet. */
export function SyncGuardDialog({ error, onClose }: { error: SyncGuardError | null; onClose: (proceed: boolean) => void }) {
  return (
    <Dialog open={!!error} onClose={() => onClose(false)} title="Viele Löschungen – bitte bestätigen" size="sm"
      footer={<><Button onClick={() => onClose(false)}>Anhalten</Button><Button variant="danger" onClick={() => onClose(true)}>Trotzdem synchronisieren</Button></>}>
      {error && (
        <div className="flex flex-col gap-3 text-sm">
          <Notice tone="warn" icon={AlertTriangle}>
            {error.count} von {error.total} Einträgen würden {error.where === 'local' ? 'auf diesem Gerät' : 'in deinem Konto (und damit auf allen Geräten)'} gelöscht.
          </Notice>
          <p className="text-fg-muted">Das passiert z. B., wenn auf einem anderen Gerät „Alles löschen“ gewählt wurde. War das nicht beabsichtigt, wähle „Anhalten“ und lade unter Einstellungen eine Sicherung herunter.</p>
        </div>
      )}
    </Dialog>
  )
}
