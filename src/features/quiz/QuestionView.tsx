import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import type { Question } from '@/db/types'
import { Markdown } from '@/components/Markdown'
import { cn, Input, Kbd, Textarea } from '@/components/ui'

export const TYPE_LABELS: Record<Question['type'], string> = {
  mc: 'Auswahl',
  tf: 'Wahr/Falsch',
  text: 'Freitext',
  numeric: 'Zahl',
  math: 'Rechnung',
  vocab: 'Vokabel',
}

/** Input control for one question. `locked` after checking (practice) – then correctness is shown. */
export function AnswerInput({ q, value, onChange, onSubmit, locked, correctness }: { q: Question; value: string; onChange: (v: string) => void; onSubmit?: () => void; locked?: boolean; correctness?: 'correct' | 'wrong' | null }) {
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!locked && (q.type === 'text' || q.type === 'numeric' || q.type === 'math' || q.type === 'vocab')) inputRef.current?.focus()
  }, [q.id, locked, q.type])

  if (q.type === 'mc' || q.type === 'tf') {
    const options = q.type === 'mc' ? q.options ?? [] : ['Wahr', 'Falsch']
    const values = q.type === 'mc' ? options.map((_, i) => String(i)) : ['true', 'false']
    const correctValue = q.type === 'mc' ? String(q.correctIndex) : String(q.correctBool)
    return (
      <div role="radiogroup" aria-label="Antwortmöglichkeiten" className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const v = values[i]
          const selected = value === v
          const showCorrect = locked && v === correctValue
          const showWrong = locked && selected && v !== correctValue
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={locked}
              onClick={() => onChange(v)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors cursor-pointer disabled:cursor-default',
                showCorrect ? 'border-success/60 bg-success-soft' : showWrong ? 'border-warn/60 bg-warn-soft' : selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular', selected ? 'border-accent text-accent' : 'border-border-strong text-fg-muted')}>
                {showCorrect ? <Check className="size-3.5 text-success" /> : showWrong ? <X className="size-3.5 text-warn" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <Markdown inline>{opt}</Markdown>
              </span>
            </button>
          )
        })}
        {!locked && (
          <p className="hidden text-xs text-fg-subtle sm:block">
            Tastatur: <Kbd>1</Kbd>–<Kbd>{options.length}</Kbd> wählen, <Kbd>Enter</Kbd> prüfen
          </p>
        )}
      </div>
    )
  }

  const border = correctness === 'correct' ? 'border-success/60' : correctness === 'wrong' ? 'border-warn/60' : ''
  if (q.type === 'text') {
    return (
      <Textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        aria-label="Deine Antwort"
        placeholder="Deine Antwort in eigenen Worten …"
        className={cn('min-h-28', border)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit?.()
        }}
      />
    )
  }
  const placeholder =
    q.type === 'math' ? (/;|=/.test(q.answer) ? 'z. B. x = 4  oder bei zwei Lösungen: 2; -3' : 'z. B. 3/4, 2x + 1, x^2, sqrt(2)') : q.type === 'numeric' ? `Zahl${q.unit ? ` (in ${q.unit})` : ''}, z. B. 12,5` : 'Deine Antwort'
  return (
    <div className="flex flex-col gap-1.5">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        aria-label="Deine Antwort"
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode={q.type === 'numeric' ? 'decimal' : 'text'}
        className={cn('h-12 text-md', q.type === 'math' && 'font-mono', border)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit?.()
          }
        }}
      />
      {q.type === 'math' && !locked && <p className="text-xs text-fg-subtle">Schreibweise: Komma oder Punkt, ^ für Hochzahlen, sqrt( ) für Wurzeln. Gleichwertige Ergebnisse werden anerkannt.</p>}
    </div>
  )
}

export function QuestionPrompt({ q }: { q: Question }) {
  return <Markdown className="text-md leading-relaxed">{q.prompt}</Markdown>
}
