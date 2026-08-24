import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'

const STEPS = [
  { to: '/app/inbox', label: 'Inbox' },
  { to: '/app/review', label: 'Review' },
  { to: '/app/policies', label: 'Policy' },
  { to: '/app/payments', label: 'Payment' },
  { to: '/app/proof', label: 'Proof' },
]

export function WorkflowRail() {
  const loc = useLocation()
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--fg-muted)]">
      {STEPS.map((s, i) => {
        const on = loc.pathname.startsWith(s.to)
        return (
          <li key={s.to} className="flex items-center gap-1">
            {i > 0 && <span className="px-1 text-[var(--fg-muted)]/50" aria-hidden>→</span>}
            <Link to={s.to} className={cn('rounded-[4px] px-2 py-1 hover:text-[var(--fg)]', on && 'bg-white text-[#09090b]')}>
              {s.label}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

export function AuthorityBadge({ kind }: { kind: 'owner' | 'agent' }) {
  if (kind === 'owner') {
    return (
      <span className="inline-flex rounded-[4px] border border-white px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
        Owner signature
      </span>
    )
  }
  return (
      <span className="inline-flex rounded-[4px] border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-300">
        Autonomous · no wallet
      </span>
  )
}

export function PageHeader({ title, body, extra }: { kicker?: string; title: string; body?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {body && <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">{body}</p>}
      </div>
      {extra}
    </div>
  )
}
