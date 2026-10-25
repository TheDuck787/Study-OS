import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle, BookOpen, ClipboardCopy, Download, FileJson, FileUp, GraduationCap, Info, Layers, ListChecks, NotebookPen, Package, PenLine, Play, RotateCcw, Sparkles,
} from 'lucide-react'
import { db } from '@/db/index'
import { getPackageRegistry, importPackage, startTopicExam, type ImportSummary } from '@/db/packages'
import { ValidationError } from '@/db/repo'
import { Badge, Button, ButtonLink, Card, Checkbox, cn, Dialog, Field, Input, Notice, PageHeader, Segmented, Select, Textarea, useToast } from '@/components/ui'
import { Celebrate } from '@/components/motion'
import { saveFile } from '@/lib/download'
import { dayKey } from '@/lib/dates'
import { undoLast } from '@/lib/undo'
import { countPackage, LEVEL_LABEL, type LearningPackage } from '@/lib/packages/schema'
import { parsePackageFile } from '@/lib/packages/markdown'
import { packagePrompt, packageTemplate } from '@/lib/packages/build'
import type { Issue, ValidationResult } from '@/lib/packages/validate'

const EXAMPLE_URL = 'lernpakete/deutsch-textanalyse-klasse-9.json'
const MAX_BYTES = 3_000_000
const NEW = '__new__'
const TYPE_LABEL = { 'multiple-choice': 'Auswahl', 'true-false': 'Wahr/Falsch', open: 'Offen', number: 'Zahl' } as const

type Loaded = ValidationResult & { kind: 'json' | 'markdown'; fileName: string }

/**
 * Import of learning packages: choose a file (or the example / pasted text) → automatic check with clear
 * messages → preview → choose subject and topic → import → summary with links. Nothing is saved before
 * the student clicks "Importieren", and the import can be undone right afterwards.
 */
export default function PackageImportPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [paste, setPaste] = useState<string | null>(null)
  const [summary, setSummary] = useState<(ImportSummary & { pkg: LearningPackage }) | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)

  const read = (fileName: string, text: string) => {
    setSummary(null)
    setLoaded({ ...parsePackageFile(fileName, text), fileName })
  }
  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) return setLoaded({ pkg: null, errors: [{ where: file.name, message: 'Die Datei ist zu groß (höchstens 3 MB).' }], warnings: [], extras: [], kind: 'json', fileName: file.name })
    if (/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g)$/i.test(file.name)) return setLoaded({ pkg: null, errors: [{ where: file.name, message: 'Lernpakete sind JSON-, Markdown- oder TXT-Dateien. PDFs und Fotos importierst du unter Bibliothek → Importieren.' }], warnings: [], extras: [], kind: 'json', fileName: file.name })
    read(file.name, await file.text())
  }
  const loadExample = async () => {
    setBusy(true)
    try {
      const res = await fetch(EXAMPLE_URL)
      if (!res.ok) throw new Error(String(res.status))
      read('deutsch-textanalyse-klasse-9.json', await res.text())
    } catch {
      toast({ title: 'Das Beispiel konnte nicht geladen werden', description: 'Bist du offline? Die Datei liegt im Projekt unter public/lernpakete/.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Bibliothek"
        title="Lernpaket importieren"
        description="Ein Lernpaket enthält alles zu einem Thema: Erklärungen, Beispiele, Fachbegriffe, Fragen mit Lösungen, Karteikarten, Übungen und einen Lernzettel. Es wird geprüft, bevor etwas gespeichert wird."
        actions={<>
          <Button icon={Download} onClick={() => saveFile('lernpaket-vorlage.json', `${JSON.stringify(packageTemplate(), null, 2)}\n`, 'application/json')}>Vorlage herunterladen</Button>
          <Button icon={Sparkles} onClick={() => setPromptOpen(true)}>KI-Prompt</Button>
        </>}
      />

      {summary ? (
        <ImportDone summary={summary} onAgain={() => { setSummary(null); setLoaded(null) }} onExam={async () => {
          try {
            navigate(`/quiz/${await startTopicExam(summary.topicId)}`)
          } catch (e) {
            toast({ title: e instanceof ValidationError ? e.message : 'Das hat nicht geklappt', tone: 'danger' })
          }
        }} />
      ) : (
        <>
          <Card className="flex flex-col gap-4 p-5">
            <label
              className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors', drag ? 'border-accent bg-accent-soft' : 'border-border-strong hover:border-accent')}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); void onFile(e.dataTransfer.files[0]) }}
            >
              <FileUp className="size-7 text-accent" aria-hidden />
              <span className="font-medium">{loaded ? loaded.fileName : 'Datei hierher ziehen oder auswählen'}</span>
              <span className="text-sm text-fg-muted">JSON (empfohlen), Markdown (.md) oder Text (.txt)</span>
              <input type="file" accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain" className="sr-only" aria-label="Lernpaket-Datei" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button icon={BookOpen} onClick={loadExample} loading={busy}>Beispiel laden: Deutsch – Textanalyse (Kl. 9)</Button>
              <Button icon={PenLine} variant="ghost" onClick={() => setPaste(paste === null ? '' : null)} aria-expanded={paste !== null}>Text einfügen</Button>
              <Link to="/bibliothek/import" className="ml-auto text-sm text-fg-muted hover:text-accent">PDF oder Foto? → Material importieren</Link>
            </div>
            {paste !== null && (
              <div className="flex flex-col gap-2">
                <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{ "format": "studyos-learning-package", … }  oder ein Markdown-Lernpaket' aria-label="Lernpaket als Text" className="min-h-40 font-mono text-sm" />
                <div className="flex justify-end"><Button variant="primary" disabled={!paste.trim()} onClick={() => read(paste.trim().startsWith('{') ? 'eingefuegt.json' : 'eingefuegt.md', paste)}>Prüfen</Button></div>
              </div>
            )}
          </Card>

          {loaded && <ResultView key={loaded.fileName + loaded.errors.length} loaded={loaded} presetSubjectId={params.get('fach')} onImported={(s, pkg) => {
            setSummary({ ...s, pkg })
            toast({ title: 'Lernpaket importiert', tone: 'success', action: { label: 'Rückgängig', onClick: () => void undoLast().then(() => { setSummary(null); toast({ title: 'Import rückgängig gemacht' }) }) } })
          }} />}
          {!loaded && <FormatHelp />}
        </>
      )}
      <PromptDialog open={promptOpen} onClose={() => setPromptOpen(false)} />
    </div>
  )
}

function IssueList({ items, max = 40 }: { items: Issue[]; max?: number }) {
  return (
    <ul className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto">
      {items.slice(0, max).map((e, i) => <li key={i}><span className="font-medium text-fg">{e.where}:</span> {e.message}</li>)}
      {items.length > max && <li>… und {items.length - max} weitere.</li>}
    </ul>
  )
}

function ResultView({ loaded, presetSubjectId, onImported }: { loaded: Loaded; presetSubjectId: string | null; onImported: (s: ImportSummary, pkg: LearningPackage) => void }) {
  const uidBase = useId()
  const id = (s: string) => `${uidBase}-${s}`
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), [])
  const topics = useLiveQuery(() => db.topics.toArray(), [])
  const exams = useLiveQuery(() => db.exams.toArray(), [])
  const registry = useLiveQuery(() => getPackageRegistry(), [])
  const pkg = loaded.pkg
  const [subjectSel, setSubjectSel] = useState<string | null>(null)
  const [newSubject, setNewSubject] = useState(pkg?.subject ?? '')
  const [topicMode, setTopicMode] = useState<'new' | 'existing' | null>(null)
  const [newTopic, setNewTopic] = useState(pkg?.topic ?? '')
  const [topicSel, setTopicSel] = useState('')
  const [termsAsCards, setTermsAsCards] = useState(true)
  const [examId, setExamId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // sensible defaults: matching subject/topic by name (or the subject the page was opened from)
  const matchSubject = subjects?.find((s) => s.id === presetSubjectId) ?? subjects?.find((s) => s.name.toLowerCase() === pkg?.subject.toLowerCase())
  const subjectId = subjectSel ?? matchSubject?.id ?? NEW
  const subjectTopics = (topics ?? []).filter((t) => t.subjectId === subjectId).sort((a, b) => a.order - b.order)
  const matchTopic = subjectTopics.find((t) => t.name.toLowerCase() === pkg?.topic.toLowerCase())
  const mode = topicMode ?? (matchTopic ? 'existing' : 'new')
  const topicId = topicSel || matchTopic?.id || subjectTopics[0]?.id || ''
  const today = dayKey()
  const subjectExams = (exams ?? []).filter((x) => x.subjectId === subjectId && x.date >= today)
  const counts = pkg ? countPackage(pkg) : null
  const previous = pkg && registry?.[pkg.id]
  useEffect(() => setError(null), [subjectId, mode, topicId])

  const doImport = async () => {
    if (!pkg) return
    setBusy(true)
    setError(null)
    try {
      const s = await importPackage(pkg, {
        subject: subjectId === NEW ? { create: newSubject } : { id: subjectId },
        topic: mode === 'new' || subjectId === NEW ? { create: newTopic } : { id: topicId },
      }, { termsAsCards: termsAsCards && !!pkg.keyTerms?.length, examId: examId || null, extras: loaded.extras })
      onImported(s, pkg)
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Der Import hat nicht geklappt. Es wurde nichts gespeichert.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {loaded.errors.length > 0 && (
        <Notice tone="danger" icon={AlertTriangle} title={`Die Datei kann so nicht importiert werden (${loaded.errors.length} Problem${loaded.errors.length === 1 ? '' : 'e'})`}>
          <IssueList items={loaded.errors} />
          <p className="mt-2">Korrigiere die Datei und lade sie erneut. Es wurde nichts gespeichert. Hilfe zum Format: <code>docs/lernpakete/README.md</code> oder „Vorlage herunterladen“.</p>
        </Notice>
      )}
      {loaded.warnings.length > 0 && (
        <details className="rounded-lg border border-warn/35 bg-warn-soft px-3.5 py-3 text-sm" open={!pkg}>
          <summary className="cursor-pointer font-medium"><Info className="size-4 text-warn" aria-hidden />{loaded.warnings.length} Hinweis{loaded.warnings.length === 1 ? '' : 'e'} – bitte kurz prüfen</summary>
          <div className="mt-2 text-fg-muted"><IssueList items={loaded.warnings} /></div>
        </details>
      )}

      {pkg && counts && (
        <>
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow mb-1 flex items-center gap-1.5"><Package className="size-3.5" aria-hidden />Vorschau · {loaded.kind === 'json' ? 'JSON' : 'Markdown/TXT'}</div>
                <h2 className="text-lg font-semibold">{pkg.title}</h2>
                <p className="text-sm text-fg-muted">{pkg.subject} → {pkg.topic}{pkg.level ? ` · ${pkg.level}` : ''}{pkg.author ? ` · ${pkg.author}` : ''}</p>
              </div>
              <Badge tone="success">Gültig</Badge>
            </div>
            {pkg.description && <p className="text-sm text-fg-muted">{pkg.description}</p>}
            {previous && (
              <Notice tone="accent" icon={Info} title="Dieses Paket wurde schon importiert">
                Zuletzt am {new Date(previous.lastImportedAt).toLocaleDateString('de-DE')} in „{previous.subject} → {previous.topic}“. Ein erneuter Import legt nur Inhalte an, die noch fehlen – nichts doppelt, und deine Änderungen bleiben erhalten.
              </Notice>
            )}
            <dl className="stagger grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Inhalt des Pakets">
              {([
                ['Erklärungen', counts.notes - counts.examples, NotebookPen], ['Beispiele', counts.examples, PenLine], ['Fachbegriffe', counts.keyTerms, BookOpen], ['Fragen', counts.questions, ListChecks],
                ['davon Prüfung', counts.examQuestions, GraduationCap], ['Übungen', counts.exercises, PenLine], ['Karteikarten', counts.flashcards, Layers], ['Typische Fehler', counts.mistakes, AlertTriangle],
              ] as [string, number, typeof Layers][]).map(([label, value, Icon]) => (
                <div key={label} className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-xs text-fg-subtle"><Icon className="size-3.5" aria-hidden />{label}</dt>
                  <dd className="text-lg font-semibold tabular">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-1.5">
              {!!pkg.objectives?.length && <PreviewList title={`Lernziele (${pkg.objectives.length})`} items={pkg.objectives} />}
              {!!pkg.notes?.length && <PreviewList title={`Erklärungen (${pkg.notes.length})`} items={pkg.notes.map((n) => n.title)} />}
              {!!pkg.examples?.length && <PreviewList title={`Beispiele (${pkg.examples.length})`} items={pkg.examples.map((e) => `${e.title}${e.steps?.length ? ` – ${e.steps.length} Schritte` : ''}`)} />}
              {!!pkg.questions?.length && <PreviewList title={`Fragen (${pkg.questions.length})`} items={pkg.questions.map((q) => `[${TYPE_LABEL[q.type]}${q.exam ? ', Prüfung' : ''}] ${q.prompt}`)} />}
              {!!pkg.exercises?.length && <PreviewList title={`Übungen (${pkg.exercises.length})`} items={pkg.exercises.map((e) => `[${LEVEL_LABEL[e.level]}] ${e.prompt}`)} />}
              {!!pkg.flashcards?.length && <PreviewList title={`Karteikarten (${pkg.flashcards.length})`} items={pkg.flashcards.map((f) => `${f.front} → ${f.back}`)} />}
              {!!pkg.keyTerms?.length && <PreviewList title={`Fachbegriffe (${pkg.keyTerms.length})`} items={pkg.keyTerms.map((k) => `${k.term}: ${k.definition}`)} />}
              {!!pkg.mistakes?.length && <PreviewList title={`Typische Fehler (${pkg.mistakes.length})`} items={pkg.mistakes.map((m) => m.mistake)} />}
              {pkg.summary && <PreviewList title="Lernzettel" items={pkg.summary.split('\n').filter((l) => l.trim())} />}
              {loaded.extras.length > 0 && <PreviewList title={`Zusätzliche Angaben (${loaded.extras.length}) – werden als Notiz aufbewahrt`} items={loaded.extras.map((x) => x.where)} />}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="text-md font-semibold">Wohin soll das Paket?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fach" htmlFor={id('subject')}>
                <Select id={id('subject')} value={subjectId} onChange={(e) => { setSubjectSel(e.target.value); setTopicSel(''); setTopicMode(null); setExamId('') }}>
                  {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value={NEW}>+ Neues Fach anlegen</option>
                </Select>
              </Field>
              {subjectId === NEW && (
                <Field label="Name des neuen Fachs" htmlFor={id('newsub')}>
                  <Input id={id('newsub')} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} maxLength={60} />
                </Field>
              )}
            </div>
            {subjectId !== NEW && subjectTopics.length > 0 && (
              <Segmented<'new' | 'existing'> label="Thema" value={mode} onChange={setTopicMode} options={[{ value: 'new', label: 'Neues Thema anlegen' }, { value: 'existing', label: 'Zu bestehendem Thema hinzufügen' }]} />
            )}
            {mode === 'existing' && subjectId !== NEW && subjectTopics.length > 0 ? (
              <Field label="Bestehendes Thema" htmlFor={id('topic')} hint="Vorhandene Notizen, Fragen und Karten bleiben unverändert; gleiche Inhalte werden nicht doppelt angelegt.">
                <Select id={id('topic')} value={topicId} onChange={(e) => setTopicSel(e.target.value)}>
                  {subjectTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Name des neuen Themas" htmlFor={id('newtopic')}>
                <Input id={id('newtopic')} value={newTopic} onChange={(e) => setNewTopic(e.target.value)} maxLength={120} />
              </Field>
            )}
            <div className="flex flex-col gap-1">
              {!!pkg.keyTerms?.length && <Checkbox checked={termsAsCards} onChange={setTermsAsCards} label={`Fachbegriffe zusätzlich als Karteikarten (${pkg.keyTerms.length})`} description="So kannst du sie mit Wiederholungsplan lernen." />}
              {subjectExams.length > 0 && (
                <Field label="Für eine Prüfung vormerken (Lernplaner)" htmlFor={id('exam')} optional hint="Das Thema wird der Prüfung zugeordnet – „Plan neu berechnen“ berücksichtigt es dann.">
                  <Select id={id('exam')} value={examId} onChange={(e) => setExamId(e.target.value)}>
                    <option value="">– keine –</option>
                    {subjectExams.map((x) => <option key={x.id} value={x.id}>{x.title} ({new Date(x.date).toLocaleDateString('de-DE')})</option>)}
                  </Select>
                </Field>
              )}
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-fg-subtle">Wird lokal gespeichert und – wenn du angemeldet bist – synchronisiert.</span>
              <Button variant="primary" icon={FileJson} onClick={doImport} loading={busy}>Importieren</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="rounded-lg border border-border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <ol className="mt-2 flex max-h-64 list-decimal flex-col gap-1 overflow-y-auto pl-5 text-fg-muted">
        {items.map((it, i) => <li key={i} className="break-words">{it.length > 220 ? `${it.slice(0, 220)} …` : it}</li>)}
      </ol>
    </details>
  )
}

function ImportDone({ summary: s, onAgain, onExam }: { summary: ImportSummary & { pkg: LearningPackage }; onAgain: () => void; onExam: () => void }) {
  const total = s.created.notes + s.created.questions + s.created.exercises + s.created.flashcards
  const skipped = s.skipped.notes + s.skipped.questions + s.skipped.exercises + s.skipped.flashcards
  const rows: [string, number, number][] = [['Notizen', s.created.notes, s.skipped.notes], ['Fragen', s.created.questions, s.skipped.questions], ['Übungen', s.created.exercises, s.skipped.exercises], ['Karteikarten', s.created.flashcards, s.skipped.flashcards]]
  return (
    <Card className="flex flex-col gap-5 p-6" aria-labelledby="import-done">
      <Celebrate when={total > 0} anchor="#import-done" />
      <div>
        <div className="eyebrow mb-1">Import abgeschlossen</div>
        <h2 id="import-done" className="text-xl font-semibold">{total > 0 ? `„${s.pkg.title}“ ist jetzt in Study OS` : 'Alles war schon vorhanden'}</h2>
        <p className="mt-1 text-sm text-fg-muted">{s.pkg.subject} → {s.pkg.topic}{s.subjectCreated ? ' · Fach neu angelegt' : ''}{s.topicCreated ? ' · Thema neu angelegt' : ''}{s.addedToExam ? ' · der Prüfung zugeordnet' : ''}</p>
      </div>
      <dl className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Import-Zusammenfassung">
        {rows.map(([label, c, sk]) => (
          <div key={label} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
            <dt className="text-xs text-fg-subtle">{label}</dt>
            <dd className="text-2xl font-semibold tabular">{c}</dd>
            {sk > 0 && <dd className="text-xs text-fg-muted">{sk} schon vorhanden</dd>}
          </div>
        ))}
      </dl>
      {skipped > 0 && <p className="text-sm text-fg-muted">{skipped} Einträge gab es schon – sie wurden nicht doppelt angelegt und nicht verändert.</p>}
      <div className="flex flex-wrap gap-2">
        <ButtonLink to={`/faecher/${s.subjectId}/themen/${s.topicId}`} variant="primary" icon={BookOpen}>Thema öffnen</ButtonLink>
        <ButtonLink to={`/quiz/neu?topic=${s.topicId}&preset=practice`} icon={Play}>Üben</ButtonLink>
        {s.deckId && <ButtonLink to={`/karteikarten/${s.deckId}`} icon={Layers}>Karteikarten</ButtonLink>}
        {s.examQuestionIds.length > 0 && <Button icon={GraduationCap} onClick={onExam}>Prüfungsmodus ({s.examQuestionIds.length} Fragen)</Button>}
        <Button variant="ghost" icon={RotateCcw} onClick={onAgain}>Weiteres Paket importieren</Button>
      </div>
    </Card>
  )
}

function FormatHelp() {
  return (
    <Card className="flex flex-col gap-3 p-5 text-sm">
      <h2 className="text-md font-semibold">So entsteht ein Lernpaket</h2>
      <ul className="stagger flex list-disc flex-col gap-1.5 pl-5 text-fg-muted">
        <li><strong className="text-fg">Vorlage:</strong> „Vorlage herunterladen“ – eine gültige JSON-Datei mit einem Eintrag pro Abschnitt zum Ausfüllen.</li>
        <li><strong className="text-fg">Mit einer KI:</strong> „KI-Prompt“ – Fach, Thema und Klasse eintragen, Prompt kopieren, Antwort als <code>.json</code> speichern und hier importieren. Prüfe KI-Inhalte immer auf Richtigkeit.</li>
        <li><strong className="text-fg">Aus einem Thema:</strong> Auf jeder Themenseite unter „⋯ → Als Lernpaket exportieren“ (JSON oder Markdown) – z. B. für ein anderes Gerät oder Mitschüler.</li>
        <li><strong className="text-fg">Format:</strong> beschrieben in <code>docs/lernpakete/README.md</code>, JSON Schema in <code>docs/lernpakete/lernpaket.schema.json</code>.</li>
      </ul>
    </Card>
  )
}

function PromptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const uidBase = useId()
  const [o, setO] = useState({ subject: '', topic: '', level: 'Klasse 9', language: 'Deutsch' })
  const text = useMemo(() => packagePrompt(o), [o])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Prompt kopiert', description: 'In einen KI-Chat einfügen, die Antwort als .json speichern und hier importieren.', tone: 'success' })
    } catch {
      toast({ title: 'Kopieren nicht möglich', description: 'Markiere den Text und kopiere ihn von Hand.', tone: 'danger' })
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Lernpaket mit einer KI erstellen" description="Der Prompt beschreibt das genaue Format – so kann jeder KI-Chat ein passendes Paket für jedes Fach erzeugen." size="lg"
      footer={<><Button onClick={onClose}>Schließen</Button><Button variant="primary" icon={ClipboardCopy} onClick={copy}>Prompt kopieren</Button></>}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Fach" htmlFor={`${uidBase}-s`}><Input id={`${uidBase}-s`} value={o.subject} onChange={(e) => setO({ ...o, subject: e.target.value })} placeholder="z. B. Biologie" /></Field>
          <Field label="Thema" htmlFor={`${uidBase}-t`}><Input id={`${uidBase}-t`} value={o.topic} onChange={(e) => setO({ ...o, topic: e.target.value })} placeholder="z. B. Fotosynthese" /></Field>
          <Field label="Stufe" htmlFor={`${uidBase}-l`}><Input id={`${uidBase}-l`} value={o.level} onChange={(e) => setO({ ...o, level: e.target.value })} /></Field>
        </div>
        <Textarea readOnly value={text} aria-label="Prompt" className="min-h-72 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Notice tone="warn" icon={AlertTriangle}>KI-Antworten können Fehler enthalten. Lies das Paket nach dem Import durch, bevor du damit für eine Arbeit lernst.</Notice>
      </div>
    </Dialog>
  )
}
