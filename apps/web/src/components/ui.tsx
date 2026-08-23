import { cn } from '@/lib/cn'

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--fg-muted)]">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-3xl tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-md border border-[var(--border)] bg-[var(--surface)] p-5', className)}>{children}</div>
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger'
  children: React.ReactNode
}) {
  const map = {
    neutral: 'border-[var(--border)] text-[var(--fg-muted)]',
    ok: 'border-[#0f7a3f]/30 text-[#0f7a3f]',
    warn: 'border-[#b45309]/30 text-[#b45309]',
    danger: 'border-[#b42318]/30 text-[#b42318]',
  }
  return (
    <span className={cn('inline-flex items-center rounded-md border bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide', map[tone])}>
      {children}
    </span>
  )
}

export function statusTone(status?: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const s = (status || '').toLowerCase()
  if (s === 'paid' || s === 'clean' || s === 'verified') return 'ok'
  if (s === 'flagged' || s === 'review') return 'warn'
  if (s === 'blocked' || s === 'invalid' || s === 'paused') return 'danger'
  return 'neutral'
}

export function humanStatus(status?: string) {
  const s = (status || 'unknown').toLowerCase()
  if (s === 'clean') return 'Ready to pay'
  if (s === 'flagged') return 'Needs review'
  if (s === 'blocked') return 'Blocked'
  if (s === 'paid') return 'Paid'
  if (s === 'verified') return 'Verified'
  return s
}

export function MoneyMoved({ moved }: { moved: boolean }) {
  return (
    <p className={cn('text-sm font-medium', moved ? 'text-[#0f7a3f]' : 'text-[var(--fg)]')}>
      Money moved? {moved ? 'YES' : 'NO'}
    </p>
  )
}

export function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="mt-4 border-t border-[var(--border)] pt-3">
      <summary className="cursor-pointer text-sm text-[var(--fg-muted)]">{summary}</summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
