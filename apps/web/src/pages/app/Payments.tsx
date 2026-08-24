import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, hashOf } from '@/lib/api'
import { txUrl, usd } from '@/lib/cn'
import { StatusChip } from '@/components/StatusChip'
import { PageHeader } from '@/components/Product'

export function Payments() {
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const paid = (queue.data?.invoices || []).filter((i) => i.pay_tx)
  return (
    <div>
      <PageHeader
        title="Settlement history"
        body="USDC.e transfers from this workspace vault only. Explorer links are live ChainScan."
      />
      <div className="mt-8 overflow-x-auto rounded-[4px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="font-medium">Token</th>
              <th className="font-medium">Recipient</th>
              <th className="font-medium">Invoice</th>
              <th className="font-medium">Tx</th>
              <th className="font-medium">Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {paid.map((inv) => (
              <tr key={hashOf(inv)}>
                <td className="px-4 py-4">{usd(inv.amount_units)}</td>
                <td>USDC.e</td>
                <td className="max-w-[180px] truncate font-mono text-xs">{inv.remittance}</td>
                <td>
                  <Link className="font-mono text-xs text-[#93c5fd] underline" to={'/app/inbox/' + hashOf(inv)}>
                    {hashOf(inv).slice(0, 12)}...
                  </Link>
                </td>
                <td>
                  <a className="font-mono text-xs text-[#93c5fd] underline" href={txUrl(inv.pay_tx!)}>
                    {inv.pay_tx!.slice(0, 10)}...
                  </a>
                </td>
                <td>
                  <Link className="text-xs uppercase" to={'/app/proof/' + inv.pay_tx}>
                    <StatusChip status="paid" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!paid.length && <p className="mt-6 text-sm text-[var(--fg-muted)]">No paid invoices in this workspace yet.</p>}
    </div>
  )
}
