import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { PageHeader } from '@/components/Product'
import { AuthorityBadge } from '@/components/Product'

export function Vendors() {
  const memory = useQuery({ queryKey: ['vendor-memory'], queryFn: api.vendorMemory })
  const product = useQuery({ queryKey: ['product'], queryFn: api.product })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const vendors = memory.data?.vendors || []

  return (
    <div>
      <PageHeader
        title="Vendor intelligence"
        body="Persisted from this workspace only. Recipient changes and amount anomalies are computed from paid history, not invented."
        extra={<AuthorityBadge kind="owner" />}
      />
      <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
        Test remittance {LIVE.remittance} {wsQ.data?.workspace?.demo ? `DEMO on-chain allowed: ${String(product.data?.remittanceAllowed ?? '...')}` : ''}
      </p>
      <ul className="mt-8 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {vendors.map((v) => (
          <li key={v.remittance} className="grid gap-2 py-4 md:grid-cols-5">
            <span className="font-medium">{v.name}</span>
            <span className="break-all font-mono text-xs">{v.remittance}</span>
            <span>{v.paymentCount} paid / {usd(v.totalPaid)}</span>
            <span className="text-xs text-[var(--fg-muted)]">typical {usd(v.typicalAmount)} · last {usd(v.lastAmount)}</span>
            <span className="text-xs text-[var(--fg-muted)]">{v.blockCount ? `${v.blockCount} blocks · ${v.lastBlockReason}` : 'no blocks'}</span>
          </li>
        ))}
      </ul>
      {!vendors.length && <p className="mt-6 text-sm text-[var(--fg-muted)]">No remittance history in this workspace yet.</p>}
    </div>
  )
}
