import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api, flagsOf, hashOf, type Invoice } from '@/lib/api'
import { usd } from '@/lib/cn'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { SourceChannels } from '@/components/SourceChannels'

const KINDS = ['invoice', 'contractor', 'vendor-payment', 'subscription', 'api-bill', 'agent-expense', 'recurring', 'request']

export function Inbox() {
  const nav = useNavigate()
  const queue = useQuery({
    queryKey: ['queue'],
    queryFn: api.queue,
    refetchInterval: (q) =>
      (q.state.data?.invoices || []).some((i) => i.pipeline === 'queued' || i.status === 'received' || i.pipeline === 'analyzing')
        ? 2500
        : 12_000,
  })
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
        [hashOf(i), i.vendor, i.remittance, i.source, i.kind, flagsOf(i)[0]?.code].join(' ').toLowerCase().includes(n)
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
        setErr(`Duplicate ${body.status}. Opening existing payable.`)
        nav('/app/inbox/' + body.invoiceHash)
      } else setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        body="Give BURSAR a financial task. PDF, API, MCP, SDK, and Telegram all become the same payable. Email intake is coming later."
        extra={<AuthorityBadge kind="agent" />}
      />
      <SourceChannels />
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
        <span className="font-medium">{busy ? 'Received — private analysis queued' : 'Upload this document'}</span>
        <span className="mt-2 text-sm text-[var(--fg-muted)]">PDF adapter only. Pipeline is real backend state, not a spinner.</span>
        <input
          type="file"
          accept="application/pdf"
          className="mt-4 text-sm"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {err && <p className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-300">{err}</p>}
      <PayableRequest onDone={(hash) => nav('/app/inbox/' + hash)} />
      <div className="mt-6 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vendor, hash, remittance, source"
          aria-label="Search payables"
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
              <span className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{inv.source || 'pdf'} · {inv.kind || 'invoice'}</span>
              <span>{inv.vendor || '-'}</span>
              <span>{usd(inv.amount_units)}</span>
              <span className="max-w-[160px] truncate font-mono text-[10px]">{inv.remittance || '-'}</span>
              <span className="flex items-center gap-2">
                <StatusChip status={inv.status} />
                <span className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">{inv.nextAction || flagsOf(inv)[0]?.code || ''}</span>
              </span>
            </Link>
          </li>
        ))}
        {!rows.length && <li className="py-6 text-sm text-[var(--fg-muted)]">No payables. Upload a document, submit a request, or send one from Telegram.</li>}
      </ul>
    </div>
  )
}

function PayableRequest({ onDone }: { onDone: (hash: string) => void }) {
  const [vendor, setVendor] = useState('Northwind Compute Ltd')
  const [amountUsd, setAmountUsd] = useState('0.001')
  const [remittance, setRemittance] = useState('0x1111111111111111111111111111111111111111')
  const [invoiceNumber, setInvoiceNumber] = useState(() => `NW-0G-${Date.now()}`)
  const [kind, setKind] = useState('request')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const cadence = kind === 'subscription' || kind === 'recurring' || kind === 'api-bill' ? 'monthly' : undefined
      const out = await api.submitPayable({ vendor, remittance, amountUsd, invoiceNumber, kind, cadence })
      onDone(out.invoiceHash || out.invoice_hash)
    } catch (e) {
      const body = (e as { body?: { duplicate?: boolean; invoiceHash?: string; error?: string; detail?: string } }).body
      if (body?.duplicate && body.invoiceHash) onDone(body.invoiceHash)
      else setErr(body?.detail || (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-6">
      <p className="md:col-span-6 font-mono text-[10px] uppercase text-[var(--fg-muted)]">
        Payment request (API adapter). Same payable engine as PDF. Rail: USDC.e on 0G Aristotle 16661. Bank wire / ACH / BTC / ETH are rejected.
      </p>
      <input value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Vendor" className="h-9 rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 text-sm" />
      <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} aria-label="Payable number" className="h-9 rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 text-sm" />
      <input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} aria-label="Amount USD" className="h-9 rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 text-sm" />
      <input value={remittance} onChange={(e) => setRemittance(e.target.value)} aria-label="Remittance" className="h-9 rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 font-mono text-xs" />
      <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Payable type" className="h-9 rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 text-sm">
        {KINDS.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <button type="submit" disabled={busy} className="h-9 rounded-[4px] bg-white text-sm font-medium text-[#09090b] disabled:opacity-40">
        {busy ? 'Received' : 'Submit payable'}
      </button>
      {err && <p className="md:col-span-6 text-sm text-red-300">{err}</p>}
    </form>
  )
}
