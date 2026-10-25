import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, CircleDashed, Download, FlaskConical, HardDrive, Plus, RefreshCcw, Trash2, Upload } from 'lucide-react'
import { db, activeKind, switchDatabase } from '@/db/index'
import type { ExplanationMode, GradeThreshold, Profile, ThemePref } from '@/db/types'
import { deleteGradingScale, saveGradingScale, saveProfile, ValidationError } from '@/db/repo'
import { removeExampleContent, seedLibrary } from '@/db/seed'
import { CURRICULUM, CURRICULUM_NOTICE } from '@/content/curriculum'
import { EXPLANATION_MODES } from '@/shared/ai'
import { loadAiSettings, saveAiSettings, detectAi, serverStatus, testServer, type AiChoice, type AiAvailability } from '@/lib/ai/client'
import { applyTheme, loadTheme } from '@/lib/theme'
import { checkBackup, exportBackup, restoreBackup, wipeDatabase, type BackupCheck } from '@/lib/backup'
import { saveFile } from '@/lib/download'
import { AccountSection } from '@/features/account/AccountSection'
import { useCloud } from '@/features/account/CloudProvider'
import { toCsv } from '@/lib/csv'
import { dayKey, WEEKDAYS_SHORT, formatDateTime } from '@/lib/dates'
import { percentToGrade, validateScale } from '@/lib/grading'
import { Badge, Button, Card, Checkbox, cn, Dialog, Field, IconButton, Input, LoadingBlock, Notice, PageHeader, Segmented, Select, Switch, useConfirm, useToast } from '@/components/ui'
import { useProfile, useScales } from '@/hooks/data'

function Section({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="grid gap-4 border-t border-border pt-8 lg:grid-cols-3">
      <div>
        <h2 id={`${id}-h`} className="text-md font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">{children}</div>
    </section>
  )
}

export default function SettingsPage() {
  const profile = useProfile()
  const toast = useToast()
  useEffect(() => {
    const id = location.hash.split('#')[2]
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 50)
  }, [])
  if (profile === undefined) return <LoadingBlock />
  const update = async (patch: Partial<Profile>) => {
    try {
      await saveProfile(patch)
    } catch (e) {
      toast({ title: 'Nicht gespeichert', description: e instanceof ValidationError ? e.message : String(e), tone: 'danger' })
    }
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Einstellungen" title="Einstellungen" description="Änderungen werden sofort gespeichert." />
      <Section id="konto" title="Konto & Synchronisierung" description="Mit Google anmelden, um deine Daten zwischen PC und Handy abzugleichen. Ohne Anmeldung bleibt alles nur auf diesem Gerät.">
        <AccountSection />
      </Section>
      {profile && <ProfileSection profile={profile} update={update} />}
      {profile && <LearningSection profile={profile} update={update} />}
      <AppearanceSection />
      {profile && <GradingSection profile={profile} update={update} />}
      <AiSection />
      {profile && <ReminderSection profile={profile} update={update} />}
      <DataSection />
    </div>
  )
}

function ProfileSection({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  const [name, setName] = useState(profile.name)
  return (
    <Section id="profil" title="Profil" description="Liegt auf diesem Gerät – mit Google-Anmeldung zusätzlich nur in deinem eigenen Konto. Niemand sonst kann deine Daten sehen.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name oder Spitzname" htmlFor="st-name">
          <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== profile.name && update({ name })} maxLength={60} />
        </Field>
        <Field label="Klassenstufe" htmlFor="st-grade">
          <Select id="st-grade" value={profile.grade} onChange={(e) => update({ grade: Number(e.target.value) })}>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Klasse {g}</option>)}
          </Select>
        </Field>
        <Field label="Schulform" htmlFor="st-school">
          <Input id="st-school" defaultValue={profile.schoolType} onBlur={(e) => update({ schoolType: e.target.value.trim() || 'Gesamtschule' })} />
        </Field>
        <Field label="Bundesland" htmlFor="st-region">
          <Input id="st-region" defaultValue={profile.region} onBlur={(e) => update({ region: e.target.value.trim() })} />
        </Field>
      </div>
    </Section>
  )
}

function LearningSection({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  return (
    <Section id="lernen" title="Lernen" description="Realistische Ziele helfen mehr als hohe. Pausen sind erlaubt und gehören dazu.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tagesziel" htmlFor="st-goal">
          <Select id="st-goal" value={profile.dailyGoalMinutes} onChange={(e) => update({ dailyGoalMinutes: Number(e.target.value) })}>
            {[10, 15, 20, 25, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} Minuten</option>)}
          </Select>
        </Field>
        <Field label="Wochenziel" htmlFor="st-week">
          <Select id="st-week" value={profile.weeklyGoalDays} onChange={(e) => update({ weeklyGoalDays: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} Lerntag{d === 1 ? '' : 'e'} pro Woche</option>)}
          </Select>
        </Field>
        <Field label="Bevorzugte Erklärungen" htmlFor="st-mode">
          <Select id="st-mode" value={profile.explanationMode} onChange={(e) => update({ explanationMode: e.target.value as ExplanationMode })}>
            {(Object.keys(EXPLANATION_MODES) as ExplanationMode[]).map((k) => <option key={k} value={k}>{EXPLANATION_MODES[k].label}</option>)}
          </Select>
        </Field>
        <Field label="Standard-Schwierigkeit im Quiz" htmlFor="st-diff">
          <Select id="st-diff" value={String(profile.quizDifficulty)} onChange={(e) => update({ quizDifficulty: e.target.value === 'adaptive' ? 'adaptive' : (Number(e.target.value) as 1) })}>
            <option value="adaptive">Passend zu meinem Stand</option>
            <option value="1">Leicht</option>
            <option value="2">Mittel</option>
            <option value="3">Schwer</option>
            <option value="4">Fortgeschritten</option>
          </Select>
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Feste Ruhetage <span className="font-normal text-fg-subtle">– unterbrechen die Lernserie nie</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button key={d} type="button" aria-pressed={profile.restDays.includes(d)} onClick={() => update({ restDays: profile.restDays.includes(d) ? profile.restDays.filter((x) => x !== d) : [...profile.restDays, d] })} className={cn('h-9 w-11 rounded-md border text-sm font-medium cursor-pointer', profile.restDays.includes(d) ? 'border-accent bg-accent-soft text-accent' : 'border-border text-fg-muted')}>
              {WEEKDAYS_SHORT[d]}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Pause bis (Krankheit, Ferien)" htmlFor="st-pause" hint="Bis zu diesem Tag zählen fehlende Lerntage nicht gegen deine Serie.">
        <div className="flex gap-2">
          <Input id="st-pause" type="date" min={dayKey()} value={profile.pausedUntil ?? ''} onChange={(e) => update({ pausedUntil: e.target.value || null })} className="max-w-48" />
          {profile.pausedUntil && <Button onClick={() => update({ pausedUntil: null })}>Pause beenden</Button>}
        </div>
      </Field>
    </Section>
  )
}

function AppearanceSection() {
  const [theme, setTheme] = useState<ThemePref>(loadTheme())
  return (
    <Section id="darstellung" title="Darstellung">
      <Field label="Farbschema" htmlFor="st-theme">
        <Segmented label="Farbschema" value={theme} onChange={(t) => { setTheme(t); applyTheme(t) }} options={[{ value: 'dark', label: 'Dunkel' }, { value: 'light', label: 'Hell' }, { value: 'system', label: 'Wie das Gerät' }]} />
      </Field>
    </Section>
  )
}

function GradingSection({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  const scales = useScales()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  if (!scales) return null
  const current = scales.find((s) => s.id === profile.gradingScaleId) ?? scales[0]
  return (
    <Section id="noten" title="Notenschlüssel" description="Damit schätzt Study OS aus Prozenten eine Note. Jede Lehrkraft kann einen anderen Schlüssel haben – lege ihn hier an. Die Schätzung ist nie eine echte Note.">
      <Field label="Standard-Schlüssel" htmlFor="st-scale">
        <Select id="st-scale" value={profile.gradingScaleId} onChange={(e) => update({ gradingScaleId: e.target.value })}>
          {scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      {current && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead><tr className="text-left text-fg-subtle">{current.thresholds.map((t) => <th key={t.grade} className="px-2 py-1 font-medium">Note {t.grade}</th>)}</tr></thead>
            <tbody><tr>{current.thresholds.map((t) => <td key={t.grade} className="px-2 py-1">ab {t.minPercent} %</td>)}</tr></tbody>
          </table>
          <p className="mt-1 text-xs text-fg-subtle">{current.description}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {scales.filter((s) => !s.builtin).map((s) => (
          <Badge key={s.id}>
            {s.name}
            <button type="button" aria-label={`${s.name} löschen`} className="ml-1 cursor-pointer" onClick={async () => { if (await confirm({ title: `„${s.name}“ löschen?` })) await deleteGradingScale(s.id) }}>×</button>
          </Badge>
        ))}
        <Button size="sm" icon={Plus} onClick={() => setEditing(true)}>Eigenen Schlüssel anlegen</Button>
      </div>
      <ScaleEditor open={editing} onClose={() => setEditing(false)} onSaved={(id) => update({ gradingScaleId: id })} />
    </Section>
  )
}

function ScaleEditor({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState('')
  const [values, setValues] = useState([87, 73, 59, 45, 18])
  const [tendencies, setTendencies] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const thresholds: GradeThreshold[] = [...values.map((v, i) => ({ grade: (i + 1) as GradeThreshold['grade'], minPercent: v })), { grade: 6, minPercent: 0 }]
  const save = async () => {
    try {
      const id = await saveGradingScale({ name, description: `Eigener Schlüssel: ${values.map((v, i) => `${i + 1} ab ${v} %`).join(', ')}.`, thresholds, tendencies })
      onSaved(id)
      onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }
  const err = validateScale(thresholds)
  return (
    <Dialog open={open} onClose={onClose} title="Eigener Notenschlüssel" footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save} disabled={!!err || !name.trim()}>Speichern</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="sc-name"><Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Mathe – Frau Schmidt" /></Field>
        <div className="grid grid-cols-5 gap-2">
          {values.map((v, i) => (
            <Field key={i} label={`Note ${i + 1} ab`} htmlFor={`sc-${i}`}>
              <Input id={`sc-${i}`} type="number" min={0} max={100} value={v} onChange={(e) => setValues((xs) => xs.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
            </Field>
          ))}
        </div>
        <p className="text-xs text-fg-subtle">Note 6 beginnt immer bei 0 %. Beispiel: 80 % ergibt Note {percentToGrade(80, { id: '', name: '', description: '', thresholds, tendencies, builtin: false }).label}.</p>
        <Checkbox checked={tendencies} onChange={setTendencies} label="Tendenzen anzeigen (z. B. 2+ oder 3-)" />
        {(error || err) && <p className="text-sm text-danger" role="alert">{error ?? err}</p>}
      </div>
    </Dialog>
  )
}

function AiSection() {
  const [s, setS] = useState(loadAiSettings())
  const [status, setStatus] = useState<AiAvailability | null>(null)
  const [server, setServer] = useState<Awaited<ReturnType<typeof serverStatus>> | undefined>(undefined)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const refresh = async () => {
    setStatus(null)
    setServer(undefined)
    setTest(null)
    window.dispatchEvent(new Event('studyos:ai-changed'))
    setStatus(await detectAi(true))
    setServer(await serverStatus())
  }
  useEffect(() => {
    refresh()
  }, [])
  const change = (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch }
    setS(next)
    saveAiSettings(next)
  }
  return (
    <Section id="ki" title="KI-Anbieter" description="Alle Lernfunktionen funktionieren auch ohne KI. Mit KI kommen der Tutor, KI-Bewertung von Freitext und bessere Karten/Fragen aus Material dazu.">
      <Card className="flex items-start gap-3 p-4">
        {status === null ? <CircleDashed className="mt-0.5 size-5 animate-spin text-fg-subtle" /> : status.ok ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <AlertTriangle className="mt-0.5 size-5 text-warn" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{status === null ? 'Prüfe …' : status.ok ? `Verfügbar: ${status.label}${status.model ? ` (${status.model})` : ''}` : 'Nicht verfügbar'}</div>
          {status && <p className="mt-0.5 text-sm text-fg-muted">{status.detail}</p>}
          {status?.ok && <p className="mt-0.5 text-xs text-fg-subtle">Bilder lesen: {status.supportsImages ? 'ja' : 'nein'}</p>}
        </div>
        <IconButton label="Neu prüfen" icon={RefreshCcw} onClick={refresh} />
      </Card>
      <Field label="Welche KI soll genutzt werden?" htmlFor="ai-choice">
        <Select id="ai-choice" value={s.choice} onChange={(e) => { change({ choice: e.target.value as AiChoice }); setTimeout(refresh, 0) }}>
          <option value="auto">Automatisch (was verfügbar ist)</option>
          <option value="server">Study-OS-API mit API-Schlüssel</option>
          <option value="none">Keine KI verwenden</option>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adresse der Study-OS-API" htmlFor="ai-url" optional hint="Normalerweise leer lassen – auf Vercel und mit npm start kommt die API von derselben Adresse wie die App.">
          <Input id="ai-url" value={s.serverUrl} onChange={(e) => change({ serverUrl: e.target.value.trim() })} onBlur={refresh} placeholder="z. B. http://192.168.0.10:8787" />
        </Field>
        <Field label="Zugangscode" htmlFor="ai-token" optional={!server?.accessTokenRequired} hint="Der Wert von APP_ACCESS_TOKEN (auf Vercel Pflicht). Das ist nicht der API-Schlüssel – der bleibt immer auf dem Server.">
          <Input id="ai-token" type="password" value={s.accessToken} onChange={(e) => change({ accessToken: e.target.value })} onBlur={refresh} autoComplete="off" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={async () => { setTesting(true); setTest(await testServer()); setTesting(false) }} loading={testing} disabled={!server}>Server-Verbindung testen</Button>
        <span className="text-sm text-fg-muted">
          {server === undefined ? '' : server === null ? 'Study-OS-API nicht erreichbar.' : server.configured ? `API erreichbar · ${server.provider}` : server.authorized === false ? 'API erreichbar, aber der Zugangscode fehlt oder ist falsch.' : `API erreichbar, aber: ${server.detail}`}
        </span>
      </div>
      {test && <Notice tone={test.ok ? 'success' : 'danger'}>{test.message}</Notice>}
      <details className="rounded-lg border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Wie richte ich die KI ein?</summary>
        <div className="mt-2 flex flex-col gap-2 text-fg-muted">
          <p><strong className="text-fg">Wichtig:</strong> Ein ChatGPT-Plus- oder Claude-Pro-Abo enthält keinen API-Zugang. Eine Website kann ein Abo aus einer Desktop-App nicht einfach mitbenutzen. Für den eigenen Server brauchst du einen API-Schlüssel (kostenpflichtig nach Verbrauch) oder ein lokales Modell (z. B. Ollama).</p>
          <p><strong className="text-fg">Variante 1 – Website auf Vercel:</strong> Im Vercel-Projekt unter <em>Settings → Environment Variables</em> <code>ANTHROPIC_API_KEY</code> (oder <code>OPENAI_API_KEY</code> + <code>OPENAI_MODEL</code>) und einen selbst ausgedachten <code>APP_ACCESS_TOKEN</code> anlegen, dann neu deployen. Den Zugangscode trägst du hier oben ein – auf jedem Gerät einmal. Der API-Schlüssel bleibt auf dem Server und erreicht nie den Browser.</p>
          <p><strong className="text-fg">Variante 2 – eigener Rechner:</strong> In der Datei <code>.env</code> z. B. <code>ANTHROPIC_API_KEY=…</code> eintragen, dann <code>npm run build</code> und <code>npm start</code>.</p>
          <p><strong className="text-fg">Variante 3 – lokal mit Ollama:</strong> <code>AI_PROVIDER=openai-compatible</code>, <code>OPENAI_BASE_URL=http://localhost:11434/v1</code>, <code>OPENAI_MODEL=</code>(Name deines Modells). Funktioniert nur mit <code>npm start</code> auf demselben Rechner, nicht auf Vercel.</p>
        </div>
      </details>
    </Section>
  )
}

function ReminderSection({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  const supported = typeof Notification !== 'undefined'
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  const enable = async (v: boolean) => {
    if (v && supported && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p !== 'granted') return
    }
    update({ notifications: { ...profile.notifications, enabled: v } })
  }
  return (
    <Section id="erinnerungen" title="Erinnerungen" description="Höchstens eine freundliche Erinnerung am Tag – und nur, wenn wirklich etwas fällig ist. Keine Schuldgefühle, keine Strafen.">
      {!supported ? (
        <Notice tone="warn">Dieser Browser unterstützt keine Benachrichtigungen.</Notice>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="st-notify" className="text-sm">Tägliche Erinnerung</label>
            <Switch id="st-notify" label="Tägliche Erinnerung" checked={profile.notifications.enabled && perm === 'granted'} onChange={enable} />
          </div>
          {perm === 'denied' && <Notice tone="warn">Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen.</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frühestens um" htmlFor="st-time">
              <Input id="st-time" type="time" value={profile.notifications.reminderTime} onChange={(e) => update({ notifications: { ...profile.notifications, reminderTime: e.target.value || '16:00' } })} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox checked={profile.notifications.examReminders} onChange={(v) => update({ notifications: { ...profile.notifications, examReminders: v } })} label="Auf Prüfungen in den nächsten 3 Tagen hinweisen" />
            </div>
          </div>
          <p className="text-xs text-fg-subtle">Ehrlicher Hinweis: Erinnerungen erscheinen nur, während Study OS in einem Browser-Tab geöffnet ist. Push-Nachrichten bei geschlossener App bräuchten einen Server-Dienst, den Study OS bewusst nicht nutzt.</p>
        </>
      )}
    </Section>
  )
}

function DataSection() {
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [includeFiles, setIncludeFiles] = useState(false)
  const [pending, setPending] = useState<BackupCheck | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeText, setWipeText] = useState('')
  const [wipeCloud, setWipeCloud] = useState(false)
  const cloud = useCloud()
  const [seedKeys, setSeedKeys] = useState<string[]>([])
  const usage = useLiveQuery(async () => ({ answers: await db.answers.count(), cards: await db.cards.count(), materials: await db.materials.count(), lastExport: (await db.meta.get('lastExport'))?.value as string | undefined }), [])
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [])

  const doExport = async () => {
    const json = await exportBackup(includeFiles)
    const r = await saveFile(`study-os-sicherung-${dayKey()}${activeKind === 'demo' ? '-demo' : ''}.json`, json)
    if (r === 'saved') {
      await db.meta.put({ key: 'lastExport', value: new Date().toISOString() })
      toast({ title: 'Sicherung erstellt', description: `${Math.round(json.length / 1024)} KB`, tone: 'success' })
    }
  }
  const exportCsv = async () => {
    const [answers, questions, topics] = await Promise.all([db.answers.toArray(), db.questions.toArray(), db.topics.toArray()])
    const q = new Map(questions.map((x) => [x.id, x]))
    const t = new Map(topics.map((x) => [x.id, x.name]))
    const rows = [['Datum', 'Thema', 'Frage', 'Antwort', 'Richtig', 'Punkte-Anteil', 'Modus'], ...answers.sort((a, b) => a.at.localeCompare(b.at)).map((a) => [formatDateTime(a.at), t.get(a.topicId) ?? '', (q.get(a.questionId)?.prompt ?? '').replace(/\s+/g, ' ').slice(0, 300), a.given, a.correct ? 'ja' : 'nein', String(a.score).replace('.', ','), a.mode === 'exam' ? 'Prüfung' : 'Übung'])]
    await saveFile(`study-os-antworten-${dayKey()}.csv`, toCsv(rows), 'text/csv')
  }
  const onFile = async (f?: File) => {
    if (!f) return
    const res = checkBackup(await f.text())
    if (!res.ok) toast({ title: 'Sicherung ungültig', description: res.error, tone: 'danger' })
    setPending(res.ok ? res : null)
  }
  const restore = async () => {
    if (!pending?.backup) return
    await restoreBackup(pending.backup)
    // signed in: the restored state is not pushed blindly – the next sync asks how to combine it with the account
    if (activeKind === 'main') await cloud.afterLocalReplaced()
    setPending(null)
    toast({ title: 'Sicherung wiederhergestellt', description: cloud.phase === 'signedIn' ? 'Study OS fragt gleich, wie sie mit deinem Konto zusammengeführt werden soll.' : undefined, tone: 'success' })
    setTimeout(() => location.reload(), 600)
  }
  const wipe = async () => {
    if (cloud.phase === 'signedIn' && activeKind === 'main') await cloud.wipeEverything(wipeCloud)
    else await wipeDatabase()
    setWipeOpen(false)
    location.hash = '#/'
    location.reload()
  }

  return (
    <Section id="daten" title="Daten & Sicherung" description={cloud.phase === 'signedIn' ? 'Deine Daten liegen in diesem Browser und werden mit deinem Konto abgeglichen. Eine eigene Sicherungsdatei ist trotzdem sinnvoll.' : 'Alles liegt lokal in diesem Browser. Ohne Anmeldung wird nichts zwischen Geräten abgeglichen – zum Übertragen brauchst du eine Sicherung.'}>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <HardDrive className="mt-0.5 size-5 text-fg-muted" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">{activeKind === 'demo' ? 'Demo-Datenbank (Beispieldaten)' : 'Deine Daten'}</div>
            <div className="text-fg-muted">{usage ? `${usage.answers} Antworten · ${usage.cards} Karteikarten · ${usage.materials} Materialien` : '…'}</div>
            <div className="text-xs text-fg-subtle">{usage?.lastExport ? `Letzte Sicherung: ${formatDateTime(usage.lastExport)}` : 'Noch keine Sicherung erstellt.'} {persisted === true ? 'Der Browser hat dauerhaften Speicher zugesagt.' : persisted === false ? 'Der Browser darf die Daten bei Speichermangel löschen.' : ''}</div>
          </div>
        </div>
        {persisted === false && navigator.storage?.persist && (
          <Button size="sm" className="self-start" onClick={async () => { const p = await navigator.storage.persist(); setPersisted(p); toast({ title: p ? 'Speicher ist jetzt dauerhaft' : 'Der Browser hat abgelehnt', description: p ? undefined : 'Erstelle regelmäßig Sicherungen.' }) }}>Dauerhaften Speicher anfragen</Button>
        )}
      </Card>
      <div className="flex flex-col gap-2">
        <Checkbox checked={includeFiles} onChange={setIncludeFiles} label="Originaldateien (PDFs, Fotos) mit sichern" description="Macht die Sicherung größer. Ohne Dateien bleiben die erkannten Texte erhalten." />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={Download} onClick={doExport}>Sicherung herunterladen (JSON)</Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>Sicherung wiederherstellen</Button>
          <Button icon={Download} onClick={exportCsv}>Antworten als CSV</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="Sicherungsdatei wählen" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <div className="text-sm font-semibold">Beispielinhalte entfernen</div>
        <p className="text-sm text-fg-muted">Löscht die vorgegebenen Beispielthemen, Beispielaufgaben und Beispielvokabeln. Deine Fächer und alles, was du selbst angelegt hast, bleiben erhalten. Ein Beispielthema, in dem schon eigene Notizen, Karten oder Aufgaben stecken, bleibt ebenfalls und gilt dann als dein eigenes.</p>
        <Button size="sm" className="self-start" icon={Trash2} onClick={async () => {
          if (!(await confirm({ title: 'Beispielinhalte entfernen?', message: 'Die vorgegebenen Themen, Aufgaben und Vokabeln werden gelöscht. Deine eigenen Inhalte bleiben.', confirmLabel: 'Entfernen' }))) return
          const r = await removeExampleContent()
          toast({ title: 'Beispielinhalte entfernt', description: `${r.topics} Themen, ${r.questions} Aufgaben und ${r.cards} Karten gelöscht.${r.keptTopics ? ` ${r.keptTopics} Themen mit eigenen Inhalten behalten.` : ''}`, tone: 'success' })
        }}>Beispielinhalte entfernen</Button>
      </div>

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Beispiel-Lehrplan nachladen (optional)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm text-fg-muted">Fügt Beispielthemen, Aufgaben und Vokabeln für Klasse 9 hinzu. Vorhandenes wird nicht überschrieben. {CURRICULUM_NOTICE}</p>
          <div className="grid gap-x-4 sm:grid-cols-3">
            {CURRICULUM.map((c) => <Checkbox key={c.key} checked={seedKeys.includes(c.key)} onChange={(v) => setSeedKeys((ks) => (v ? [...ks, c.key] : ks.filter((k) => k !== c.key)))} label={c.name} />)}
          </div>
          <Button size="sm" className="self-start" disabled={seedKeys.length === 0} onClick={async () => { const r = await seedLibrary(seedKeys); toast({ title: 'Beispielinhalte ergänzt', description: `${r.subjects} Fächer, ${r.topics} Themen, ${r.questions} Fragen, ${r.cards} Karten neu.`, tone: 'success' }); setSeedKeys([]) }}>Hinzufügen</Button>
        </div>
      </details>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><FlaskConical className="size-4" /> Demo</div>
        <p className="text-sm text-fg-muted">Die Demo nutzt eine eigene, getrennte Datenbank mit erfundenen Daten. Deine echten Daten werden dabei nicht verändert.</p>
        <div className="flex flex-wrap gap-2">
          {activeKind === 'demo' ? (
            <>
              <Button size="sm" variant="primary" onClick={() => switchDatabase('main')}>Zu meinen echten Daten</Button>
              <Button size="sm" onClick={async () => { if (await confirm({ title: 'Demo zurücksetzen?', message: 'Alle Änderungen in der Demo werden verworfen und neue Beispieldaten erzeugt.', confirmLabel: 'Zurücksetzen' })) { await wipeDatabase(); location.reload() } }}>Demo zurücksetzen</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => switchDatabase('demo')}>Demo ansehen</Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-danger/30 p-4">
        <div className="text-sm font-semibold text-danger">Alle Daten löschen</div>
        <p className="text-sm text-fg-muted">Löscht {activeKind === 'demo' ? 'die Demo-Datenbank' : 'alle deine Fächer, Antworten, Karten, Materialien und Einstellungen'} auf diesem Gerät. Das lässt sich nicht rückgängig machen.</p>
        <Button size="sm" variant="danger" icon={Trash2} className="self-start" onClick={() => { setWipeText(''); setWipeOpen(true) }}>Alles löschen …</Button>
      </div>

      <Dialog open={!!pending} onClose={() => setPending(null)} title="Sicherung wiederherstellen?" footer={<><Button onClick={() => setPending(null)}>Abbrechen</Button><Button variant="danger" onClick={restore}>Aktuelle Daten ersetzen</Button></>}>
        {pending?.backup && (
          <div className="flex flex-col gap-2 text-sm text-fg-muted">
            <p>Sicherung vom {formatDateTime(pending.backup.exportedAt)} ({pending.backup.database === 'demo' ? 'Demo' : 'echte Daten'}).</p>
            <p>Enthält {pending.counts?.answers ?? 0} Antworten, {pending.counts?.cards ?? 0} Karten, {pending.counts?.subjects ?? 0} Fächer, {pending.counts?.materials ?? 0} Materialien{pending.backup.files ? ` und ${pending.backup.files.length} Originaldateien` : ''}.</p>
            <Notice tone="warn">Alle aktuellen Daten in dieser Datenbank werden durch die Sicherung <strong>ersetzt</strong>. Erstelle vorher eine Sicherung, wenn du unsicher bist.</Notice>
          </div>
        )}
      </Dialog>
      <Dialog open={wipeOpen} onClose={() => setWipeOpen(false)} title="Wirklich alles löschen?" size="sm" footer={<><Button onClick={() => setWipeOpen(false)}>Abbrechen</Button><Button variant="danger" disabled={wipeText !== 'LÖSCHEN'} onClick={wipe}>Endgültig löschen</Button></>}>
        <div className="flex flex-col gap-3 text-sm text-fg-muted">
          {cloud.phase === 'signedIn' && activeKind === 'main' && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Checkbox checked={wipeCloud} onChange={setWipeCloud} label="Auch alle Daten in meinem Konto löschen" description={wipeCloud ? 'Betrifft alle Geräte. Vorher wird eine Sicherheitskopie gespeichert.' : 'Nur dieses Gerät: Du wirst abgemeldet, dein Konto behält die Daten.'} />
            </div>
          )}
          <p>Tippe <strong className="text-fg">LÖSCHEN</strong> ein, um zu bestätigen.</p>
          <Input value={wipeText} onChange={(e) => setWipeText(e.target.value)} aria-label="Bestätigung" autoComplete="off" />
        </div>
      </Dialog>
    </Section>
  )
}
