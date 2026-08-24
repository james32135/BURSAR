import { extractedOf, type Invoice } from '@/lib/api'
import { usd } from '@/lib/cn'

/** Facsimile from extracted fields. Original PDF bytes stay encrypted on 0G Storage. */
export function InvoicePaper({ inv }: { inv: Invoice }) {
  const ex = extractedOf(inv)
  return (
    <article className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Extracted facsimile, not the stored PDF</p>
      <h3 className="font-display mt-3 text-2xl font-bold">{ex.vendor_name || inv.vendor || 'Vendor'}</h3>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Invoice</dt>
          <dd className="mt-1 font-medium">{ex.invoice_number || '-'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Due</dt>
          <dd className="mt-1">{ex.due_date || '-'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Amount</dt>
          <dd className="font-display mt-1 text-3xl font-bold">{ex.total_usd || usd(inv.amount_units)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Pay USDC.e to</dt>
          <dd className="mt-1 break-all font-mono text-xs">{inv.remittance || ex.remittance_usdc_e || '-'}</dd>
        </div>
      </dl>
    </article>
  )
}
