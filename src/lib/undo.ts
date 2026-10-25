/**
 * In-memory undo for calendar and task changes (lost on reload – the data itself is saved immediately).
 * Each entry restores the previous state of exactly the records an action touched.
 */
export interface UndoEntry {
  id: number
  label: string
  at: number
  revert: () => Promise<void>
}

const MAX = 25
let stack: UndoEntry[] = []
let seq = 0
const listeners = new Set<(top: UndoEntry | null) => void>()

const notify = () => listeners.forEach((l) => l(stack.at(-1) ?? null))

export function pushUndo(label: string, revert: () => Promise<void>) {
  stack = [...stack.slice(-(MAX - 1)), { id: ++seq, label, at: Date.now(), revert }]
  notify()
}

export async function undoLast(): Promise<string | null> {
  const top = stack.at(-1)
  if (!top) return null
  stack = stack.slice(0, -1)
  notify()
  await top.revert()
  return top.label
}

export const peekUndo = () => stack.at(-1) ?? null

export function subscribeUndo(fn: (top: UndoEntry | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** For tests. */
export function clearUndo() {
  stack = []
  notify()
}
