import { toMin } from './time'

export interface Placed<T> {
  item: T
  startMin: number
  endMin: number
  col: number
  cols: number
}

/**
 * Side-by-side layout for overlapping timed entries (like Google Calendar): entries that overlap share
 * the width of their cluster; each gets the first free column. Very short entries get a minimum height.
 */
export function layoutTimed<T extends { start: string | null; end: string | null }>(items: T[], minDuration = 20): Placed<T>[] {
  const timed = items
    .filter((i) => i.start)
    .map((item) => {
      const startMin = toMin(item.start!)
      const endMin = Math.max(startMin + minDuration, item.end ? toMin(item.end) : startMin + 30)
      return { item, startMin, endMin, col: 0, cols: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const out: Placed<T>[] = []
  let cluster: Placed<T>[] = []
  let clusterEnd = -1
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1))
    for (const p of cluster) p.cols = cols
    out.push(...cluster)
    cluster = []
  }
  for (const p of timed) {
    if (cluster.length && p.startMin >= clusterEnd) flush()
    const colEnds: number[] = []
    for (const q of cluster) colEnds[q.col] = Math.max(colEnds[q.col] ?? -1, q.endMin)
    let col = 0
    while (colEnds[col] !== undefined && colEnds[col] > p.startMin) col++
    p.col = col
    cluster.push(p)
    clusterEnd = Math.max(clusterEnd, p.endMin)
  }
  if (cluster.length) flush()
  return out
}
