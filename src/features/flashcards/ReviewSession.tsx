import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Layers, RotateCw, Volume2 } from 'lucide-react'
import { db } from '@/db/index'
import type { Card as CardT, CardRating, Deck } from '@/db/types'
import { rateCard, recordStudySession } from '@/db/repo'
import { previewIntervals, selectDueCards } from '@/lib/srs'
import { shuffle } from '@/lib/id'
import { speak, speechAvailable } from '@/lib/speech'
import { Button, ButtonLink, cn, EmptyState, IconButton, Kbd, LoadingBlock, ProgressBar } from '@/components/ui'

const RATINGS: { r: CardRating; label: string; key: string; cls: string }[] = [
  { r: 'again', label: 'Vergessen', key: '1', cls: 'border-warn/50 text-warn hover:bg-warn-soft' },
  { r: 'hard', label: 'Schwer', key: '2', cls: 'border-border-strong text-fg hover:bg-surface-2' },
  { r: 'good', label: 'Gut', key: '3', cls: 'border-accent/50 text-accent hover:bg-accent-soft' },
  { r: 'easy', label: 'Leicht', key: '4', cls: 'border-success/50 text-success hover:bg-success-soft' },
]

/** Reviews due cards one at a time. "Vergessen" cards come back at the end of the session. */
export default function ReviewSession() {
  const { deckId } = useParams()
  const [queue, setQueue] = useState<CardT[] | null>(null)
  const [decks, setDecks] = useState<Map<string, Deck>>(new Map())
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)
  const [counts, setCounts] = useState<Record<CardRating, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [practiceAll, setPracticeAll] = useState(false)
  const startedAt = useRef(new Date())
  const recorded = useRef(false)
  const total = useRef(0)

  const load = useCallback(async (all: boolean) => {
    const ds = deckId ? [await db.decks.get(deckId)].filter((d): d is Deck => !!d) : await db.decks.toArray()
    setDecks(new Map(ds.map((d) => [d.id, d])))
    const cards = await db.cards.where('deckId').anyOf(ds.map((d) => d.id)).toArray()
    let reviews: CardT[]
    let fresh: CardT[]
    if (all) {
      reviews = cards.filter((c) => c.srs.state !== 'new').sort((a, b) => a.srs.due.localeCompare(b.srs.due))
      fresh = shuffle(cards.filter((c) => c.srs.state === 'new')).slice(0, 50)
    } else {
      const sel = selectDueCards(cards, await db.cardReviews.toArray())
      reviews = sel.reviews
      fresh = sel.fresh
    }
    const q = [...reviews, ...fresh].slice(0, 100)
    total.current = q.length
    setQueue(q)
  }, [deckId])

  useEffect(() => {
    load(false)
  }, [load])

  const card = queue?.[0]
  const deck = card ? decks.get(card.deckId) : undefined
  const lang = deck?.frontLang ?? null

  const finish = useCallback(async () => {
    if (recorded.current || done === 0) return
    recorded.current = true
    await recordStudySession({ activity: 'flashcards', startedAt: startedAt.current, durationSec: (Date.now() - startedAt.current.getTime()) / 1000, subjectId: deckId ? decks.get(deckId)?.subjectId ?? null : null, items: done, refId: deckId ?? null })
  }, [done, deckId, decks])

  useEffect(() => {
    if (queue && queue.length === 0 && done > 0) finish()
  }, [queue, done, finish])
  // record time if the student leaves mid-session
  useEffect(() => () => void finish(), [finish])

  const rate = useCallback(
    async (r: CardRating) => {
      if (!card || !flipped) return
      const updated = await rateCard(card.id, r)
      setCounts((c) => ({ ...c, [r]: c[r] + 1 }))
      setDone((d) => d + 1)
      setFlipped(false)
      setQueue((q) => {
        if (!q) return q
        const rest = q.slice(1)
        return r === 'again' ? [...rest, updated] : rest
      })
    },
    [card, flipped],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      }
      const rr = RATINGS.find((x) => x.key === e.key)
      if (rr && flipped) rate(rr.r)
      if ((e.key === 'a' || e.key === 'A') && card && lang) speak(card.front, lang)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, rate, card, lang])

  if (!queue) return <LoadingBlock />
  const back = deckId ? `/karteikarten/${deckId}` : '/karteikarten'

  if (queue.length === 0) {
    if (done === 0)
      return (
        <div className="mx-auto max-w-xl">
          <EmptyState
            icon={CheckCircle2}
            title="Heute ist nichts fällig"
            description="Alle Karten sind auf dem Plan für später. Vorzeitiges Wiederholen ist möglich, bringt aber keine XP – sinnvoller ist eine Pause oder etwas anderes."
            action={
              <>
                <ButtonLink to={back}>Zurück</ButtonLink>
                {!practiceAll && (
                  <Button
                    onClick={() => {
                      setPracticeAll(true)
                      load(true)
                    }}
                  >
                    Trotzdem üben
                  </Button>
                )}
              </>
            }
          />
        </div>
      )
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-10 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <h1 className="text-xl font-semibold">Runde geschafft</h1>
        <p className="text-fg-muted">
          {done} Wiederholungen. Vergessen: {counts.again}, schwer: {counts.hard}, gut: {counts.good}, leicht: {counts.easy}.
        </p>
        <p className="text-sm text-fg-subtle">Vergessene Karten kommen morgen wieder – das ist normal und genau so gewollt.</p>
        <div className="flex gap-2">
          <ButtonLink to={back}>Zum Stapel</ButtonLink>
          <ButtonLink to="/" variant="primary">Zur Übersicht</ButtonLink>
        </div>
      </div>
    )
  }

  const iv = card ? previewIntervals(card.srs) : null
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Beenden
        </Link>
        <span className="text-sm text-fg-muted tabular">
          {done} erledigt · noch {queue.length}
        </span>
      </div>
      <ProgressBar value={total.current ? done / (done + queue.length) : 0} label="Fortschritt der Runde" />
      {card && (
        <>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? 'Karte zurückdrehen' : 'Karte umdrehen'}
            className="flip w-full cursor-pointer text-left"
          >
            <div className={cn('flip-inner min-h-64', flipped && 'flipped')}>
              <div className="flip-face flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
                <span className="eyebrow">{deck?.name}</span>
                <span className="break-words font-display text-2xl font-semibold">{card.front}</span>
                <span className="text-xs text-fg-subtle">Tippen oder Leertaste zum Umdrehen</span>
              </div>
              <div className="flip-face flip-back flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-accent/30 bg-surface p-8 text-center">
                <span className="text-sm text-fg-muted">{card.front}</span>
                <span className="break-words font-display text-2xl font-semibold">{card.back}</span>
                {card.example && <span className="max-w-md text-sm italic text-fg-muted">{card.example}</span>}
              </div>
            </div>
          </button>
          <div className="flex items-center justify-center gap-2">
            {lang && speechAvailable() && <IconButton label="Aussprechen (Taste A)" icon={Volume2} onClick={() => speak(card.front, lang)} />}
            <IconButton label="Umdrehen" icon={RotateCw} onClick={() => setFlipped((f) => !f)} />
            {card.srs.state === 'new' && <span className="text-xs text-fg-subtle">neue Karte</span>}
          </div>
          {flipped ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Wie gut wusstest du es?">
              {RATINGS.map((x) => (
                <button key={x.r} type="button" onClick={() => rate(x.r)} className={cn('flex flex-col items-center rounded-lg border bg-surface px-3 py-2.5 transition-colors cursor-pointer', x.cls)}>
                  <span className="font-semibold">{x.label}</span>
                  <span className="text-xs text-fg-subtle">
                    {iv?.[x.r]} · <Kbd>{x.key}</Kbd>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Button variant="primary" size="lg" icon={Layers} onClick={() => setFlipped(true)}>
              Antwort zeigen
            </Button>
          )}
          <p className="text-center text-xs text-fg-subtle">Sei ehrlich zu dir: „Vergessen“ ist kein Fehler, sondern sorgt dafür, dass die Karte rechtzeitig wiederkommt.</p>
        </>
      )}
    </div>
  )
}
