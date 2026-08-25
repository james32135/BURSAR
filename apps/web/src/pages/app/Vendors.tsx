import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { PageHeader } from '@/components/Product'
import { AuthorityBadge } from '@/components/Product'

export function Vendors() {
  const memory = useQuery({ queryKey: ['vendor-memory'], queryFn: api.vendorMemory })
  const obligations = useQuery({ queryKey: ['obligations'], queryFn: api.obligations, retry: false })
  const product = useQuery({ queryKey: ['product'], queryFn: api.product })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const vendors = memory.data?.vendors || []

  return (
    <div>
      <PageHeader
        title="Vendor memory"
        body="Trusted recipient, typical range, last pay, frequency, and recipient changes — from this workspace history. A new address for a known vendor is OWNER REVIEW, not auto-pay."
        extra={<AuthorityBadge kind="owner" />}
      />
      <p className="mt-3 font-mono text-xs text-[var(--fg-muted)]">
        Test remittance {LIVE.remittance} {wsQ.data?.workspace?.demo ? `DEMO on-chain allowed: ${String(product.data?.remittanceAllowed ?? '...')}` : ''}
      </p>
      <ul className="mt-8 space-y-3">
        {vendors.map((v) => (
          <li key={v.remittance + v.name} className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">{v.name}</h2>
                <p className="mt-1 break-all font-mono text-xs text-[var(--fg-muted)]">Trusted recipient {v.remittance}</p>
              </div>
              <span
                className={`rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase ${
                  v.recipientChanged
                    ? 'border-amber-400/50 text-amber-200'
                    : v.trusted
                      ? 'border-emerald-500/40 text-emerald-300'
                      : 'border-[var(--border)] text-[var(--fg-muted)]'
                }`}
              >
                {v.recipientChanged ? 'Recipient changed' : v.trusted ? 'Trusted' : 'Watch'}
              </span>
            </div>
            {v.recipientChanged && (
              <p className="mt-3 border-l-2 border-amber-400 pl-3 text-sm text-amber-100">
                RECIPIENT CHANGED. Next payable to a different address requires owner review. 0 USDC.e moves until policy allows it.
              </p>
            )}
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4">
              <div>
                <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Payments</dt>
                <dd className="mt-1">{v.paymentCount} · {usd(v.totalPaid)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Typical</dt>
                <dd className="mt-1">{usd(v.typicalMin)}–{usd(v.typicalMax)} · last {usd(v.lastAmount)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Frequency</dt>
                <dd className="mt-1">{v.frequency || 'not enough paid history'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Blocks</dt>
                <dd className="mt-1">{v.blockCount ? `${v.blockCount} · ${v.lastBlockReason}` : 'none'}</dd>
              </div>
            </dl>
            {v.recipients && v.recipients.length > 1 && (
              <p className="mt-3 font-mono text-[10px] text-[var(--fg-muted)]">
                Recipient history {v.recipients.join(' → ')}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!vendors.length && <p className="mt-6 text-sm text-[var(--fg-muted)]">No remittance history in this workspace yet.</p>}

      <h2 className="font-display mt-12 text-xl font-bold">Remembered obligations</h2>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Recurring bills are matched to vendor, recipient, cadence, and amount range. Matching is not a blind transfer. Current policy still decides.
      </p>
      <ul className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {(obligations.data?.obligations || []).map((o) => (
          <li key={o.id} className="grid gap-2 py-3 md:grid-cols-4">
            <span>{o.vendor}</span>
            <span className="break-all font-mono text-xs">{o.remittance}</span>
            <span className="font-mono text-xs uppercase">{o.cadence}</span>
            <span className="text-xs text-[var(--fg-muted)]">{usd(o.expectedMin)}–{usd(o.expectedMax)}</span>
          </li>
        ))}
      </ul>
      {!obligations.data?.obligations?.length && (
        <p className="mt-4 text-sm text-[var(--fg-muted)]">No recurring obligations remembered yet. Submit a subscription or API bill to start one.</p>
      )}
    </div>
  )
}
