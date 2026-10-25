import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/index'
import type { Deck } from '@/db/types'
import { saveDeck, ValidationError } from '@/db/repo'
import { Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui'
import { useSubjects } from '@/hooks/data'

export const LANGS = [
  { value: '', label: '– keine Aussprache –' },
  { value: 'en-GB', label: 'Englisch (britisch)' },
  { value: 'en-US', label: 'Englisch (amerikanisch)' },
  { value: 'fr-FR', label: 'Französisch' },
  { value: 'es-ES', label: 'Spanisch' },
  { value: 'la', label: 'Latein' },
  { value: 'ru-RU', label: 'Russisch' },
  { value: 'de-DE', label: 'Deutsch' },
]

export function DeckDialog({ open, onClose, deck, subjectId }: { open: boolean; onClose: () => void; deck?: Deck; subjectId?: string }) {
  const navigate = useNavigate()
  const subjects = useSubjects()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sid, setSid] = useState('')
  const [tid, setTid] = useState('')
  const [frontLang, setFrontLang] = useState('')
  const [error, setError] = useState<string | null>(null)
  const topics = useLiveQuery(() => (sid ? db.topics.where('subjectId').equals(sid).sortBy('order') : db.topics.limit(0).toArray()), [sid])
  useEffect(() => {
    if (open) {
      setName(deck?.name ?? '')
      setDescription(deck?.description ?? '')
      setSid(deck?.subjectId ?? subjectId ?? '')
      setTid(deck?.topicId ?? '')
      setFrontLang(deck?.frontLang ?? '')
      setError(null)
    }
  }, [open, deck, subjectId])
  const save = async () => {
    try {
      const id = await saveDeck({ id: deck?.id, name, description, subjectId: sid || null, topicId: tid || null, frontLang: frontLang || null, backLang: 'de-DE' })
      onClose()
      if (!deck) navigate(`/karteikarten/${id}`)
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : String(e))
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title={deck ? 'Stapel bearbeiten' : 'Neuer Kartenstapel'} footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" onClick={save}>Speichern</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="deck-name" error={error}>
          <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="z. B. Englisch Unit 3" />
        </Field>
        <Field label="Beschreibung" htmlFor="deck-desc" optional>
          <Textarea id="deck-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fach" htmlFor="deck-subject" optional>
            <Select id="deck-subject" value={sid} onChange={(e) => { setSid(e.target.value); setTid('') }}>
              <option value="">– ohne –</option>
              {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Thema" htmlFor="deck-topic" optional>
            <Select id="deck-topic" value={tid} onChange={(e) => setTid(e.target.value)} disabled={!sid}>
              <option value="">– ohne –</option>
              {topics?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Sprache der Vorderseite (für Aussprache)" htmlFor="deck-lang" hint="Die Aussprache nutzt die Sprachausgabe deines Geräts – nicht jedes Gerät hat alle Stimmen.">
          <Select id="deck-lang" value={frontLang} onChange={(e) => setFrontLang(e.target.value)}>
            {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}
