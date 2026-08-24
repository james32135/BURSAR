import { cn } from '@/lib/cn'

const TONE: Record<string, string> = {
  clean: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  flagged: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  blocked: 'border-red-500/40 bg-red-500/10 text-red-300',
  stored: 'border-[var(--border)] text-[var(--fg-muted)]',
}

export function StatusChip({ status }: { status?: string | null }) {
  const s = (status || 'unknown').toLowerCase()
  return (
    <span className={cn('inline-flex rounded-[4px] border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide', TONE[s] || 'border-[var(--border)] text-[var(--fg-muted)]')}>
      {s === 'clean' ? 'auto-pay' : s}
    </span>
  )
}
