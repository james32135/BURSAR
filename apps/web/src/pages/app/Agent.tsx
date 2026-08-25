import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { usd } from '@/lib/cn'
import { AuthorityBadge } from '@/components/Product'

export function AgentPage() {
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace })
  const bounds = useQuery({ queryKey: ['agent-bounds'], queryFn: api.agentBounds, retry: false })
  const s = wsQ.data?.session
  const stats = wsQ.data?.stats
  const expiry = s?.expiry ? new Date(Number(s.expiry) * 1000).toISOString() : '-'
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Capability, not ownership.</h1>
          <p className="mt-3 max-w-xl text-[var(--fg-muted)]">
            Give an existing agent BURSAR access without giving it treasury ownership. Same tools as MCP and @bursar/sdk.
          </p>
        </div>
        <AuthorityBadge kind="agent" />
      </div>

      {stats && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { k: 'Processed', v: String(stats.processed) },
            { k: 'Paid', v: String(stats.paid) },
            { k: 'Escalated', v: String(stats.escalated) },
            { k: 'Blocked', v: String(stats.blocked) },
            { k: 'Routed', v: usd(stats.routedUnits) },
            { k: 'Policy blocks', v: String(stats.policyViolations) },
          ].map((c) => (
            <div key={c.k} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{c.k}</div>
              <div className="font-display mt-2 text-2xl font-bold">{c.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="rounded-[4px] border border-emerald-500/20 p-5">
          <h2 className="font-display text-lg font-bold">Can</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--fg-muted)]">
            <li>Inspect payables</li>
            <li>Analyze invoices with Direct TeeML</li>
            <li>Request owner approval</li>
            <li>Execute allowed Band 0 payments</li>
            <li>Read vendor memory</li>
            <li>Verify payments on 0G</li>
          </ul>
        </div>
        <div className="rounded-[4px] border border-red-500/20 p-5">
          <h2 className="font-display text-lg font-bold">Cannot</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--fg-muted)]">
            <li>Withdraw</li>
            <li>Change policy</li>
            <li>Add vendors</li>
            <li>Raise limits</li>
            <li>Pause or unpause the vault</li>
            <li>Revoke itself</li>
            <li>Access other workspaces</li>
            <li>Receive the owner key</li>
          </ul>
          {bounds.data?.calls && (
            <ul className="mt-4 space-y-1 font-mono text-[11px] text-red-300">
              {bounds.data.calls.map((c) => (
                <li key={c.fn}>
                  {c.fn} {c.reverted ? `reverted ${c.reason}` : 'UNEXPECTED SUCCESS'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-8 font-mono text-xs text-[var(--fg-muted)]">
        Session {s?.revoked ? 'revoked' : s?.exists ? 'active' : 'missing'} · cap {usd(s?.cap)} · spent {usd(s?.spent)} · remaining {usd(s?.remaining)} · {expiry}
      </p>
      <p className="mt-4 text-sm">
        <Link className="text-[#93c5fd] underline" to="/agent">Open MCP / SDK</Link>
      </p>
    </div>
  )
}
