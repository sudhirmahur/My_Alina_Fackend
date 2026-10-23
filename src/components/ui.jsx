import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, X } from './icons'
import { cx } from '../lib/cx'
import { friendly } from '../lib/errors'

/* ------------------------------------------------------------------ Avatar */
export function Avatar({ size = 40, glow = false, pulse = false, className, label = 'Alina' }) {
  return (
    <span className={cx('relative inline-block shrink-0 rounded-full', pulse && 'ring-pulse', className)} style={{ width: size, height: size }}>
      {glow && <span aria-hidden className="absolute -inset-3 rounded-full bg-accent/25 blur-2xl" />}
      <img src={size > 96 ? '/alina.webp' : '/alina-sm.webp'} alt={label} width={size} height={size} draggable={false}
        className="relative size-full rounded-full object-cover ring-1 ring-line" />
    </span>
  )
}

/* ------------------------------------------------------------------ Button */
const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-[0_6px_24px_-8px_var(--accent)]',
  soft: 'bg-raised text-ink hover:bg-raised/70 border border-line',
  ghost: 'text-muted hover:text-ink hover:bg-raised/60',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
  solidDanger: 'bg-danger text-white hover:brightness-110',
}
const SIZES = { sm: 'min-h-9 px-3 text-sm gap-1.5', md: 'min-h-11 px-4 text-[0.95rem] gap-2', lg: 'min-h-12 px-6 text-base gap-2' }

export function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...rest }) {
  return (
    <button type={type} disabled={disabled || loading} {...rest}
      className={cx('inline-flex items-center justify-center rounded-2xl font-medium transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className)}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-[1.1em]" />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, active, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40',
        size === 'sm' ? 'size-9' : 'size-11', variant === 'ghost' ? 'text-muted hover:bg-raised/70 hover:text-ink' : VARIANTS[variant],
        active && 'bg-raised text-accent', className)}>
      <Icon className={size === 'sm' ? 'size-[1.05rem]' : 'size-5'} />
    </button>
  )
}

/* ------------------------------------------------------------------ Surfaces */
export function Card({ className, children, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} className={cx('rounded-3xl border border-line bg-surface/90 p-4 backdrop-blur-sm', className)}>{children}</Tag>
}

export function Badge({ tone = 'neutral', children, className }) {
  const tones = {
    neutral: 'bg-raised text-muted', accent: 'bg-accent/15 text-accent', ok: 'bg-ok/15 text-ok',
    warn: 'bg-warn/15 text-warn', danger: 'bg-danger/15 text-danger',
  }
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

export const Spinner = ({ className }) => <Loader2 className={cx('size-5 animate-spin text-muted', className)} aria-label="Loading" />

export const Skeleton = ({ className }) => <div className={cx('skeleton rounded-2xl', className)} aria-hidden />

export function EmptyState({ icon: Icon, title, text, action, className }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      {Icon && <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent/12 text-accent"><Icon className="size-7" /></span>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorNote({ error, onRetry, className }) {
  if (!error) return null
  return (
    <div role="alert" className={cx('flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-sm', className)}>
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
      <p className="min-w-0 flex-1 leading-snug">{typeof error === 'string' ? error : friendly(error)}</p>
      {onRetry && <button onClick={onRetry} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-danger hover:bg-danger/15"><RefreshCw className="size-3.5" />Retry</button>}
    </div>
  )
}

/* ------------------------------------------------------------------ Forms */
const fieldBase = 'w-full rounded-2xl border border-line bg-raised/70 px-4 text-ink placeholder:text-muted/70 transition focus:border-accent/70 focus:bg-raised focus:outline-none focus:ring-4 focus:ring-accent/15'

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-sm font-medium text-ink/90">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Input({ className, invalid, ...rest }) {
  return <input {...rest} className={cx(fieldBase, 'min-h-12', invalid && 'border-danger/70', className)} />
}

export function Textarea({ className, ...rest }) {
  return <textarea {...rest} className={cx(fieldBase, 'min-h-24 resize-none py-3 leading-relaxed', className)} />
}

export function Select({ className, children, ...rest }) {
  return <select {...rest} className={cx(fieldBase, 'min-h-12 appearance-none bg-no-repeat pr-10', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23a99ca3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: 'right 1rem center' }}>{children}</select>
}

export function Switch({ checked, onChange, label, description, disabled }) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[0.95rem] font-medium">{label}</label>
        {description && <p className="mt-0.5 text-xs leading-snug text-muted">{description}</p>}
      </div>
      <button id={id} role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-accent' : 'bg-raised border border-line')}>
        <span className={cx('absolute top-0.5 size-6 rounded-full shadow transition-all', checked ? 'left-[1.4rem] bg-accent-ink' : 'left-0.5 bg-muted')} />
      </button>
    </div>
  )
}

export function Segmented({ value, onChange, options, className, label }) {
  return (
    <div role="tablist" aria-label={label} className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface/80 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx('min-h-9 flex-1 whitespace-nowrap rounded-xl px-3.5 text-sm font-medium transition',
            value === o.value ? 'bg-accent text-accent-ink shadow' : 'text-muted hover:text-ink')}>
          {o.label}{o.count != null && <span className="ml-1.5 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cx('min-h-9 whitespace-nowrap rounded-full border px-3.5 text-sm transition',
        active ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface/70 text-muted hover:text-ink')}>{children}</button>
  )
}

/* ------------------------------------------------------------------ Sheet / dialogs */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={cx('sheet-in relative flex max-h-[92dvh] w-full flex-col rounded-t-[1.75rem] border border-line bg-surface shadow-2xl outline-none sm:rounded-[1.75rem]',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md')}>
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>, document.body)
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text, confirmLabel = 'Confirm', danger = false, requireText }) {
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  useEffect(() => { if (!open) { setTyped(''); setBusy(false) } }, [open])
  const ok = !requireText || typed.trim() === requireText
  const run = async () => {
    setBusy(true)
    try { await onConfirm(); onClose() } catch { /* the caller already showed the error; keep the dialog open */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={busy ? undefined : onClose} title={title}
      footer={<div className="flex gap-3"><Button variant="soft" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={danger ? 'solidDanger' : 'primary'} className="flex-1" loading={busy} disabled={!ok} onClick={run}>{confirmLabel}</Button></div>}>
      {text && <p className="text-sm leading-relaxed text-muted">{text}</p>}
      {requireText && (
        <Field label={`Type “${requireText}” to continue`} className="mt-4">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="off" autoComplete="off" />
        </Field>
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ Page chrome */
export function PageHeader({ title, subtitle, back, actions, className }) {
  const nav = useNavigate()
  return (
    <header className={cx('pt-safe sticky top-0 z-20 border-b border-line/60 bg-bg/80 backdrop-blur-xl', className)}>
      <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-2 px-4">
        {back && <IconButton icon={ArrowLeft} label="Back" className="-ml-2" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.45rem] font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

export const PageBody = ({ children, className }) => (
  <main className={cx('page-in mx-auto w-full max-w-3xl flex-1 px-4 py-5', className)}>{children}</main>
)
