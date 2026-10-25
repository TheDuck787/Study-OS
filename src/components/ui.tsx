import { clsx } from 'clsx'
import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Info, Loader2, X, type LucideIcon } from 'lucide-react'
import { CountUpText, useMounted } from './motion'

export const cn = clsx

// ───────────── Buttons ─────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

const variantCls: Record<Variant, string> = {
  primary:
    'text-accent-fg border border-transparent bg-accent-solid bg-[linear-gradient(180deg,rgb(255_255_255/0.14),rgb(255_255_255/0))] shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_1px_2px_rgb(0_0_0/0.25),0_4px_14px_-4px_color-mix(in_oklab,var(--accent-solid)_70%,transparent)] hover:bg-accent-solid-hover hover:shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_2px_4px_rgb(0_0_0/0.25),0_8px_22px_-6px_color-mix(in_oklab,var(--accent-solid)_80%,transparent)]',
  secondary: 'bg-surface-2 text-fg border border-border shadow-[var(--shadow-sm)] hover:border-border-strong hover:bg-surface-3',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent',
  danger: 'bg-danger-soft text-danger border border-transparent hover:border-danger/40',
  soft: 'bg-accent-soft text-accent border border-transparent hover:border-accent/30',
}
const sizeCls: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-base gap-2 rounded-lg',
}

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--dur-2)] ease-[var(--ease-out)] active:scale-[0.97] active:duration-[var(--dur-1)]',
    'disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
    variantCls[variant],
    sizeCls[size],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      {children}
      {IconRight && <IconRight className="size-4 shrink-0" aria-hidden />}
    </button>
  )
})

export function ButtonLink({ variant = 'secondary', size = 'md', icon: Icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
    </Link>
  )
}

export function IconButton({ label, icon: Icon, size = 'md', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tip={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-[color,background-color,transform] duration-[var(--dur-2)] active:scale-90 cursor-pointer disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'size-7' : 'size-9',
        className,
      )}
      {...rest}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  )
}

// ───────────── Layout primitives ─────────────

export function Card({ className, children, as: As = 'div', interactive, ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li'; interactive?: boolean } & Record<string, unknown>) {
  return (
    <As className={cn('surface-raised rounded-lg border border-border bg-surface', interactive && 'lift', className)} {...rest}>
      {children}
    </As>
  )
}

export function PageHeader({ title, eyebrow, description, actions }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 text-fg-muted max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, description, action, id }: { title: ReactNode; description?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-md font-semibold">{title}</h2>
        {description && <p className="text-sm text-fg-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'
const toneCls: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-fg-muted border-border',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', toneCls[tone], className)}>
      {children}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center rounded border border-border-strong bg-surface-2 px-1.5 text-[0.7rem] font-mono text-fg-muted leading-5">{children}</kbd>
}

export function Spinner({ label = 'Lädt …', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-fg-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  )
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn('skeleton', className)} style={style} />
}

/**
 * Loading placeholder: a calm page skeleton instead of a spinner. It appears only after a short delay,
 * so fast loads never flash. The label stays readable for screen readers (and is shown for long steps).
 */
export function LoadingBlock({ label }: { label?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 140)
    return () => clearTimeout(t)
  }, [])
  return (
    <div role="status" aria-live="polite" className="flex min-h-40 flex-col gap-4 py-2">
      <span className={label ? 'text-sm text-fg-muted' : 'sr-only'}>{label ?? 'Lädt …'}</span>
      {show && (
        <div className="flex flex-col gap-4 pop-in" aria-hidden>
          <Skeleton className="h-7 w-48" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-28" />
          <Skeleton className="h-16" />
        </div>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, compact }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center text-center rounded-lg border border-dashed border-border-strong bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_70%)]', compact ? 'px-4 py-6' : 'px-6 py-10')}>
      {Icon && (
        <div className="pop-in mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-surface text-accent shadow-[var(--shadow-sm)]">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'neutral', icon: Icon, title, children, className }: { tone?: Tone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string }) {
  const border: Record<Tone, string> = { neutral: 'border-border', accent: 'border-accent/30', success: 'border-success/30', warn: 'border-warn/35', danger: 'border-danger/35' }
  const bg: Record<Tone, string> = { neutral: 'bg-surface-2', accent: 'bg-accent-soft', success: 'bg-success-soft', warn: 'bg-warn-soft', danger: 'bg-danger-soft' }
  const fg: Record<Tone, string> = { neutral: 'text-fg-muted', accent: 'text-accent', success: 'text-success', warn: 'text-warn', danger: 'text-danger' }
  return (
    <div className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', border[tone], bg[tone], className)} role={tone === 'danger' ? 'alert' : undefined}>
      {Icon && <Icon className={cn('mt-0.5 size-4 shrink-0', fg[tone])} aria-hidden />}
      <div className="min-w-0">
        {title && <div className="font-semibold text-fg">{title}</div>}
        {children && <div className={cn('text-fg-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}

// ───────────── Forms ─────────────

const controlCls =
  'w-full rounded-md border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60'

/** Controls are full width unless the caller passes its own width (w-28, w-auto …). */
const ctl = (className?: string) => (className && /(^|\s)w-/.test(className) ? controlCls.replace(/(^|\s)w-full(?=\s|$)/, ' ') : controlCls)

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn(ctl(className), 'h-10', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cn(controlCls, 'py-2 min-h-24 leading-relaxed', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(ctl(className), 'h-10 pr-8 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  )
})

export function Field({ label, hint, error, children, htmlFor, className, optional }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string; optional?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-subtle">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

export function Checkbox({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string }) {
  const autoId = useId()
  const cid = id ?? autoId
  return (
    <label htmlFor={cid} className="flex cursor-pointer items-start gap-2.5 py-1">
      <input id={cid} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--accent-solid)]" />
      <span className="min-w-0">
        <span className="text-sm text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-subtle">{description}</span>}
      </span>
    </label>
  )
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('group relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-[var(--dur-2)]', checked ? 'bg-accent-solid border-transparent' : 'bg-surface-3 border-border-strong')}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-[transform,width] duration-[var(--dur-3)] ease-[var(--ease-spring)] group-active:w-5', checked ? 'translate-x-5 group-active:translate-x-4' : 'translate-x-1')} />
    </button>
  )
}

/**
 * Measures the active child of a container so an indicator can glide to it (transform only).
 * No transition on the first measurement, so nothing slides in from the left when a page opens.
 */
function useIndicator(active: number, deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; animate: boolean } | null>(null)
  const measure = useCallback(() => {
    const el = ref.current?.querySelectorAll<HTMLElement>('[data-ind-item]')[active]
    if (!el) return setBox(null)
    setBox((b) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, animate: !!b }))
  }, [active])
  useLayoutEffect(measure, [measure, ...deps])
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [measure])
  return { ref, box }
}

export function Segmented<T extends string | number>({ options, value, onChange, label, size = 'md' }: { options: { value: T; label: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  const active = options.findIndex((o) => o.value === value)
  const { ref, box } = useIndicator(active, [options.length])
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="relative inline-flex flex-wrap rounded-md border border-border bg-surface-2 p-0.5">
      {box && (
        <span
          aria-hidden
          className={cn('pointer-events-none absolute left-0 top-0 rounded-[6px] border border-border bg-surface shadow-[var(--shadow-sm)]', box.animate && 'transition-[transform,width,height] duration-[var(--dur-3)] ease-[var(--ease-out)]')}
          style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
        />
      )}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          data-ind-item
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative rounded-[6px] font-medium transition-[color,transform] duration-[var(--dur-2)] active:scale-[0.96] cursor-pointer',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            o.value === value ? 'text-fg' : 'text-fg-muted hover:text-fg',
            o.value === value && !box && 'bg-surface shadow-sm',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ───────────── Tabs ─────────────

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number; icon?: LucideIcon }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      refs.current[next]?.focus()
      onChange(tabs[next].id)
    }
  }
  const { ref, box } = useIndicator(Math.max(0, tabs.findIndex((t) => t.id === value)), [tabs.length])
  return (
    <div ref={ref} role="tablist" aria-label={label} className="relative -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {box && (
        <span aria-hidden className={cn('pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-accent', box.animate && 'transition-[transform,width] duration-[var(--dur-3)] ease-[var(--ease-out)]')} style={{ transform: `translateX(${box.x}px)`, width: box.w }} />
      )}
      {tabs.map((t, i) => {
        const active = t.id === value
        const Icon = t.icon
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            data-ind-item
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 text-sm font-medium transition-colors duration-[var(--dur-2)]',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              active && !box && 'border-accent',
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-xs text-fg-muted tabular">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ───────────── Progress ─────────────

export function ProgressBar({ value, tone = 'accent', label, className, showValue }: { value: number; tone?: 'accent' | 'success' | 'warn' | 'neutral'; label: string; className?: string; showValue?: boolean }) {
  const v = Math.max(0, Math.min(1, value))
  const mounted = useMounted()
  const color = { accent: 'bg-accent-solid', success: 'bg-success', warn: 'bg-warn', neutral: 'bg-fg-subtle' }[tone]
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        {/* scaleX instead of width: animates on the compositor, from 0 on first show */}
        <div className={cn('h-full w-full origin-left rounded-full transition-transform duration-[700ms] ease-[var(--ease-out)]', color)} style={{ transform: `scaleX(${mounted ? v : 0})` }} />
      </div>
      {showValue && <span className="w-9 text-right text-xs text-fg-muted tabular">{Math.round(v * 100)} %</span>}
    </div>
  )
}

export function Ring({ value, size = 56, stroke = 5, label, children, tone = 'accent' }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode; tone?: 'accent' | 'success' | 'warn' }) {
  const v = Math.max(0, Math.min(1, value))
  const mounted = useMounted()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = { accent: 'var(--accent-solid)', success: 'var(--success)', warn: 'var(--warn)' }[tone]
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v * 100)} Prozent`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (mounted ? v : 0))} style={{ transition: 'stroke-dashoffset 900ms var(--ease-out)' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular">{children ?? <CountUpText>{Math.round(v * 100)}</CountUpText>}</div>
    </div>
  )
}

// ───────────── Dialog ─────────────

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // keep the content while the dialog fades out (CSS exit transition), then unmount it
  const [shown, setShown] = useState(open)
  const last = useRef<{ title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode }>({ title, description, children, footer })
  if (open) last.current = { title, description, children, footer }
  useEffect(() => {
    if (open) return setShown(true)
    const t = setTimeout(() => setShown(false), 260)
    return () => clearTimeout(t)
  }, [open])
  const view = open ? { title, description, children, footer } : last.current
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      try {
        d.showModal()
      } catch {
        d.setAttribute('open', '')
      }
    } else if (!open && d.open) d.close()
  }, [open])
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn('sheet m-auto w-[calc(100%-2rem)] rounded-xl border border-border bg-surface bg-[image:var(--surface-sheen)] p-0 shadow-[var(--shadow-lg)]', width)}
    >
      {(open || shown) && (
        <div className="flex max-h-[min(85vh,900px)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-md font-semibold">
                {view.title}
              </h2>
              {view.description && <p className="mt-0.5 text-sm text-fg-muted">{view.description}</p>}
            </div>
            <IconButton label="Schließen" icon={X} onClick={onClose} size="sm" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{view.children}</div>
          {view.footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{view.footer}</div>}
        </div>
      )}
    </dialog>
  )
}

// ───────────── Confirm ─────────────

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
}
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), [])
  const close = (v: boolean) => {
    state?.resolve(v)
    setState(null)
  }
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>{state?.cancelLabel ?? 'Abbrechen'}</Button>
            <Button variant={state?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)} autoFocus>
              {state?.confirmLabel ?? 'Löschen'}
            </Button>
          </>
        }
      >
        <div className="text-sm text-fg-muted">{state?.message}</div>
      </Dialog>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)

// ───────────── Toasts ─────────────

interface ToastItem {
  id: number
  /** set while the toast slides out */
  leaving?: boolean
  title: string
  description?: string
  tone: 'success' | 'danger' | 'neutral' | 'accent'
  /** Optional action, e.g. "Rückgängig". */
  action?: { label: string; onClick: () => void }
}
const ToastCtx = createContext<(t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] }) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)))
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 200)
  }, [])
  const push = useCallback((t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] }) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-3), { tone: 'neutral', ...t, id }])
    setTimeout(() => dismiss(id), t.tone === 'danger' || t.action ? 7000 : 4000)
  }, [dismiss])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed z-50 flex flex-col gap-2"
        style={{ right: 'max(16px, env(safe-area-inset-right, 0px))', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px) + var(--mobile-nav-h, 0px))', maxWidth: 'min(380px, calc(100vw - 32px))' }}
      >
        {items.map((t) => {
          const Icon = t.tone === 'danger' ? AlertCircle : t.tone === 'success' ? CheckCircle2 : Info
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex gap-3 overflow-hidden rounded-xl border bg-surface bg-[image:var(--surface-sheen)] px-4 py-3 shadow-[var(--shadow-lg)]',
                t.tone === 'danger' ? 'border-danger/40' : t.tone === 'success' ? 'border-success/40' : 'border-border',
              )}
              style={{ animation: t.leaving ? 'toast-out 200ms var(--ease-in-out) both' : 'toast-in 320ms var(--ease-spring) both' }}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0 pop-in', t.tone === 'danger' ? 'text-danger' : t.tone === 'success' ? 'text-success' : 'text-accent')} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-semibold', t.tone === 'danger' && 'text-danger', t.tone === 'success' && 'text-success')}>{t.title}</div>
                {t.description && <div className="mt-0.5 text-sm text-fg-muted">{t.description}</div>}
                {t.action && (
                  <button
                    type="button"
                    className="mt-1.5 cursor-pointer text-sm font-semibold text-accent underline-offset-2 hover:underline"
                    onClick={() => {
                      t.action!.onClick()
                      dismiss(t.id)
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" aria-label="Meldung schließen" onClick={() => dismiss(t.id)} className="-mr-1 -mt-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg">
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

// ───────────── Menu ─────────────

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export function Menu({ label, icon: Icon, items, align = 'right' }: { label: string; icon: LucideIcon; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    setTimeout(() => itemRefs.current[0]?.focus(), 0)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const onKey = (e: React.KeyboardEvent) => {
    const idx = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'Escape') {
      setOpen(false)
      ;(wrap.current?.querySelector('button') as HTMLButtonElement | null)?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[(idx + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[(idx - 1 + items.length) % items.length]?.focus()
    }
  }
  return (
    <div className="relative" ref={wrap} onKeyDown={onKey}>
      <IconButton label={label} icon={Icon} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div role="menu" className={cn('menu-in absolute z-30 mt-1.5 min-w-48 rounded-xl border border-border bg-surface bg-[image:var(--surface-sheen)] p-1 shadow-[var(--shadow-lg)]', align === 'right' ? 'right-0' : 'left-0 origin-left')}>
          {items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={cn('flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-[var(--dur-1)] hover:bg-surface-2 focus:bg-surface-2 focus:outline-none active:bg-surface-3 disabled:opacity-40', it.danger ? 'text-danger' : 'text-fg')}
            >
              {it.icon && <it.icon className="size-4 shrink-0" aria-hidden />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────────── Small domain atoms ─────────────

export function SubjectDot({ color, className }: { color: number; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: `var(--s${((color % 10) + 10) % 10})` }} />
}

export function StatTile({ label, value, sub, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="surface-raised lift min-w-0 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        {Icon && <span className="flex size-5 items-center justify-center rounded-md bg-accent-soft text-accent"><Icon className="size-3" aria-hidden /></span>}
        {label}
      </div>
      <div className="mt-1.5 text-xl font-semibold font-display tabular"><CountUpText>{value}</CountUpText></div>
      {sub && <div className="mt-0.5 truncate text-xs text-fg-muted">{sub}</div>}
    </div>
  )
}
