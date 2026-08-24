import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, flagsOf, hashOf } from '@/lib/api'
import { usd } from '@/lib/cn'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge } from '@/components/Product'
import { loadWorkspace } from '@/lib/workspace'

export function Overview() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000 })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events })
  const invoices = queue.data?.invoices || []
  const vs = wsQ.data?.vaultState || health.data?.vaultState
  const session = wsQ.data?.session || health.data?.session
  const stats = wsQ.data?.stats
  const remainingUnits = Number(session?.remaining || 0)
  const flagged = invoices.filter((i) => i.status === 'flagged' || i.status === 'blocked')
  const paid = invoices.filter((i) => i.status === 'paid')
  const clean = invoices.filter((i) => i.status === 'clean' && Number(i.amount_units || 0) <= remainingUnits)
  const blocked = invoices.filter((i) => i.status === 'blocked')
  const stored = loadWorkspace()
  const demo = stored?.demo ?? true

  if (health.isError) {
    return (
      <div className="rounded-[4px] border border-red-500/30 p-6">
        <h1 className="font-display text-2xl font-bold">Cannot reach the BURSAR API</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">{(health.error as Error).message}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            {vs?.paused ? 'Vault is paused.' : 'What needs attention?'}
          </h1>
          <p className="mt-3 max-w-xl text-[var(--fg-muted)]">
            {demo ? 'DEMO workspace (shared judge vault). Create your own from Get started.' : 'Your isolated workspace. Agent cannot withdraw or change policy.'}
          </p>
        </div>
        <span className={`inline-flex rounded-[4px] border px-3 py-1 font-mono text-[10px] uppercase ${vs?.paused ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}>
          {vs?.paused ? 'paused' : 'open'}
        </span>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { k: 'Waiting', v: String(invoices.filter((i) => i.status === 'stored' || i.status === 'flagged').length) },
          { k: 'Auto-pay ready', v: String(clean.length) },
          { k: 'Blocked', v: String(blocked.length) },
          { k: 'Approvals', v: String(invoices.filter((i) => flagsOf(i).some((f) => f.code === 'over-band0')).length) },
          { k: 'Paid', v: String(paid.length) },
          { k: 'Vault USDC.e', v: usd(vs?.usdc) },
        ].map((c) => (
          <div key={c.k} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{c.k}</div>
            <div className="font-display mt-2 text-2xl font-bold">{c.v}</div>
          </div>
        ))}
      </div>

      {stats && (
        <p className="mt-6 font-mono text-xs text-[var(--fg-muted)]">
          Processed {stats.processed} · paid {stats.paid} · escalated {stats.escalated} · blocked {stats.blocked} · routed {usd(stats.routedUnits)}
        </p>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="rounded-[4px] border border-[var(--border)] p-5">
          <h2 className="font-display text-xl font-bold">Policy</h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Band 0 {usd(vs?.band0Max)}. Band 1 {usd(vs?.band1Max)} owner only. Version {vs?.policyVersion}.
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--fg-muted)]">
            Spent {usd(session?.spent)} of {usd(session?.cap)}
          </p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Agent</h2>
            <AuthorityBadge kind="agent" />
          </div>
          <p className="mt-2 text-sm">{session?.revoked ? 'Revoked' : session?.exists ? 'Session live. Cannot withdraw.' : 'Authorize a session from Get started.'}</p>
          <p className="mt-1 break-all font-mono text-xs text-[var(--fg-muted)]">{session?.agent}</p>
        </div>
      </div>

      <h2 className="font-display mt-12 text-xl font-bold">Queue</h2>
      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {(flagged.length ? flagged : invoices.slice(0, 8)).map((inv) => (
          <li key={hashOf(inv)} className="flex items-center justify-between py-3">
            <Link to={'/app/inbox/' + hashOf(inv)} className="font-mono text-xs hover:underline">
              {hashOf(inv).slice(0, 12)}... {inv.vendor || '-'} {usd(inv.amount_units)}
            </Link>
            <StatusChip status={inv.status} />
          </li>
        ))}
        {!invoices.length && <li className="py-6 text-sm text-[var(--fg-muted)]">Inbox is empty. Submit a PDF.</li>}
      </ul>

      <h2 className="font-display mt-12 text-xl font-bold">Activity</h2>
      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {(events.data?.events || []).slice(0, 8).map((ev) => (
          <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-3 font-mono text-xs text-[var(--fg-muted)]">
            <span className="text-[var(--fg)]">{ev.kind}</span>
            <span>{ev.invoice_hash ? `${String(ev.invoice_hash).slice(0, 12)}...` : '-'}</span>
            <span>{ev.created_at}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
