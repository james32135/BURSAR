import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, attentionFromInvoices, flagsOf, hashOf, type Invoice } from '@/lib/api'
import { usd, txUrl, storageUrl, shortHash } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge } from '@/components/Product'
import { SourceChannels } from '@/components/SourceChannels'
import { isDemoMode, loadWorkspace } from '@/lib/workspace'

type Bucket = 'new' | 'autopay' | 'review' | 'blocked' | 'paid'

function nextAction(inv: Invoice) {
  if (inv.nextAction) return inv.nextAction
  if (inv.pay_tx || inv.status === 'paid') return 'PROOF'
  if (inv.status === 'blocked') return 'WHY'
  if (inv.status === 'flagged' || inv.decision === 'owner-review') return 'OPEN'
  if (inv.status === 'clean' || inv.decision === 'auto-pay') return 'PAY'
  return 'WAIT'
}

function inBucket(inv: Invoice, bucket: Bucket) {
  if (bucket === 'paid') return inv.status === 'paid' || Boolean(inv.pay_tx)
  if (bucket === 'blocked') return inv.status === 'blocked'
  if (bucket === 'review') return inv.status === 'flagged' || inv.decision === 'owner-review'
  if (bucket === 'autopay') return (inv.status === 'clean' || inv.decision === 'auto-pay') && !inv.pay_tx
  return inv.status !== 'paid' && !inv.pay_tx
}

export function Overview() {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000 })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const attention = useQuery({ queryKey: ['attention'], queryFn: api.attention, retry: false })
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const events = useQuery({ queryKey: ['events'], queryFn: api.events })
  const [bucket, setBucket] = useState<Bucket>('new')
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const stats = wsQ.data?.stats
  const invoices = attention.data?.payables || queue.data?.invoices || []
  const att = attention.data || attentionFromInvoices(invoices, session?.remaining || '0')
  const stored = loadWorkspace()
  const demo = stored?.demo ?? isDemoMode()
  const rows = useMemo(() => invoices.filter((i) => inBucket(i, bucket)), [invoices, bucket])
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
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--fg-muted)]">AP clerk desk</p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            {vs?.paused ? 'Vault is paused.' : 'What needs my attention?'}
          </h1>
          <p className="mt-3 max-w-xl text-[var(--fg-muted)]">
            {demo
              ? 'DEMO workspace (shared judge vault). Create your own from Get started.'
              : 'Invoice in. Fake blocked. USDC paid. Next action is PAY, OPEN, WHY, or PROOF.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <a className="font-mono text-[#93c5fd] underline" href={txUrl(LIVE.featured.paid.tx)}>
              Paid {shortHash(LIVE.featured.paid.tx, 4)}
            </a>
            <Link className="font-mono text-[#93c5fd] underline" to={'/verify/' + LIVE.featured.blocked.invoice}>
              Splice blocked
            </Link>
            <a className="font-mono text-[#93c5fd] underline" href={storageUrl(LIVE.featured.paid.storageRoot)}>
              Storage root
            </a>
          </div>
          <SourceChannels />
          <p className="mt-2 max-w-xl text-xs text-[var(--fg-muted)]">
            Web, API, MCP, SDK, and Telegram are clients of one clerk. Memory at{' '}
            <Link className="text-[#93c5fd] underline" to="/app/vendors">
              /app/vendors
            </Link>{' '}
            changes PAY / OPEN / WHY. The agent still cannot own the vault.
          </p>
        </div>
        <span className={`inline-flex rounded-[4px] border px-3 py-1 font-mono text-[10px] uppercase ${vs?.paused ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}>
          {vs?.paused ? 'paused' : 'open'}
        </span>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
            { k: 'New', v: String(att?.new ?? '-'), sub: usd(att?.totalUnits) },
          { k: 'Auto-pay', v: String(att?.autoPay ?? 0), sub: usd(att?.autoApprovedUnits) },
          { k: 'Owner review', v: String(att?.ownerReview ?? 0), sub: usd(att?.waitingForYouUnits) },
          { k: 'Blocked', v: `${att?.blocked ?? 0}${att?.duplicate ? ` · ${att.duplicate} dup` : ''}`, sub: usd(att?.blockedUnits) },
          { k: 'Paid recently', v: String(att?.paidRecently ?? 0), sub: usd(att?.paidRecentUnits) },
        ].map((c) => (
          <div key={c.k} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{c.k}</div>
            <div className="font-display mt-2 text-2xl font-bold">{c.v}</div>
            <div className="mt-1 font-mono text-[10px] text-[var(--fg-muted)]">{c.sub}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-[var(--fg-muted)]">
        Waiting {usd(att?.totalUnits)} · auto-approved {usd(att?.autoApprovedUnits)} · waiting for you {usd(att?.waitingForYouUnits)} · blocked {usd(att?.blockedUnits)} · vault {usd(vs?.usdc)} · session remaining {usd(session?.remaining)}
      </p>

      {stats && (
        <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
          Processed {stats.processed} · paid {stats.paid} · escalated {stats.escalated} · blocked {stats.blocked}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {(
          [
            ['new', 'New'],
            ['autopay', 'Auto-pay ready'],
            ['review', 'Owner review'],
            ['blocked', 'Blocked'],
            ['paid', 'Paid'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setBucket(id)}
            className={`rounded-[4px] border px-3 py-1.5 text-xs uppercase ${bucket === id ? 'border-white bg-white text-[#09090b]' : 'border-[var(--border)] text-[var(--fg-muted)]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase text-[var(--fg-muted)]">
              <th className="py-2 pr-3">Source</th>
              <th className="py-2 pr-3">Vendor</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Recipient</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Why</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2 pr-3">Next</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((inv) => {
              const action = nextAction(inv)
              return (
                <tr key={hashOf(inv)} className="border-b border-[var(--border)]">
                  <td className="py-3 pr-3 font-mono text-[10px] uppercase text-[var(--fg-muted)]">{inv.source || 'pdf'}</td>
                  <td className="py-3 pr-3">
                    <Link to={'/app/inbox/' + hashOf(inv)} className="hover:underline">
                      {inv.vendor || hashOf(inv).slice(0, 12)}
                    </Link>
                    <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{inv.kind || 'invoice'}</div>
                  </td>
                  <td className="py-3 pr-3">{usd(inv.amount_units)}</td>
                  <td className="max-w-[140px] truncate py-3 pr-3 font-mono text-[10px]">{inv.remittance || '-'}</td>
                  <td className="py-3 pr-3">
                    <StatusChip status={inv.status} />
                  </td>
                  <td className="max-w-[280px] py-3 pr-3 text-xs text-[var(--fg-muted)]">
                    {Array.isArray(inv.why) && inv.why[0] ? inv.why[0] : flagsOf(inv)[0]?.code || '-'}
                  </td>
                  <td className="py-3 pr-3 font-mono text-[10px]">{inv.dueDate || '-'}</td>
                  <td className="py-3 pr-3">
                    <Link
                      to={action === 'PROOF' && inv.pay_tx ? '/app/proof/' + inv.pay_tx : '/app/inbox/' + hashOf(inv)}
                      className="rounded-[4px] border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] uppercase hover:bg-white hover:text-[#09090b]"
                    >
                      {action}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="py-6 text-sm text-[var(--fg-muted)]">
            {bucket === 'paid' ? 'No USDC.e has moved from this vault yet.' : 'Nothing in this bucket. Connect Telegram, API, MCP, SDK, or upload a document.'}
          </p>
        )}
      </div>

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
