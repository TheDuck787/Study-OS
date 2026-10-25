import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Subject } from '@/db/types'
import { createSubject, updateSubject, ValidationError } from '@/db/repo'
import { Button, cn, Dialog, Field, Input, useToast } from '@/components/ui'
import { SUBJECT_COLOR_COUNT, subjectColorVar } from '@/lib/colors'

export function SubjectDialog({ open, onClose, subject }: { open: boolean; onClose: () => void; subject?: Subject }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  useEffect(() => {
    if (open) {
      setName(subject?.name ?? '')
      setColor(subject?.color ?? Math.floor(Math.random() * SUBJECT_COLOR_COUNT))
      setError(null)
    }
  }, [open, subject])
  const save = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    try {
      if (subject) {
        await updateSubject(subject.id, { name, color })
        toast({ title: 'Fach gespeichert', tone: 'success' })
        onClose()
      } else {
        const id = await createSubject(name, color)
        onClose()
        navigate(`/faecher/${id}`)
      }
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={subject ? 'Fach bearbeiten' : 'Neues Fach'}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={() => save()} loading={busy}>
            Speichern
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Name" htmlFor="subject-name" error={error}>
          <Input id="subject-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus invalid={!!error} placeholder="z. B. Französisch" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Farbe</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
            {Array.from({ length: SUBJECT_COLOR_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={color === i}
                aria-label={`Farbe ${i + 1}`}
                onClick={() => setColor(i)}
                className={cn('size-8 rounded-full border-2 cursor-pointer', color === i ? 'border-fg' : 'border-transparent')}
                style={{ background: subjectColorVar(i) }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}
