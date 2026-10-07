import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '))
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark disabled:bg-primary/40',
  secondary: 'border border-line bg-card text-ink hover:bg-line-soft disabled:text-faint',
  ghost: 'text-muted hover:bg-line-soft hover:text-ink disabled:text-faint',
  danger: 'bg-attention text-white hover:bg-attention/90 disabled:bg-attention/40',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
}) {
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn('min-w-0', className)}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? <span className="text-attention"> *</span> : null}
      </label>
      <div id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
        {children}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-attention" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Input({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} className={cn('field-input tnum', invalid && 'border-attention', className)} />
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...props} className={cn('field-input', invalid && 'border-attention', className)}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('field-input', className)} />
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

type Tone = 'neutral' | 'normal' | 'risk' | 'attention' | 'primary' | 'info'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-muted border-line',
  normal: 'bg-normal-soft text-normal border-normal/25',
  risk: 'bg-risk-soft text-risk border-risk/25',
  attention: 'bg-attention-soft text-attention border-attention/25',
  primary: 'bg-primary-soft text-primary border-primary/25',
  info: 'bg-primary-soft text-primary-dark border-primary/20',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-tight font-semibold whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border px-3 py-2.5 text-sm', TONE_CLASSES[tone], className)} role={tone === 'attention' ? 'alert' : 'status'}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1', 'text-xs leading-relaxed opacity-90')}>{children}</div> : null}
    </div>
  )
}

/**
 * Modal pakai <dialog> native: backdrop, tutup dengan Esc, focus trap, dan
 * top-layer stacking semuanya gratis dari browser.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Klik pada backdrop (bukan isi panel) menutup dialog.
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'w-full rounded-lg border border-line bg-card p-0 shadow-xl backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]',
        wide ? 'max-w-3xl' : 'max-w-md',
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
          âœ•
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
      {footer ? <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div> : null}
    </dialog>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return <p className="px-1 py-2 text-xs text-muted">{total} data</p>
  }
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-1 py-2" aria-label="Navigasi halaman">
      <p className="text-xs text-muted tnum">
        Halaman {page} dari {totalPages} Â· {total} data
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Sebelumnya
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Berikutnya
        </Button>
      </div>
    </nav>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: Tone
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tnum', tone === 'attention' && 'text-attention', tone === 'risk' && 'text-risk', tone === 'normal' && 'text-normal')}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </Card>
  )
}
