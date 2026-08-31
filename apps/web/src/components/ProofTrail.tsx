import { Link } from 'react-router-dom'
import { txUrl } from '@/lib/cn'

export type TrailStep = {
  label: string
  detail?: string
  href?: string
  to?: string
  done: boolean
}

export function ProofTrail({ steps }: { steps: TrailStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-4">
          <div className="flex flex-col items-center">
            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${s.done ? 'bg-[#16a34a]' : 'bg-[#d4d4d8]'}`} />
            {i < steps.length - 1 && <span className="w-px flex-1 bg-[var(--border)]" />}
          </div>
          <div className="pb-5">
            <div className="text-sm font-medium">{s.label}</div>
            {s.detail && <p className="mt-0.5 break-all font-mono text-[11px] text-[var(--fg-muted)]">{s.detail}</p>}
            {s.href && (
              <a className="mt-1 inline-block text-xs text-[#2563eb] underline" href={s.href} target="_blank" rel="noreferrer">
                Open
              </a>
            )}
            {s.to && (
              <Link className="mt-1 ml-2 inline-block text-xs text-[#2563eb] underline" to={s.to}>
                Verify on 0G
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function invoiceTrail(inv: {
  invoice_hash?: string
  invoiceHash?: string
  storage_root?: string | null
  recovered_signer?: string | null
  status?: string
  flags?: unknown
  pay_tx?: string | null
  go_proof_ok?: boolean
  attestation_ok?: boolean
}): TrailStep[] {
  const hash = inv.invoiceHash || inv.invoice_hash || ''
  return [
    { label: 'Untrusted payable', detail: hash || '-', done: Boolean(hash) },
    { label: 'Private 0G intelligence', detail: inv.recovered_signer || 'Direct TeeML', done: Boolean(inv.attestation_ok || inv.recovered_signer) },
    { label: 'Memory', detail: Array.isArray(inv.flags) && (inv.flags as { code?: string }[]).some((f) => f.code) ? 'flags recorded' : 'no memory flags', done: true },
    { label: 'Policy', detail: inv.status || '-', done: Boolean(inv.status) },
    { label: 'Bounded money', detail: inv.pay_tx || '$0 moved', href: inv.pay_tx ? txUrl(inv.pay_tx) : undefined, done: Boolean(inv.pay_tx) },
    { label: 'Proof', detail: inv.go_proof_ok ? 'Go proof on file' : 'open Proof to reconstruct', to: inv.pay_tx ? '/app/proof/' + inv.pay_tx : undefined, done: Boolean(inv.pay_tx && inv.go_proof_ok) },
  ]
}
