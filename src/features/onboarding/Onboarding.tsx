import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, FlaskConical, Info, RefreshCcw, UserRound } from 'lucide-react'
import { CURRICULUM, CURRICULUM_NOTICE } from '@/content/curriculum'
import { saveProfile, createSubject, saveExam, ValidationError } from '@/db/repo'
import { seedLibrary, subjectIdFor } from '@/db/seed'
import { switchDatabase } from '@/db/index'
import type { ExplanationMode } from '@/db/types'
import { Button, Card, Checkbox, cn, Field, Input, Notice, Segmented, Select, useToast } from '@/components/ui'
import { EXPLANATION_MODES } from '@/shared/ai'
import { addDays, dayKey } from '@/lib/dates'
import { useProfile } from '@/hooks/data'
import { useCloud } from '@/features/account/CloudProvider'
import { GoogleButton } from '@/features/account/GoogleButton'

const REGIONS = ['Mecklenburg-Vorpommern', 'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen']
const SCHOOL_TYPES = ['Gesamtschule', 'Regionale Schule', 'Gymnasium', 'Realschule', 'Oberschule', 'Gemeinschaftsschule', 'Sonstige']

export function Onboarding() {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const cloud = useCloud()
  const existingProfile = useProfile()
  // signed in on a second device: as soon as the profile arrives from the account, the app is ready
  useEffect(() => {
    if (existingProfile && step === 0) navigate('/', { replace: true })
  }, [existingProfile, step, navigate])
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(9)
  const [region, setRegion] = useState('Mecklenburg-Vorpommern')
  const [schoolType, setSchoolType] = useState('Gesamtschule')
  const [subjectKeys, setSubjectKeys] = useState<string[]>(['ma', 'de', 'en', 'bio', 'ch', 'ph', 'geo', 'ge'])
  const [useExample, setUseExample] = useState(false)
  const [ownSubjects, setOwnSubjects] = useState('')
  const [goal, setGoal] = useState(20)
  const [mode, setMode] = useState<ExplanationMode>('normal')
  const [examSubject, setExamSubject] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTitle, setExamTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    try {
      await saveProfile({ name: name.trim(), grade, region, schoolType, dailyGoalMinutes: goal, explanationMode: mode })
      if (useExample) await seedLibrary(subjectKeys)
      else for (const key of subjectKeys) {
        const cs = CURRICULUM.find((c) => c.key === key)
        if (cs) await createSubject(cs.name, cs.color).catch(() => {})
      }
      for (const n of ownSubjects.split(',').map((s) => s.trim()).filter(Boolean)) await createSubject(n).catch(() => {})
      if (examSubject && examDate) {
        const sid = useExample ? subjectIdFor(examSubject) : undefined
        const { db } = await import('@/db/index')
        const subject = sid ? await db.subjects.get(sid) : (await db.subjects.toArray()).find((s) => s.name === CURRICULUM.find((c) => c.key === examSubject)?.name)
        if (subject) {
          const id = await saveExam({ subjectId: subject.id, title: examTitle.trim() || `${subject.name}-Arbeit`, type: 'Klassenarbeit', date: examDate, topicIds: [], materialIds: [], difficulty: 2, minutesPerDay: Math.max(15, goal), availableWeekdays: [1, 2, 3, 4, 5, 6], notes: '', gradingScaleId: null })
          navigate(`/pruefungen/${id}?neu=plan`, { replace: true })
          return
        }
      }
      navigate('/', { replace: true })
    } catch (e) {
      toast({ title: 'Speichern fehlgeschlagen', description: e instanceof ValidationError || e instanceof Error ? e.message : String(e), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const steps = ['Start', 'Über dich', 'Fächer', 'Lernstil', 'Prüfung']
  return (
    <div className="min-h-full bg-bg" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <div className="mx-auto flex max-w-xl flex-col gap-6 py-10">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold">Study OS</span>
          {step > 0 && <span className="text-sm text-fg-subtle tabular">Schritt {step} von {steps.length - 1}</span>}
        </div>

        {step === 0 && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold">Lernen mit Plan – und in deinem Tempo.</h1>
              <p className="mt-3 text-fg-muted">
                Study OS merkt sich, was du schon kannst und was noch wackelt, und schlägt dir jeden Tag konkrete Aufgaben vor. Deine Daten bleiben auf diesem Gerät – mit Google-Anmeldung zusätzlich in deinem Konto, damit PC und Handy denselben Stand haben.
              </p>
            </div>
            <div className="grid gap-3">
              {cloud.phase === 'signedOut' && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                  <span>
                    <span className="block font-semibold">Schon auf einem anderen Gerät eingerichtet?</span>
                    <span className="block text-sm text-fg-muted">Melde dich an – deine Fächer, Karten, Termine und dein Lernstand werden auf dieses Gerät geladen.</span>
                  </span>
                  <GoogleButton onClick={cloud.signIn} className="self-start" />
                </div>
              )}
              {cloud.phase === 'signedIn' && (
                <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm" aria-live="polite">
                  <RefreshCcw className={cn('size-5 text-accent', cloud.sync.state === 'syncing' && 'animate-spin')} />
                  <span>Angemeldet als <strong>{cloud.user?.email}</strong>. {cloud.sync.state === 'syncing' ? 'Deine Daten werden geladen …' : cloud.sync.state === 'error' || cloud.sync.state === 'offline' ? cloud.sync.message : 'In deinem Konto sind noch keine Daten – richte dein Profil ein, es wird dann automatisch gesichert.'}</span>
                </div>
              )}
              <button type="button" onClick={() => setStep(1)} className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent-soft p-4 text-left cursor-pointer hover:border-accent">
                <UserRound className="mt-0.5 size-5 text-accent" aria-hidden />
                <span>
                  <span className="block font-semibold">Eigenes Profil einrichten</span>
                  <span className="block text-sm text-fg-muted">Dauert etwa eine Minute. Fünf kurze Fragen, alles später änderbar.</span>
                </span>
              </button>
              <button type="button" onClick={() => switchDatabase('demo')} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left cursor-pointer hover:border-border-strong">
                <FlaskConical className="mt-0.5 size-5 text-fg-muted" aria-hidden />
                <span>
                  <span className="block font-semibold">Erst die Demo ansehen</span>
                  <span className="block text-sm text-fg-muted">Mit erfundenen Beispieldaten. Die Demo ist komplett getrennt von deinen echten Daten.</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <Card className="flex flex-col gap-5 p-5">
            <h1 className="text-xl font-semibold">Über dich</h1>
            <Field label="Name oder Spitzname" htmlFor="ob-name" optional hint="Wird nur hier auf deinem Gerät gespeichert.">
              <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder="z. B. Mia" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Klassenstufe" htmlFor="ob-grade">
                <Select id="ob-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => (
                    <option key={g} value={g}>Klasse {g}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Schulform" htmlFor="ob-school">
                <Select id="ob-school" value={schoolType} onChange={(e) => setSchoolType(e.target.value)}>
                  {SCHOOL_TYPES.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Bundesland" htmlFor="ob-region">
              <Select id="ob-region" value={region} onChange={(e) => setRegion(e.target.value)}>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
          </Card>
        )}

        {step === 2 && (
          <Card className="flex flex-col gap-5 p-5">
            <div>
              <h1 className="text-xl font-semibold">Deine Fächer</h1>
              <p className="mt-1 text-sm text-fg-muted">Wähle, wofür du lernen möchtest. Die Fächer starten leer – Themen, Notizen, Karten und Aufgaben legst du selbst an. Weitere Fächer kannst du jederzeit hinzufügen.</p>
            </div>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {CURRICULUM.map((c) => (
                <Checkbox key={c.key} checked={subjectKeys.includes(c.key)} onChange={(v) => setSubjectKeys((ks) => (v ? [...ks, c.key] : ks.filter((k) => k !== c.key)))} label={c.name} />
              ))}
            </div>
            <Field label="Weitere Fächer" htmlFor="ob-own" optional hint="Mit Komma trennen, z. B. Französisch, Informatik, Kunst">
              <Input id="ob-own" value={ownSubjects} onChange={(e) => setOwnSubjects(e.target.value)} />
            </Field>
            <Checkbox
              checked={useExample}
              onChange={setUseExample}
              label="Optional: Beispielthemen, Beispielaufgaben und Vokabeln übernehmen"
              description="Normalerweise aus lassen. Die Beispiele lassen sich später in den Einstellungen wieder entfernen."
            />
            {useExample && (
              <Notice tone="warn" icon={Info} title="Nicht amtlich geprüft">
                {CURRICULUM_NOTICE}
              </Notice>
            )}
          </Card>
        )}

        {step === 3 && (
          <Card className="flex flex-col gap-5 p-5">
            <h1 className="text-xl font-semibold">Wie möchtest du lernen?</h1>
            <Field label="Tagesziel" htmlFor="ob-goal" hint="Lieber realistisch: Kurze, regelmäßige Einheiten wirken besser als seltene lange.">
              <Segmented label="Tagesziel" value={goal} onChange={setGoal} options={[10, 20, 30, 45].map((m) => ({ value: m, label: `${m} Min.` }))} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Wie sollen Erklärungen sein?</legend>
              {(Object.keys(EXPLANATION_MODES) as ExplanationMode[]).map((k) => (
                <label key={k} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', mode === k ? 'border-accent bg-accent-soft' : 'border-border')}>
                  <input type="radio" name="ob-mode" className="mt-1 accent-[var(--accent-solid)]" checked={mode === k} onChange={() => setMode(k)} />
                  <span>
                    <span className="block text-sm font-medium">{EXPLANATION_MODES[k].label}</span>
                    <span className="block text-xs text-fg-muted">{EXPLANATION_MODES[k].instruction.split(':')[0]}.</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </Card>
        )}

        {step === 4 && (
          <Card className="flex flex-col gap-5 p-5">
            <div>
              <h1 className="text-xl font-semibold">Steht bald eine Prüfung an?</h1>
              <p className="mt-1 text-sm text-fg-muted">Optional. Dann bekommst du direkt einen Lernplan. Du kannst das auch überspringen.</p>
            </div>
            <Field label="Fach" htmlFor="ob-exam-subject">
              <Select id="ob-exam-subject" value={examSubject} onChange={(e) => setExamSubject(e.target.value)}>
                <option value="">– keine Prüfung –</option>
                {CURRICULUM.filter((c) => subjectKeys.includes(c.key)).map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </Select>
            </Field>
            {examSubject && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Datum" htmlFor="ob-exam-date">
                  <Input id="ob-exam-date" type="date" min={addDays(dayKey(), 1)} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                </Field>
                <Field label="Bezeichnung" htmlFor="ob-exam-title" optional>
                  <Input id="ob-exam-title" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="z. B. Klassenarbeit Pythagoras" />
                </Field>
              </div>
            )}
          </Card>
        )}

        {step > 0 && (
          <div className="flex items-center justify-between">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
              Zurück
            </Button>
            {step < 4 ? (
              <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep(step + 1)} disabled={step === 2 && subjectKeys.length === 0 && !ownSubjects.trim()}>
                Weiter
              </Button>
            ) : (
              <Button variant="primary" onClick={finish} loading={busy} disabled={!!examSubject && !examDate}>
                {examSubject ? 'Fertig – Lernplan erstellen' : 'Fertig'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
