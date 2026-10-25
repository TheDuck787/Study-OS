import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ClipboardPaste, FileUp, ScanText, Sparkles, Upload } from 'lucide-react'
import { db } from '@/db/index'
import { addMaterial } from '@/db/repo'
import { importFile, SUPPORTED_ACCEPT, MAX_FILE_MB, type ImportResult } from '@/lib/docs/importFile'
import { extractSections, extractiveSummary } from '@/lib/docs/structure'
import { aiTranscribe, AiError } from '@/lib/ai/client'
import { Badge, Button, Card, cn, Field, Input, Notice, PageHeader, ProgressBar, Segmented, Select, Textarea, useToast } from '@/components/ui'
import { useAi, useSubjects } from '@/hooks/data'
import { STATUS_LABEL } from './LibraryPage'

export default function ImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const ai = useAi()
  const subjects = useSubjects()
  const [source, setSource] = useState<'file' | 'paste'>('file')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(params.get('subject') ?? '')
  const [topicId, setTopicId] = useState(params.get('topic') ?? '')
  const [tags, setTags] = useState('')
  const [progress, setProgress] = useState<{ msg: string; p: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const topics = useLiveQuery(() => (subjectId ? db.topics.where('subjectId').equals(subjectId).sortBy('order') : db.topics.limit(0).toArray()), [subjectId])

  const process = async (file: File) => {
    setProgress({ msg: 'Datei wird gelesen …', p: 0 })
    try {
      const r = await importFile(file, (msg, p) => setProgress({ msg, p }))
      setResult(r)
      setText(r.text)
      setTitle(r.title)
    } finally {
      setProgress(null)
    }
  }

  const runOcr = async () => {
    if (!result?.blob) return
    setProgress({ msg: 'Texterkennung wird vorbereitet …', p: 0 })
    try {
      const { ocrImages } = await import('@/lib/docs/ocr')
      let images: Blob[]
      let pages: number[] = []
      if (result.mimeType === 'application/pdf') {
        const { renderPdfPage } = await import('@/lib/docs/pdf')
        const data = await result.blob.arrayBuffer()
        pages = (result.emptyPages ?? []).slice(0, 20)
        images = []
        for (const p of pages) {
          setProgress({ msg: `Seite ${p} wird vorbereitet …`, p: 0 })
          images.push(await renderPdfPage(data, p))
        }
      } else images = [result.blob]
      const ocr = await ocrImages(images, (msg, p) => setProgress({ msg, p }))
      const low = ocr.filter((o) => o.confidence < 70)
      let merged: string
      if (result.mimeType === 'application/pdf' && result.pageTexts) {
        const texts = [...result.pageTexts]
        pages.forEach((p, i) => (texts[p - 1] = ocr[i].text))
        merged = texts.filter(Boolean).join('\n\n')
      } else merged = ocr.map((o) => o.text).join('\n\n')
      const skipped = (result.emptyPages?.length ?? 0) - pages.length
      const warnings = [
        'Text wurde per Texterkennung (OCR) erkannt. Prüfe ihn auf Erkennungsfehler, besonders bei Formeln, Tabellen und Handschrift.',
        ...(low.length ? [`Die Erkennung war bei ${low.length} Bild${low.length === 1 ? '' : 'ern'} unsicher (unter 70 % Zuverlässigkeit).`] : []),
        ...(skipped > 0 ? [`${skipped} weitere Seiten wurden nicht erkannt (höchstens 20 Seiten pro Durchgang).`] : []),
      ]
      setResult({ ...result, text: merged, status: merged.trim() ? (low.length || skipped > 0 ? 'partial' : 'complete') : 'failed', method: result.mimeType === 'application/pdf' ? 'pdf-ocr' : 'image-ocr', warnings, ocrPossible: false })
      setText(merged)
    } catch (e) {
      toast({ title: 'Texterkennung fehlgeschlagen', description: `${e instanceof Error ? e.message : String(e)}. Die Texterkennung lädt beim ersten Mal Sprachdaten aus dem Internet – ohne Verbindung funktioniert sie nicht.`, tone: 'danger' })
    } finally {
      setProgress(null)
    }
  }

  const runAi = async () => {
    if (!result?.blob) return
    setProgress({ msg: 'Die KI liest das Dokument …', p: 0.3 })
    try {
      let images: Blob[] = [result.blob]
      if (result.mimeType === 'application/pdf') {
        const { renderPdfPage } = await import('@/lib/docs/pdf')
        const data = await result.blob.arrayBuffer()
        images = []
        for (const p of (result.emptyPages ?? []).slice(0, 5)) images.push(await renderPdfPage(data, p))
      }
      const { text: t, provider } = await aiTranscribe(images)
      const merged = result.mimeType === 'application/pdf' && result.text ? `${result.text}\n\n${t}` : t
      setResult({ ...result, text: merged, status: 'partial', method: 'ai-vision', warnings: [`Text wurde von der KI (${provider}) abgeschrieben. KI kann sich verlesen – vergleiche mit dem Original.`], ocrPossible: false })
      setText(merged)
    } catch (e) {
      toast({ title: 'KI konnte das Bild nicht lesen', description: e instanceof AiError ? e.message : String(e), tone: 'danger' })
    } finally {
      setProgress(null)
    }
  }

  const usePasted = () => {
    setResult({ title: title || 'Eingefügter Text', fileName: null, mimeType: 'text/plain', size: text.length, text, sections: [], status: text.trim() ? 'complete' : 'failed', method: 'paste', warnings: [], blob: null, ocrPossible: false })
    if (!title) setTitle(text.split('\n').find((l) => l.trim())?.slice(0, 80) ?? 'Eingefügter Text')
  }

  const save = async () => {
    if (!result) return
    setSaving(true)
    try {
      const sections = extractSections(text)
      const edited = text !== result.text
      const id = await addMaterial(
        {
          title: title.trim() || result.title, subjectId: subjectId || null, topicId: topicId || null, fileName: result.fileName, mimeType: result.mimeType, size: result.size,
          text, sections, summary: text.trim() ? extractiveSummary(sections) : '', summarySource: text.trim() ? 'extractive' : 'none',
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          extraction: { status: result.status, method: result.method, pages: result.pages, pagesWithText: result.pagesWithText, warnings: [...result.warnings, ...(edited ? ['Der Text wurde beim Import von dir bearbeitet.'] : [])] },
        },
        result.blob ?? undefined,
      )
      toast({ title: 'Material gespeichert', tone: 'success' })
      navigate(`/bibliothek/material/${id}`)
    } catch (e) {
      toast({ title: 'Speichern fehlgeschlagen', description: e instanceof Error ? e.message : String(e), tone: 'danger' })
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to="/bibliothek" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Bibliothek
      </Link>
      <PageHeader title="Material importieren" description="PDF, Foto eines Arbeitsblatts, Text- oder Markdown-Datei – oder Text einfügen. Du prüfst alles, bevor es gespeichert wird." />

      {!result && (
        <Card className="flex flex-col gap-5 p-5">
          <Segmented label="Quelle" value={source} onChange={setSource} options={[{ value: 'file', label: <span className="inline-flex items-center gap-1.5"><FileUp className="size-4" /> Datei</span> }, { value: 'paste', label: <span className="inline-flex items-center gap-1.5"><ClipboardPaste className="size-4" /> Text einfügen</span> }]} />
          {source === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) process(f) }}
              className={cn('flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center', dragOver ? 'border-accent bg-accent-soft' : 'border-border-strong')}
            >
              <Upload className="size-8 text-fg-subtle" aria-hidden />
              <p className="text-sm text-fg-muted">Datei hierher ziehen oder</p>
              <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={!!progress}>Datei auswählen</Button>
              <input ref={fileRef} type="file" accept={SUPPORTED_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) process(f); e.target.value = '' }} aria-label="Datei auswählen" />
              <p className="text-xs text-fg-subtle">PDF, PNG, JPG, WebP, TXT, Markdown · höchstens {MAX_FILE_MB} MB. Auf dem Handy kannst du direkt ein Foto aufnehmen.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="Titel" htmlFor="paste-title" optional>
                <Input id="paste-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Tafelbild Hormone" />
              </Field>
              <Field label="Text" htmlFor="paste-text">
                <Textarea id="paste-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="Notizen, Text aus einem Arbeitsblatt, Zusammenfassung …" />
              </Field>
              <div className="flex justify-end">
                <Button variant="primary" onClick={usePasted} disabled={!text.trim()}>Weiter</Button>
              </div>
            </div>
          )}
          {progress && <ProgressBar value={progress.p} label={progress.msg} />}
          {progress && <p className="text-sm text-fg-muted">{progress.msg}</p>}
        </Card>
      )}

      {result && (
        <>
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_LABEL[result.status].tone}>{STATUS_LABEL[result.status].label}</Badge>
              {result.fileName && <span className="text-sm text-fg-muted">{result.fileName}</span>}
              {result.pages !== undefined && <span className="text-sm text-fg-subtle">{result.pagesWithText} von {result.pages} Seiten mit Text</span>}
            </div>
            {result.warnings.map((w, i) => <Notice key={i} tone={result.status === 'complete' ? 'neutral' : 'warn'}>{w}</Notice>)}
            {(result.ocrPossible || (result.method === 'image-ocr' && !text)) && (
              <div className="flex flex-wrap gap-2">
                <Button icon={ScanText} onClick={runOcr} loading={!!progress}>Texterkennung (OCR) starten</Button>
                {ai?.ok && ai.supportsImages && <Button icon={Sparkles} onClick={runAi} disabled={!!progress}>Mit KI abschreiben lassen</Button>}
              </div>
            )}
            {progress && (
              <div>
                <ProgressBar value={progress.p} label={progress.msg} />
                <p className="mt-1 text-sm text-fg-muted">{progress.msg}</p>
              </div>
            )}
            {result.status === 'unsupported' ? null : (
              <Field label="Erkannter Text – du kannst ihn korrigieren" htmlFor="imp-text">
                <Textarea id="imp-text" value={text} onChange={(e) => setText(e.target.value)} rows={14} className="font-mono text-sm" />
              </Field>
            )}
          </Card>
          {result.status !== 'unsupported' && (
            <Card className="flex flex-col gap-4 p-5">
              <Field label="Titel" htmlFor="imp-title">
                <Input id="imp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Fach" htmlFor="imp-subject">
                  <Select id="imp-subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId('') }}>
                    <option value="">– ohne –</option>
                    {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
                <Field label="Thema" htmlFor="imp-topic">
                  <Select id="imp-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId}>
                    <option value="">– ohne –</option>
                    {topics?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                <Field label="Schlagwörter" htmlFor="imp-tags" optional>
                  <Input id="imp-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Arbeitsblatt, Test" />
                </Field>
              </div>
            </Card>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => { setResult(null); setText(''); setTitle('') }}>Andere Datei</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={result.status === 'unsupported' || !!progress}>
              Speichern
            </Button>
          </div>
          {!text.trim() && result.status !== 'unsupported' && <p className="text-right text-xs text-fg-subtle">Ohne Text kannst du das Original speichern, aber keine Karten oder Fragen daraus erzeugen.</p>}
        </>
      )}
    </div>
  )
}
