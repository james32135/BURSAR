import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, flagsOf } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { PageHeader } from '@/components/Product'
import { AuthorityBadge } from '@/components/Product'

export function Vendors() {
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const product = useQuery({ queryKey: ['product'], queryFn: api.product })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const vendors = useMemo(() => {
    const map = new Map<string, { name: string; wallet: string; count: number; paid: number; last?: string; risk: string[]; statuses: string[] }>()
    for (const inv of queue.data?.invoices || []) {
      const wallet = String(inv.remittance || '').toLowerCase()
      if (!wallet) continue
      const cur = map.get(wallet) || { name: inv.vendor || wallet, wallet, count: 0, paid: 0, risk: [], statuses: [] }
      cur.count += 1
      if (inv.status === 'paid') cur.paid += Number(inv.amount_units || 0)
      cur.last = inv.pay_tx || cur.last
      if (inv.vendor) cur.name = inv.vendor
      if (!cur.statuses.includes(inv.status)) cur.statuses.push(inv.status)
      for (const f of flagsOf(inv)) {
        if (!cur.risk.includes(f.code)) cur.risk.push(f.code)
      }
      map.set(wallet, cur)
    }
    return [...map.values()]
  }, [queue.data])

  return (
    <div>
      <PageHeader
        title="Vendor intelligence"
        body="Allowlist lives on this vault. The agent cannot add vendors. Spend and remittance risk come from invoices in this workspace only."
        extra={<AuthorityBadge kind="owner" />}
      />
      <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
        Test remittance {LIVE.remittance} {wsQ.data?.workspace?.demo ? `DEMO on-chain allowed: ${String(product.data?.remittanceAllowed ?? '...')}` : ''}
      </p>
      <ul className="mt-8 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {vendors.map((v) => (
          <li key={v.wallet} className="grid gap-2 py-4 md:grid-cols-5">
            <span className="font-medium">{v.name}</span>
            <span className="break-all font-mono text-xs">{v.wallet}</span>
            <span>{v.count} invoices / {usd(v.paid)} paid</span>
            <span className="font-mono text-xs">{v.last ? `${v.last.slice(0, 10)}...` : '-'}</span>
            <span className="text-xs text-[var(--fg-muted)]">{v.risk[0] || 'no flags'} / {v.statuses.join(', ')}</span>
          </li>
        ))}
      </ul>
      {!vendors.length && <p className="mt-6 text-sm text-[var(--fg-muted)]">No remittance addresses in this workspace yet.</p>}
    </div>
  )
}
