import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, extractedOf, flagsOf, hashOf } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { loadWorkspace } from '@/lib/workspace'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MagneticButton } from '@/components/MagneticButton'

type Sort = 'urgency' | 'amount' | 'risk' | 'due'

export function Review() {
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const qc = useQueryClient()
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<Sort>('urgency')
  const [vendor, setVendor] = useState('')
  const [risk, setRisk] = useState('all')
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState('')

  const all = queue.data?.invoices || []
  const remaining = Number(wsQ.data?.session?.remaining || 0)
  const auto = all.filter((i) => i.status === 'clean' && !i.pay_tx && Number(i.amount_units || 0) <= remaining)
  const review = all.filter((i) => i.status === 'flagged')
  const blocked = all.filter((i) => i.status === 'blocked')
  const paused = wsQ.data?.vaultState?.paused
  const autoTotal = auto.reduce((n, i) => n + Number(i.amount_units || 0), 0)
  const vault = wsQ.data?.workspace?.vault || loadWorkspace()?.vault || LIVE.vault

  const rows = useMemo(() => {
    let list = [...all]
    if (status !== 'all') list = list.filter((i) => i.status === status)
    if (vendor) list = list.filter((i) => (i.vendor || '').toLowerCase().includes(vendor.toLowerCase()))
    if (risk === 'block') list = list.filter((i) => flagsOf(i).some((f) => f.severity === 'block'))
    if (risk === 'review') list = list.filter((i) => flagsOf(i).some((f) => f.severity === 'review'))
    const urgency = (s: string) => (s === 'blocked' ? 0 : s === 'flagged' ? 1 : s === 'clean' ? 2 : 3)
    list.sort((a, b) => {
      if (sort === 'amount') return Number(b.amount_units || 0) - Number(a.amount_units || 0)
      if (sort === 'risk') return flagsOf(b).length - flagsOf(a).length
      if (sort === 'due') return String(extractedOf(a).due_date || '').localeCompare(String(extractedOf(b).due_date || ''))
      return urgency(a.status) - urgency(b.status)
    })
    return list
  }, [all, status, sort, vendor, risk])

  const payAllowed = useMutation({
    mutationFn: async () => {
      const results: string[] = []
      for (const inv of auto) {
        const id = hashOf(inv)
        try {
          const res = await api.pay(id)
          results.push(`${id.slice(0, 10)}... paid ${res.hash || res.tx || ''}`)
        } catch (e) {
          results.push(`${id.slice(0, 10)}... ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      return results
    },
    onSuccess: (results) => {
      setLog(results.join('\n'))
      setOpen(false)
      qc.invalidateQueries()
    },
  })

  return (
    <div>
      <PageHeader
        title="Approval queue"
        body="BursarVault has no batch function. Allowed invoices can be paid one transaction each. Blocked invoices never move USDC.e."
        extra={<AuthorityBadge kind="agent" />}
      />
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[
          { k: 'In queue', v: String(all.length) },
          { k: 'Auto-pay ready', v: `${auto.length} / ${usd(autoTotal)}` },
          { k: 'Owner review', v: String(review.length) },
          { k: 'Blocked', v: String(blocked.length) },
        ].map((c) => (
          <div key={c.k} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{c.k}</div>
            <div className="font-display mt-1 text-xl font-bold">{c.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MagneticButton disabled={!auto.length || paused || payAllowed.isPending} onClick={() => setOpen(true)}>
          Pay {auto.length} allowed
        </MagneticButton>
        <p className="text-xs text-[var(--fg-muted)]">
          Not a multicall. Each pay is session.pay then USDC.e.transfer. No wallet prompt.
        </p>
      </div>
      {log && <pre className="mt-3 overflow-auto rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-[11px]">{log}</pre>}
      <div className="mt-6 flex flex-wrap gap-2">
        {['all', 'clean', 'flagged', 'blocked', 'paid'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-[4px] border px-3 py-1 text-xs uppercase ${status === s ? 'border-white bg-white text-[#09090b]' : 'border-[var(--border)] text-[var(--fg-muted)]'}`}
          >
            {s === 'clean' ? 'auto-approved' : s === 'flagged' ? 'review required' : s}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Filter vendor"
          aria-label="Filter vendor"
          className="h-9 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
        />
        <select
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
          aria-label="Filter risk"
          className="h-9 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
        >
          <option value="all">All risk</option>
          <option value="review">Review flags</option>
          <option value="block">Block flags</option>
        </select>
        {(['urgency', 'amount', 'risk', 'due'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSort(s)} className={`rounded-[4px] border px-3 py-1 text-xs ${sort === s ? 'border-white text-white' : 'border-[var(--border)] text-[var(--fg-muted)]'}`}>
            Sort {s}
          </button>
        ))}
      </div>
      <ul className="mt-6 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {rows.map((inv) => (
          <li key={hashOf(inv)}>
            <Link to={'/app/inbox/' + hashOf(inv)} className="grid gap-2 py-4 md:grid-cols-6">
              <StatusChip status={inv.status} />
              <span>{inv.vendor || '-'}</span>
              <span>{usd(inv.amount_units)}</span>
              <span className="font-mono text-xs">{flagsOf(inv)[0]?.code || '-'}</span>
              <span className="text-xs text-[var(--fg-muted)]">{extractedOf(inv).due_date || '-'}</span>
              <span className="font-mono text-xs">{hashOf(inv).slice(0, 12)}...</span>
            </Link>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={open}
        busy={payAllowed.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => payAllowed.mutate()}
        confirmLabel="Execute sequential session pays"
        title="Autonomous session actions. No wallet prompt."
        intent={{
          what: `${auto.length} separate BursarVault.pay calls (no batch opcode)`,
          why: 'Each invoice is Band 0, allowlisted, unique hash. Contract has no batch.',
          amount: usd(autoTotal),
          recipient: 'per-invoice remittance',
          contract: vault,
          network: '0G Aristotle 16661',
          after: 'Each success emits Paid + USDC.e Transfer. Failures stop that invoice only.',
        }}
      />
    </div>
  )
}
