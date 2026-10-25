import { useEffect, useRef, useState, type ReactNode } from 'react'
import { celebrate, haptic, prefersReducedMotion } from '@/lib/motion'

/** True from the first frame after mount – lets bars/rings animate from 0 to their value. */
export function useMounted(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return m
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Animated number: counts up from 0 on mount and from the old value on change (one element, rAF only). */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const from = useRef(shown)
  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = a + (value - a) * easeOutCubic(t)
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  return shown
}

export function AnimatedNumber({ value, decimals = 0, duration, suffix = '', className }: { value: number; decimals?: number; duration?: number; suffix?: string; className?: string }) {
  const v = useCountUp(value, duration)
  return (
    <span className={className}>
      {v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false })}
      {suffix}
    </span>
  )
}

/**
 * Animates the leading number of a text like "3 Tage" or "146" (other content is shown unchanged),
 * so stat tiles count up without changing how callers pass their values.
 */
export function CountUpText({ children }: { children: ReactNode }) {
  if (typeof children === 'number') return <AnimatedNumber value={children} />
  if (typeof children !== 'string') return <>{children}</>
  const m = children.match(/^(\d+(?:[.,]\d+)?)(.*)$/s)
  if (!m || m[1].length > 7) return <>{children}</>
  const num = Number(m[1].replace(',', '.'))
  const decimals = m[1].includes(',') || m[1].includes('.') ? m[1].split(/[.,]/)[1].length : 0
  return (
    <span className="tabular">
      <AnimatedNumber value={num} decimals={decimals} />
      {m[2]}
    </span>
  )
}

/** Fires a confetti burst once when it mounts (or when `when` becomes true) – for "geschafft" screens. */
export function Celebrate({ when = true, anchor }: { when?: boolean; anchor?: string }) {
  const fired = useRef(false)
  useEffect(() => {
    if (!when || fired.current) return
    fired.current = true
    const t = setTimeout(() => {
      const el = anchor ? document.querySelector(anchor) : null
      celebrate(el, { count: 26, spread: 1.4 })
      haptic(20)
    }, 180)
    return () => clearTimeout(t)
  }, [when, anchor])
  return null
}
