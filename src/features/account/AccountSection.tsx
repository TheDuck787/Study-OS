import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Download, LogOut, RefreshCcw, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import { Button, Card, Dialog, Input, Notice, Spinner, useConfirm, useToast } from '@/components/ui'
import { saveFile } from '@/lib/download'
import { formatDateTime } from '@/lib/dates'
import { getSyncDb, restoreConflict } from '@/lib/sync/local'
import { useCloud } from './CloudProvider'
import { GoogleButton } from './GoogleButton'

const TABLE_LABELS: Record<string, string> = {
  profile: 'Profil', subjects: 'Fach', topics: 'Thema', notes: 'Notiz', materials: 'Material', decks: 'Kartenstapel', cards: 'Karteikarte', cardReviews: 'Kartenwiederholung',
  questions: 'Frage', attempts: 'Quiz', answers: 'Antwort', exams: 'Prüfung', gradingScales: 'Notenschlüssel', teacherGrades: 'Note', sessions: 'Lernzeit', xpEvents: 'XP',
  achievements: 'Abzeichen', tutorChats: 'Tutor-Chat', meta: 'Einstellung', events: 'Termin', tasks: 'Aufgabe', eventCategories: 'Eigener Typ',
}

export function syncStatusText(s: ReturnType<typeof useCloud>['sync']): string {
  if (s.state === 'syncing') return 'Wird synchronisiert …'
  if (s.state === 'offline') return 'Offline – Änderungen werden später übertragen'
  if (s.state === 'error') return s.message ?? 'Fehler bei der Synchronisierung'
  if (s.state === 'setup') return 'Entscheidung nötig: Wie sollen die Daten zusammengeführt werden?'
  if (s.state === 'confirm') return 'Angehalten – Bestätigung nötig'
  return s.lastSyncAt ? `Synchronisiert ${formatDateTime(s.lastSyncAt)}` : 'Noch nicht synchronisiert'
}

export function AccountSection() {
  const cloud = useCloud()
  const toast = useToast()
  const confirm = useConfirm()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const conflicts = useLiveQuery(() => getSyncDb().conflicts.orderBy('at').reverse().toArray(), [])
  const backups = useLiveQuery(() => getSyncDb().backups.orderBy('at').reverse().toArray(), [])

  if (cloud.phase === 'loading') return <Card className="p-4"><Spinner label="Konto wird geladen …" /></Card>
  if (cloud.phase === 'disabled') {
    return (
      <Notice tone="neutral" icon={CloudOff} title="Synchronisierung nicht verfügbar">
        {cloud.reason} Deine Daten bleiben auf diesem Gerät; übertragen kannst du sie mit „Sicherung herunterladen“.
      </Notice>
    )
  }
  if (cloud.phase === 'signedOut') {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Cloud className="size-5" /></span>
          <div>
            <div className="font-semibold">Auf PC und Handy dieselben Daten</div>
            <p className="mt-0.5 text-sm text-fg-muted">Melde dich mit deinem Google-Konto an. Fächer, Notizen, Karteikarten, Quiz-Ergebnisse, Lernstand, Prüfungen, Aufgaben und Termine werden dann automatisch zwischen deinen Geräten abgeglichen. Offline lernst du weiter wie bisher – Änderungen werden nachgeholt.</p>
          </div>
        </div>
        <GoogleButton onClick={cloud.signIn} className="self-start" />
        <p className="flex gap-2 text-xs text-fg-subtle"><ShieldCheck className="size-4 shrink-0" />Gespeichert in deinem Supabase-Projekt (Server in der EU, Irland). Die Datenbank erlaubt jedem Konto nur den Zugriff auf seine eigenen Daten. Beim ersten Anmelden fragt Study OS, wie deine Daten auf diesem Gerät mit dem Konto zusammengeführt werden – nichts wird ungefragt überschrieben.</p>
      </Card>
    )
  }
  const u = cloud.user!
  const s = cloud.sync
  const StatusIcon = s.state === 'syncing' ? RefreshCcw : s.state === 'idle' ? CheckCircle2 : s.state === 'offline' ? CloudOff : AlertTriangle
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-4 p-4">
        {u.avatar ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full" /> : <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">{(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{u.name ?? u.email}</div>
          {u.name && <div className="truncate text-sm text-fg-muted">{u.email}</div>}
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted" aria-live="polite">
            <StatusIcon className={`size-3.5 ${s.state === 'syncing' ? 'animate-spin' : s.state === 'idle' ? 'text-success' : 'text-warn'}`} />
            {syncStatusText(s)}
          </div>
          {s.last && s.state === 'idle' && (s.last.uploaded + s.last.downloaded > 0) && <div className="text-xs text-fg-subtle">Zuletzt: {s.last.uploaded} hochgeladen, {s.last.downloaded} heruntergeladen</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          {s.state === 'setup' ? <Button size="sm" variant="primary" onClick={cloud.openSetup}>Jetzt entscheiden</Button> : <Button size="sm" icon={RefreshCcw} onClick={() => cloud.syncNow()} loading={s.state === 'syncing'}>Jetzt synchronisieren</Button>}
          <Button size="sm" icon={LogOut} onClick={() => setSignOutOpen(true)}>Abmelden</Button>
        </div>
      </Card>
      {s.state === 'error' && s.message && <Notice tone="danger" icon={AlertTriangle}>{s.message}</Notice>}

      {conflicts && conflicts.length > 0 && (
        <Card className="flex flex-col gap-2 p-4">
          <div className="text-sm font-semibold">Konflikte ({conflicts.length})</div>
          <p className="text-xs text-fg-muted">Diese Einträge wurden auf zwei Geräten verschieden geändert. Die neuere Version wurde behalten – hier kannst du die andere wiederherstellen.</p>
          <ul className="flex flex-col divide-y divide-border">
            {conflicts.slice(0, 20).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{TABLE_LABELS[c.table] ?? c.table}: {String(c.replaced?.title ?? c.replaced?.name ?? c.replaced?.front ?? c.recordId)}</span>
                <span className="text-xs text-fg-subtle">{formatDateTime(c.at)} · behalten: {c.kept === 'local' ? 'dieses Gerät' : 'Konto'}</span>
                <Button size="sm" icon={RotateCcw} onClick={async () => { await restoreConflict(c); toast({ title: 'Andere Version wiederhergestellt', tone: 'success' }) }}>Andere Version nehmen</Button>
                <button type="button" aria-label="Konflikt verwerfen" className="cursor-pointer p-1 text-fg-subtle hover:text-fg" onClick={() => getSyncDb().conflicts.delete(c.id)}><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {backups && backups.length > 0 && (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold">Sicherheitskopien ({backups.length})</summary>
          <p className="mt-1 text-xs text-fg-muted">Automatisch vor dem Zusammenführen oder Ersetzen gespeichert. Herunterladen und unter „Sicherung wiederherstellen“ einlesen, falls etwas schiefgegangen ist.</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {backups.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{b.reason} · {formatDateTime(b.at)}</span>
                <Button size="sm" icon={Download} onClick={() => saveFile(`study-os-sicherheitskopie-${b.at.slice(0, 10)}.json`, b.json)}>Herunterladen</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded-lg border border-danger/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-danger">Daten im Konto löschen</summary>
        <p className="mt-1 text-sm text-fg-muted">Entfernt alle synchronisierten Daten aus deinem Konto (die Daten auf diesem Gerät bleiben). Vorher wird eine Sicherheitskopie gespeichert.</p>
        <Button size="sm" variant="danger" icon={Trash2} className="mt-2" onClick={() => { setDeleteText(''); setDeleteOpen(true) }}>Konto-Daten löschen …</Button>
      </details>

      <Dialog open={signOutOpen} onClose={() => setSignOutOpen(false)} title="Abmelden" size="sm">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">Noch nicht übertragene Änderungen werden vorher hochgeladen, wenn du online bist.</p>
          <Button onClick={async () => { setSignOutOpen(false); await cloud.signOut(); toast({ title: 'Abgemeldet', description: 'Deine Daten bleiben auf diesem Gerät.' }) }} className="justify-start" icon={LogOut}>Abmelden – Daten auf diesem Gerät behalten</Button>
          <Button variant="danger" className="justify-start" icon={Trash2} onClick={async () => {
            setSignOutOpen(false)
            if (await confirm({ title: 'Daten von diesem Gerät entfernen?', message: 'Für fremde oder geteilte Geräte. Deine Daten im Konto bleiben erhalten; noch nicht übertragene Änderungen auf diesem Gerät gehen verloren.', confirmLabel: 'Abmelden und entfernen' })) await cloud.signOut({ wipeLocal: true })
          }}>Abmelden und Daten von diesem Gerät entfernen</Button>
        </div>
      </Dialog>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Alle Daten im Konto löschen?" size="sm"
        footer={<><Button onClick={() => setDeleteOpen(false)}>Abbrechen</Button><Button variant="danger" disabled={deleteText !== 'LÖSCHEN'} onClick={async () => {
          setDeleteOpen(false)
          try {
            await cloud.deleteCloudData()
            toast({ title: 'Konto-Daten gelöscht', description: 'Die Daten auf diesem Gerät sind noch da. Beim nächsten Synchronisieren fragt Study OS, ob sie hochgeladen werden sollen.' })
          } catch (e) {
            toast({ title: 'Löschen fehlgeschlagen', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
          }
        }}>Endgültig löschen</Button></>}>
        <div className="flex flex-col gap-3 text-sm text-fg-muted">
          <p>Auf deinen anderen Geräten bleiben die Daten lokal erhalten, werden aber nicht mehr abgeglichen, bis du neu entscheidest.</p>
          <p>Tippe <strong className="text-fg">LÖSCHEN</strong> zur Bestätigung.</p>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} aria-label="Bestätigung" autoComplete="off" />
        </div>
      </Dialog>
    </div>
  )
}
