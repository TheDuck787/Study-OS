import { useEffect, useState } from 'react'
import { FileUp } from 'lucide-react'
import type { Subject, TimetableSettings } from '@/db/types'
import { addExtraLesson, importLessons } from '@/db/timetable'
import { createSubject, ValidationError } from '@/db/repo'
import { Badge, Button, Checkbox, Dialog, Notice, useToast } from '@/components/ui'
import { parseDay, WEEKDAYS_SHORT } from '@/lib/dates'
import { parseTimetableCsv, type LessonDraft } from '@/lib/timetable/csv'
import { icsToDrafts, parseIcs, type IcsEvent } from '@/lib/timetable/ics'
import { isoWeek } from '@/lib/timetable/core'
import { undoLast } from '@/lib/undo'

interface Preview {
  kind: 'csv' | 'ics'
  fileName: string
  drafts: LessonDraft[]
  errors: { line: number; message: string }[]
  singles: IcsEvent[]
  skipped: { allDay: number; cancelled: number; other: number } | null
  suggestedWeekAMonday: string | null
}

const MAX_FILE = 2_000_000

/** Safe import: parse locally → preview with every problem → save only after the student confirms. */
export function ImportDialog({ open, onClose, settings, subjects }: { open: boolean; onClose: () => void; settings: TimetableSettings; subjects: Subject[] }) {
  const toast = useToast()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createSubjects, setCreateSubjects] = useState(true)
  const [takeSingles, setTakeSingles] = useState(false)
  const [takeAB, setTakeAB] = useState(true)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) {
      setPreview(null)
      setError(null)
      setTakeSingles(false)
    }
  }, [open])

  const onFile = async (file: File | undefined) => {
    setError(null)
    setPreview(null)
    if (!file) return
    if (file.size > MAX_FILE) return setError('Die Datei ist zu groß (höchstens 2 MB).')
    const text = await file.text()
    const isIcs = /\.ics$/i.test(file.name) || /BEGIN:VCALENDAR/i.test(text.slice(0, 2000))
    if (isIcs) {
      const parsed = parseIcs(text)
      if (parsed.error && !parsed.events.length) return setError(parsed.error)
      const res = icsToDrafts(parsed.events, settings.weekAMonday)
      setPreview({ kind: 'ics', fileName: file.name, drafts: res.drafts, errors: parsed.error ? [{ line: 0, message: parsed.error }] : [], singles: res.singles, skipped: res.skipped, suggestedWeekAMonday: res.suggestedWeekAMonday })
    } else {
      const res = parseTimetableCsv(text, settings.periods)
      setPreview({ kind: 'csv', fileName: file.name, drafts: res.drafts, errors: res.errors, singles: [], skipped: null, suggestedWeekAMonday: null })
    }
  }

  const known = (name: string) => subjects.some((s) => s.name.toLowerCase() === name.toLowerCase() || (s.short ?? '').toLowerCase() === name.toLowerCase())
  const missing = preview ? [...new Set(preview.drafts.map((d) => d.subject).filter((n) => !known(n)))] : []
  const needsAB = !!preview && !settings.weekAMonday && preview.drafts.some((d) => d.weekType)

  const doImport = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const res = await importLessons(preview.drafts, { createSubjects, weekAMonday: takeAB ? preview.suggestedWeekAMonday : null })
      let singles = 0
      if (takeSingles) {
        for (const e of preview.singles) {
          let subjectId = subjects.find((s) => s.name.toLowerCase() === e.summary.toLowerCase())?.id ?? null
          if (!subjectId && createSubjects && e.summary) subjectId = await createSubject(e.summary).catch(() => null)
          await addExtraLesson(e.date, { subjectId, start: e.start!, end: e.end!, period: null, periodEnd: null, teacher: '', location: e.location, note: subjectId ? '' : e.summary })
          singles++
        }
      }
      toast({ title: `${res.created + singles} Stunde${res.created + singles === 1 ? '' : 'n'} importiert`, description: [res.skipped ? `${res.skipped} schon vorhanden (übersprungen)` : '', res.subjectsCreated ? `${res.subjectsCreated} Fächer neu angelegt` : ''].filter(Boolean).join(' · ') || undefined, tone: 'success', action: { label: 'Rückgängig', onClick: () => void undoLast() } })
      onClose()
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Der Import hat nicht geklappt. Es wurde nichts Unvollständiges gespeichert.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Stundenplan importieren" description="CSV (z. B. aus Excel) oder ICS-Kalenderdatei (z. B. Export aus WebUntis). Die Datei bleibt auf deinem Gerät." size="lg"
      footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={doImport} loading={busy} disabled={!preview || (preview.drafts.length === 0 && !(takeSingles && preview.singles.length))}>{preview ? `${preview.drafts.length + (takeSingles ? preview.singles.length : 0)} Stunden importieren` : 'Importieren'}</Button></>}>
      <div className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-6 text-center hover:border-accent">
          <FileUp className="size-6 text-fg-muted" aria-hidden />
          <span className="text-sm font-medium">{preview ? preview.fileName : 'Datei auswählen (.csv oder .ics)'}</span>
          <span className="text-xs text-fg-subtle">CSV-Spalten: Tag; Stunde; Beginn; Ende; Fach; Lehrkraft; Raum; Woche (A/B) – die erste Zeile enthält die Spaltennamen.</span>
          <input type="file" accept=".csv,.ics,.txt,text/csv,text/calendar" className="sr-only" aria-label="Datei für den Import" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {error && <Notice tone="danger">{error}</Notice>}
        {preview && (
          <>
            {preview.errors.length > 0 && (
              <Notice tone="warn" title={`${preview.errors.length} Zeile${preview.errors.length === 1 ? '' : 'n'} werden nicht übernommen`}>
                <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4">{preview.errors.slice(0, 50).map((e, i) => <li key={i}>{e.line ? `Zeile ${e.line}: ` : ''}{e.message}</li>)}</ul>
              </Notice>
            )}
            {preview.skipped && (preview.skipped.allDay + preview.skipped.cancelled + preview.skipped.other > 0) && (
              <p className="text-xs text-fg-muted">Nicht übernommen: {[preview.skipped.allDay && `${preview.skipped.allDay} ganztägige Termine (z. B. Ferien)`, preview.skipped.cancelled && `${preview.skipped.cancelled} abgesagte`, preview.skipped.other && `${preview.skipped.other} sonstige`].filter(Boolean).join(', ')}.</p>
            )}
            {preview.drafts.length > 0 ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-left text-xs text-fg-muted"><tr><th className="px-2 py-1.5">Tag</th><th className="px-2">Zeit</th><th className="px-2">Fach</th><th className="px-2">Lehrkraft</th><th className="px-2">Raum</th><th className="px-2">Woche</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {preview.drafts.map((d, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">{WEEKDAYS_SHORT[d.weekday]}</td>
                        <td className="px-2 tabular">{d.start}–{d.end}</td>
                        <td className="px-2">{d.subject} {!known(d.subject) && <Badge tone="accent">neu</Badge>}</td>
                        <td className="px-2">{d.teacher}</td>
                        <td className="px-2">{d.room}</td>
                        <td className="px-2">{d.weekType ?? 'jede'}{d.exceptions?.length ? <span className="text-xs text-fg-subtle"> · {d.exceptions.length} frei</span> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Keine regelmäßigen Stunden gefunden.</p>
            )}
            <div className="flex flex-col gap-1">
              {missing.length > 0 && <Checkbox checked={createSubjects} onChange={setCreateSubjects} label={`Fehlende Fächer anlegen (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''})`} description="Sonst werden diese Stunden ohne Fach gespeichert." />}
              {preview.singles.length > 0 && <Checkbox checked={takeSingles} onChange={setTakeSingles} label={`${preview.singles.length} einzelne Termine als Zusatzstunden übernehmen`} description={`Termine, die nur einmal vorkommen (ab ${parseDay(preview.singles[0].date).toLocaleDateString('de-DE')}).`} />}
              {needsAB && preview.suggestedWeekAMonday && <Checkbox checked={takeAB} onChange={setTakeAB} label={`A/B-Wochen einrichten: KW ${isoWeek(preview.suggestedWeekAMonday)} ist eine A-Woche`} description="Einige Stunden finden nur jede zweite Woche statt. Du kannst das später unter Stammdaten korrigieren." />}
            </div>
            <p className="text-xs text-fg-subtle">Schon vorhandene gleiche Stunden werden übersprungen. Direkt nach dem Import kannst du alles mit „Rückgängig“ entfernen.</p>
          </>
        )}
      </div>
    </Dialog>
  )
}
