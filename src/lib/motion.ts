/**
 * Motion presets shared by CSS (tokens in styles/index.css) and JS animations, plus small effects.
 * Rules: animate only transform/opacity, keep things short, and do nothing when the student prefers reduced motion.
 */

export const DUR = { fast: 120, base: 180, slow: 260, slower: 420 } as const
export const EASE = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
} as const

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Short vibration on Android when something is completed (ignored where unsupported). */
export function haptic(ms = 12) {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(ms)
  } catch {
    /* not supported */
  }
}

const CONFETTI_COLORS = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)']

/**
 * A small confetti burst from an element (or a screen point) – used when a task, quiz or goal is completed.
 * ~18 absolutely positioned pieces animated with the Web Animations API; they remove themselves afterwards.
 */
export function celebrate(origin?: Element | { x: number; y: number } | null, opts: { count?: number; spread?: number } = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return
  let x = window.innerWidth / 2
  let y = window.innerHeight / 3
  if (origin && 'getBoundingClientRect' in origin) {
    const r = origin.getBoundingClientRect()
    x = r.left + r.width / 2
    y = r.top + r.height / 2
  } else if (origin) {
    x = origin.x
    y = origin.y
  }
  const count = opts.count ?? 18
  const spread = opts.spread ?? 1
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = 'confetti-piece'
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    document.body.appendChild(el)
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6
    const dist = (50 + Math.random() * 70) * spread
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 40 * spread
    const rot = (Math.random() - 0.5) * 720
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.6) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 70}px)) scale(0.8) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 850 + Math.random() * 300, easing: EASE.out, fill: 'forwards' },
    )
    anim.onfinish = () => el.remove()
    anim.oncancel = () => el.remove()
  }
}

/** Gentle "pop" on an element (e.g. a checkbox that was just ticked). */
export function pop(el: Element | null | undefined) {
  if (!el || prefersReducedMotion() || !('animate' in el)) return
  ;(el as HTMLElement).animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 360, easing: EASE.spring })
}

/** Completion feedback in one call: pop + small burst + haptic. */
export function success(el?: Element | null) {
  pop(el)
  celebrate(el, { count: 10, spread: 0.7 })
  haptic()
}
