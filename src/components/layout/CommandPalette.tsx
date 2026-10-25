import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarClock, FileText, Layers, ListChecks, NotebookPen, Search, Timer, Zap, type LucideIcon } from 'lucide-react'
import { db } from '@/db/index'
import { searchScore } from '@/lib/text'
import { NAV } from './nav'
import { cn, Kbd } from '../ui'

interface Item {
  key: string
  label: string
  detail?: string
  icon: LucideIcon
  to: string
  group: string
  score: number
}

/** Global search across subjects, topics, notes, materials, flashcards and exams, plus quick actions. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    if (!open) return null
    const [subjects, topics, notes, materials, decks, cards, exams] = await Promise.all([
      db.subjects.toArray(), db.topics.toArray(), db.notes.toArray(), db.materials.toArray(), db.decks.toArray(), db.cards.toArray(), db.exams.toArray(),
    ])
    return { subjects, topics, notes, materials, decks, cards, exams }
  }, [open])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      { key: 'a-quick', label: '5-Minuten-Lernrunde starten', icon: Timer, to: '/quiz/neu?preset=quick', group: 'Aktionen', score: 1 },
      { key: 'a-quiz', label: 'Neues Quiz', icon: ListChecks, to: '/quiz/neu', group: 'Aktionen', score: 1 },
      { key: 'a-cards', label: 'Fällige Karteikarten lernen', icon: Layers, to: '/karteikarten/lernen', group: 'Aktionen', score: 1 },
      { key: 'a-note', label: 'Neue Notiz', icon: NotebookPen, to: '/bibliothek?neu=notiz', group: 'Aktionen', score: 1 },
      { key: 'a-exam', label: 'Prüfung eintragen', icon: CalendarClock, to: '/pruefungen?neu=1', group: 'Aktionen', score: 1 },
      ...NAV.map((n) => ({ key: `nav-${n.to}`, label: n.label, icon: n.icon, to: n.to, group: 'Bereiche', score: 1 })),
    ]
    const query = q.trim()
    if (!query) return actions
    const out: Item[] = actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase())).map((a) => ({ ...a, score: 50 }))
    if (data) {
      const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]))
      for (const s of data.subjects) {
        const sc = searchScore(query, s.name)
        if (sc) out.push({ key: s.id, label: s.name, icon: BookOpen, to: `/faecher/${s.id}`, group: 'Fächer', score: sc + 20 })
      }
      for (const t of data.topics) {
        const sc = searchScore(query, t.name, t.description)
        if (sc) out.push({ key: t.id, label: t.name, detail: subjectName.get(t.subjectId), icon: BookOpen, to: `/faecher/${t.subjectId}/themen/${t.id}`, group: 'Themen', score: sc + 10 })
      }
      for (const n of data.notes) {
        const sc = searchScore(query, n.title, n.content, n.tags.join(' '))
        if (sc) out.push({ key: n.id, label: n.title, detail: 'Notiz', icon: NotebookPen, to: `/bibliothek/notiz/${n.id}`, group: 'Notizen & Material', score: sc })
      }
      for (const m of data.materials) {
        const sc = searchScore(query, m.title, m.text, m.tags.join(' '))
        if (sc) out.push({ key: m.id, label: m.title, detail: 'Material', icon: FileText, to: `/bibliothek/material/${m.id}`, group: 'Notizen & Material', score: sc })
      }
      for (const d of data.decks) {
        const sc = searchScore(query, d.name, d.description)
        if (sc) out.push({ key: d.id, label: d.name, detail: 'Kartenstapel', icon: Layers, to: `/karteikarten/${d.id}`, group: 'Karteikarten', score: sc + 5 })
      }
      for (const c of data.cards) {
        const sc = searchScore(query, c.front, c.back)
        if (sc) out.push({ key: c.id, label: `${c.front} – ${c.back}`, detail: 'Karte', icon: Layers, to: `/karteikarten/${c.deckId}?karte=${c.id}`, group: 'Karteikarten', score: sc })
      }
      for (const e of data.exams) {
        const sc = searchScore(query, e.title, e.type)
        if (sc) out.push({ key: e.id, label: e.title, detail: e.date, icon: CalendarClock, to: `/pruefungen/${e.id}`, group: 'Prüfungen', score: sc + 5 })
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 30)
  }, [q, data])

  useEffect(() => setActive(0), [q])

  if (!open) return null
  const go = (it: Item) => {
    onClose()
    navigate(it.to)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && items[active]) go(items[active])
  }
  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Suche und Befehle" onKeyDown={onKey}>
      <button type="button" aria-label="Schließen" className="absolute inset-0 bg-[var(--overlay)] cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-fg-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Fächer, Themen, Notizen, Karten durchsuchen …"
            aria-label="Suchbegriff"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pi-${items[active].key}` : undefined}
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-fg-subtle"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul id="palette-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-muted">Nichts gefunden für „{q}“.</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            return (
              <li key={it.key} role="presentation">
                {header && <div className="eyebrow px-2.5 pb-1 pt-2.5">{header}</div>}
                <div
                  id={`pi-${it.key}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm', i === active ? 'bg-surface-2 text-fg' : 'text-fg-muted')}
                >
                  <it.icon className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.detail && <span className="shrink-0 text-xs text-fg-subtle">{it.detail}</span>}
                  {i === active && <Zap className="size-3.5 text-accent" aria-hidden />}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
