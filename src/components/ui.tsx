import { clsx } from 'clsx'
import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2, X, type LucideIcon } from 'lucide-react'

export const cn = clsx

// ───────────── Buttons ─────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

const variantCls: Record<Variant, string> = {
  primary: 'bg-accent-solid text-accent-fg hover:bg-accent-solid-hover border border-transparent',
  secondary: 'bg-surface-2 text-fg border border-border hover:border-border-strong hover:bg-surface-3',
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
    'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-colors duration-150',
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
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none',
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

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' } & Record<string, unknown>) {
  return (
    <As className={cn('rounded-lg border border-border bg-surface', className)} {...rest}>
      {children}
    </As>
  )
}

export function PageHeader({ title, eyebrow, description, actions }: { title: ReactNode; eyebrow?: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-xl sm:text-2xl font-semibold">{title}</h1>
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

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, compact }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center text-center rounded-lg border border-dashed border-border-strong', compact ? 'px-4 py-6' : 'px-6 py-10')}>
      {Icon && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
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

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn(controlCls, 'h-10', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} className={cn(controlCls, 'py-2 min-h-24 leading-relaxed', invalid && 'border-danger', className)} aria-invalid={invalid || undefined} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(controlCls, 'h-10 pr-8 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
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
      className={cn('relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors', checked ? 'bg-accent-solid border-transparent' : 'bg-surface-3 border-border-strong')}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-1')} />
    </button>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange, label, size = 'md' }: { options: { value: T; label: ReactNode; title?: string }[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[5px] font-medium transition-colors cursor-pointer',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            o.value === value ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
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
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
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
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium transition-colors',
              active ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg',
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
  const color = { accent: 'bg-accent-solid', success: 'bg-success', warn: 'bg-warn', neutral: 'bg-fg-subtle' }[tone]
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${v * 100}%` }} />
      </div>
      {showValue && <span className="w-9 text-right text-xs text-fg-muted tabular">{Math.round(v * 100)} %</span>}
    </div>
  )
}

export function Ring({ value, size = 56, stroke = 5, label, children, tone = 'accent' }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode; tone?: 'accent' | 'success' | 'warn' }) {
  const v = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = { accent: 'var(--accent-solid)', success: 'var(--success)', warn: 'var(--warn)' }[tone]
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v * 100)} Prozent`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular">{children ?? `${Math.round(v * 100)}`}</div>
    </div>
  )
}

// ───────────── Dialog ─────────────

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
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
      className={cn('m-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface p-0 shadow-[var(--shadow)] backdrop:bg-transparent', width)}
    >
      {open && (
        <div className="flex max-h-[min(85vh,900px)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-md font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <IconButton label="Schließen" icon={X} onClick={onClose} size="sm" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
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
  title: string
  description?: string
  tone: 'success' | 'danger' | 'neutral' | 'accent'
}
const ToastCtx = createContext<(t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] }) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone'] }) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-3), { tone: 'neutral', ...t, id }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === 'danger' ? 7000 : 4000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed z-50 flex flex-col gap-2"
        style={{ right: 'max(16px, env(safe-area-inset-right, 0px))', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px) + var(--mobile-nav-h, 0px))', maxWidth: 'min(380px, calc(100vw - 32px))' }}
      >
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto rounded-lg border bg-surface px-4 py-3 shadow-[var(--shadow)]', t.tone === 'danger' ? 'border-danger/40' : t.tone === 'success' ? 'border-success/40' : 'border-border')}>
            <div className={cn('text-sm font-semibold', t.tone === 'danger' && 'text-danger', t.tone === 'success' && 'text-success')}>{t.title}</div>
            {t.description && <div className="mt-0.5 text-sm text-fg-muted">{t.description}</div>}
          </div>
        ))}
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
        <div role="menu" className={cn('absolute z-30 mt-1 min-w-48 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow)]', align === 'right' ? 'right-0' : 'left-0')}>
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
              className={cn('flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none disabled:opacity-40', it.danger ? 'text-danger' : 'text-fg')}
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
    <div className="min-w-0 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold font-display">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-fg-muted">{sub}</div>}
    </div>
  )
}
