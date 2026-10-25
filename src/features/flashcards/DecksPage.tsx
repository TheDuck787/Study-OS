import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Play } from 'lucide-react'
import { db } from '@/db/index'
import { retentionRate } from '@/lib/srs'
import { dayKey } from '@/lib/dates'
import { ButtonLink, LoadingBlock, PageHeader, SectionHeader, StatTile } from '@/components/ui'
import { useDueCards } from '@/hooks/data'
import { DeckList } from './DeckList'

export default function DecksPage() {
  const due = useDueCards()
  const reviews = useLiveQuery(() => db.cardReviews.toArray(), [])
  const total = useLiveQuery(() => db.cards.count(), [])
  const learned = useLiveQuery(() => db.cards.filter((c) => c.srs.state === 'review').count(), [])
  const today = dayKey()
  const stats = useMemo(() => {
    if (!reviews) return null
    const last30 = reviews.filter((r) => r.at >= new Date(Date.now() - 30 * 86_400_000).toISOString())
    return { retention: retentionRate(last30), todayCount: reviews.filter((r) => dayKey(r.at) === today).length }
  }, [reviews, today])
  if (!due || !stats || total === undefined) return <LoadingBlock />
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Karteikarten"
        title="Karteikarten"
        description="Wiederholung nach Plan: Was du gut kannst, kommt seltener; was du vergisst, kommt bald wieder."
        actions={
          <ButtonLink to="/karteikarten/lernen" variant="primary" icon={Play} aria-disabled={due.cards.length === 0}>
            {due.cards.length > 0 ? `${due.cards.length} fällige lernen` : 'Nichts fällig'}
          </ButtonLink>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Layers} label="Karten gesamt" value={total} />
        <StatTile label="Langfristig gelernt" value={learned ?? 0} sub="im Wiederholungsplan" />
        <StatTile label="Heute wiederholt" value={stats.todayCount} />
        <StatTile label="Behaltensquote (30 Tage)" value={stats.retention === null ? '–' : `${Math.round(stats.retention * 100)} %`} sub="Anteil gelernter Karten, die du noch wusstest" />
      </div>
      <section>
        <SectionHeader title="Stapel" />
        <DeckList />
      </section>
    </div>
  )
}
