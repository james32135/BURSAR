import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, attentionFromInvoices, flagsOf, hashOf } from '@/lib/api'
import { usd } from '@/lib/cn'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge } from '@/components/Product'
import { isDemoMode, loadWorkspace } from '@/lib/workspace'

export function Overview() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000 })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const attention = useQuery({ queryKey: ['attention'], queryFn: api.attention, retry: false })
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events })
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const stats = wsQ.data?.stats
  const invoices = attention.data?.payables || queue.data?.invoices || []
  const att = attention.data || attentionFromInvoices(invoices, session?.remaining || '0')
  const stored = loadWorkspace()
  const demo = stored?.demo ?? isDemoMode()
  const exceptions = invoices.filter((i) => i.status === 'flagged' || i.status === 'blocked' || i.pipeline === 'queued' || i.status === 'received')
  const paid = invoices.filter((i) => i.pay_tx)
  const security = (events.data?.events || []).filter((ev) =>
    /block|denied|paused|revok|fail|duplicate|paying|confirmed/i.test(String(ev.kind))
  )

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
            {vs?.paused ? 'Vault is paused.' : 'What needs my attention?'}
          </h1>
          <p className="mt-3 max-w-xl text-[var(--fg-muted)]">
              {demo
              ? 'DEMO workspace (shared judge vault). Create your own from Get started.'
              : 'What needs my attention. Then payable → decision → action → proof.'}
          </p>
        </div>
        <span className={`inline-flex rounded-[4px] border px-3 py-1 font-mono text-[10px] uppercase ${vs?.paused ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}>
          {vs?.paused ? 'paused' : 'open'}
        </span>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'New payables', v: String(att?.new ?? '—') },
          { k: 'Auto-pay', v: `${att?.autoPay ?? 0} / ${usd(att?.autoApprovedUnits)}` },
          { k: 'Owner review', v: String(att?.ownerReview ?? 0) },
          { k: 'Blocked', v: `${att?.blocked ?? 0}${att?.duplicate ? ` · ${att.duplicate} dup` : ''}` },
        ].map((c) => (
          <div key={c.k} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{c.k}</div>
            <div className="font-display mt-2 text-2xl font-bold">{c.v}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-[var(--fg-muted)]">
        Open total {usd(att?.totalUnits)} · vault {usd(vs?.usdc)} · session remaining {usd(session?.remaining)}
      </p>

      {stats && (
        <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
          Processed {stats.processed} · paid {stats.paid} · escalated {stats.escalated} · blocked {stats.blocked}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/app/review" className="rounded-[4px] bg-white px-4 py-2 text-sm font-medium text-[#09090b]">
          Resolve exceptions
        </Link>
        <Link to="/app/inbox" className="rounded-[4px] border border-[var(--border)] px-4 py-2 text-sm">
          Open inbox
        </Link>
      </div>

      <h2 className="font-display mt-12 text-xl font-bold">Needs attention</h2>
      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {(exceptions.length ? exceptions : invoices.slice(0, 8)).map((inv) => (
          <li key={hashOf(inv)} className="flex items-center justify-between py-3">
            <Link to={'/app/inbox/' + hashOf(inv)} className="font-mono text-xs hover:underline">
              {inv.vendor || hashOf(inv).slice(0, 12)} {usd(inv.amount_units)}
            </Link>
            <span className="flex items-center gap-2">
              <span className="max-w-[280px] truncate text-xs text-[var(--fg-muted)]">
                {Array.isArray(inv.why) && inv.why[0] ? inv.why[0] : flagsOf(inv)[0]?.code || ''}
              </span>
              <StatusChip status={inv.status} />
            </span>
          </li>
        ))}
        {!invoices.length && <li className="py-6 text-sm text-[var(--fg-muted)]">No payables yet. Connect an intake channel.</li>}
      </ul>

      <h2 className="font-display mt-12 text-xl font-bold">Recent payments</h2>
      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {paid.slice(0, 6).map((inv) => (
          <li key={hashOf(inv)} className="flex items-center justify-between py-3">
            <Link to={'/app/inbox/' + hashOf(inv)} className="font-mono text-xs hover:underline">
              {inv.vendor || hashOf(inv).slice(0, 12)} {usd(inv.amount_units)}
            </Link>
            <Link className="text-xs text-[#93c5fd] underline" to={'/app/proof/' + (inv.pay_tx || hashOf(inv))}>
              Proof
            </Link>
          </li>
        ))}
        {!paid.length && <li className="py-6 text-sm text-[var(--fg-muted)]">No USDC.e has moved from this vault yet.</li>}
      </ul>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Agent</h2>
        <AuthorityBadge kind="agent" />
      </div>
      <p className="mt-2 text-sm">{session?.revoked ? 'Revoked' : session?.exists ? 'Session live. Cannot withdraw.' : 'Authorize a session from Get started.'}</p>

      <h2 className="font-display mt-12 text-xl font-bold">Security events</h2>
      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {(security.length ? security : events.data?.events || []).slice(0, 8).map((ev) => (
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
