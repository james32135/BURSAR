import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api, flagsOf, hashOf, type Invoice } from '@/lib/api'
import { usd } from '@/lib/cn'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge, PageHeader } from '@/components/Product'

export function Inbox() {
  const nav = useNavigate()
  const queue = useQuery({ queryKey: ['queue'], queryFn: api.queue })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const rows = useMemo(() => {
    let list = [...(queue.data?.invoices || [])]
    if (status !== 'all') list = list.filter((i) => i.status === status)
    if (q) {
      const n = q.toLowerCase()
      list = list.filter((i) =>
        [hashOf(i), i.vendor, i.remittance, flagsOf(i)[0]?.code].join(' ').toLowerCase().includes(n)
      )
    }
    return list
  }, [queue.data, q, status])

  async function onFile(file?: File) {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const out = await api.submit(file)
      nav('/app/inbox/' + (out.invoiceHash || out.invoice_hash))
    } catch (e) {
      const body = (e as { body?: { duplicate?: boolean; invoiceHash?: string; status?: string } }).body
      if (body?.duplicate && body.invoiceHash) {
        setErr(`Duplicate ${body.status}. Opening existing invoice.`)
        nav('/app/inbox/' + body.invoiceHash)
      } else setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Invoice feed"
        body="Real PDFs only. Encrypted to 0G Storage, read in Direct TeeML. No wallet prompt."
        extra={<AuthorityBadge kind="agent" />}
      />
      <label
        className={`mt-6 flex cursor-pointer flex-col items-center rounded-[4px] border border-dashed px-6 py-12 transition-colors ${over ? 'border-[#2563eb] bg-[#2563eb]/10' : 'border-[var(--border)] bg-[var(--surface)]'}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          onFile(e.dataTransfer.files?.[0])
        }}
      >
        <span className="font-medium">{busy ? 'Working: Storage proof + Direct TeeML' : 'Drop a vendor invoice PDF'}</span>
        <span className="mt-2 text-sm text-[var(--fg-muted)]">or choose a file. No mock records.</span>
        <input
          type="file"
          accept="application/pdf"
          className="mt-4 text-sm"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {err && <p className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-300">{err}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vendor, hash, remittance"
          aria-label="Search invoices"
          className="h-9 min-w-[220px] flex-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--fg)]"
        />
        {['all', 'clean', 'flagged', 'blocked', 'paid'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-[4px] border px-3 py-1 text-xs uppercase ${status === s ? 'border-white bg-white text-[#09090b]' : 'border-[var(--border)] text-[var(--fg-muted)]'}`}
          >
            {s === 'clean' ? 'auto-pay' : s}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {rows.map((inv: Invoice) => (
          <li key={hashOf(inv)}>
            <Link to={'/app/inbox/' + hashOf(inv)} className="flex flex-wrap items-center justify-between gap-2 py-4 hover:bg-white/5">
              <span className="font-mono text-xs">{hashOf(inv).slice(0, 14)}...</span>
              <span>{inv.vendor || '-'}</span>
              <span>{usd(inv.amount_units)}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={inv.status} />
                <span className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{flagsOf(inv)[0]?.code || ''}</span>
              </span>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="py-6 text-sm text-[var(--fg-muted)]">Inbox is empty. Submit a PDF.</li>}
      </ul>
    </div>
  )
}
