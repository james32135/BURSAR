import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { txUrl, usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { MagneticButton } from '@/components/MagneticButton'
import { PageHeader } from '@/components/Product'
import { ProofTrail } from '@/components/ProofTrail'
import { useState } from 'react'
import { motion } from 'motion/react'

export function Proof() {
  const { id } = useParams()
  const [lookup, setLookup] = useState(id || LIVE.proofs[0].tx)
  const [active, setActive] = useState(id || LIVE.proofs[0].tx)
  const q = useQuery({ queryKey: ['verify', active], queryFn: () => api.verify(active), enabled: !!active })
  const v = q.data
  const ok = v?.status === 'VERIFIED'

  return (
    <div>
      <PageHeader
        title="Verify from chain."
        body="Not a screenshot. /verify reconstructs Paid + USDC.e Transfer + Go merkle proof from the paying vault. The recovered AI signer is processResponse EIP-191 recovery — not a hardware TEE quote."
      />
      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setActive(lookup.trim())
        }}
      >
        <input
          className="min-w-[240px] flex-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--fg)]"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          aria-label="Transaction or invoice hash"
        />
        <MagneticButton type="submit" variant="seal">Verify on 0G</MagneticButton>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {LIVE.proofs.filter((p) => 'invoice' in p).map((p) => (
          <button
            key={p.tx}
            type="button"
            className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-mono text-[10px]"
            onClick={() => {
              setLookup(p.tx)
              setActive(p.tx)
            }}
          >
            DEMO {p.label}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {q.isFetching && <p className="font-mono text-sm">Reconstructing from chain + Storage</p>}
        {v && (
          <motion.div
            key={active + String(v.status)}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-[4px] border bg-[var(--surface)] p-6 ${ok ? 'border-emerald-500/40' : 'border-[var(--border)]'}`}
          >
            <p className="font-display text-3xl font-bold">{v.status}</p>
            {v.reason && <p className="mt-2 text-sm text-amber-200">{v.reason}</p>}
            <dl className="mt-4 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-[var(--fg-muted)]">Payable</dt><dd className="break-all font-mono text-xs">{v.invoiceHash || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Amount</dt><dd>{v.amount ? usd(v.amount) : '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Vendor</dt><dd className="break-all font-mono text-xs">{v.vendor}</dd>
              <dt className="text-[var(--fg-muted)]">Artifact hash</dt><dd className="break-all font-mono text-xs">{v.invoiceHash || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Storage root</dt><dd className="break-all font-mono text-xs">{v.storageRoot}</dd>
              <dt className="text-[var(--fg-muted)]">Payment tx</dt><dd className="break-all font-mono text-xs">{v.txHash || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">USDC.e transfer</dt><dd className="break-all font-mono text-xs">{v.usdcTransfer ? `${v.usdcTransfer.from} → ${v.usdcTransfer.to} ${usd(v.usdcTransfer.value)}` : '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Vault</dt><dd className="break-all font-mono text-xs">{v.vault || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Session</dt><dd className="break-all font-mono text-xs">{v.sessionId || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">Policy version</dt><dd className="font-mono text-xs">{v.policyVersion || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">AI signer</dt><dd className="break-all font-mono text-xs">{v.recoveredSigner || '-'}</dd>
              <dt className="text-[var(--fg-muted)]">processResponse</dt><dd>{v.attestation || 'EIP-191 signer recovery'}</dd>
              <dt className="text-[var(--fg-muted)]">Hardware TEE quote</dt><dd>Not on this payment path</dd>
              <dt className="text-[var(--fg-muted)]">Go proof</dt><dd>{v.goProof?.ok ? 'Succeeded to validate the downloaded file' : 'failed or missing'}</dd>
            </dl>
            {(v.explorer || v.txHash) && (
              <a className="mt-4 inline-block text-sm text-[#93c5fd] underline" href={v.txHash ? txUrl(v.txHash) : v.explorer}>
                Open ChainScan
              </a>
            )}
            <div className="mt-6">
              <ProofTrail
                steps={[
                  { label: 'Invoice', detail: v.invoiceHash || '-', done: Boolean(v.invoiceHash) },
                  { label: 'Encrypted Storage', detail: v.storageRoot || '-', done: Boolean(v.storageRoot) },
                  { label: 'Private AI', detail: v.recoveredSigner || '-', done: Boolean(v.recoveredSigner) },
                  { label: 'Decision', detail: v.status, done: Boolean(v.status) },
                  { label: 'Policy', detail: 'on-chain Paid event', done: ok },
                  { label: 'Payment', detail: v.txHash || '-', href: v.txHash ? txUrl(v.txHash) : undefined, done: Boolean(v.txHash) },
                  { label: 'ChainScan', href: v.txHash ? txUrl(v.txHash) : undefined, done: Boolean(v.txHash) },
                  { label: 'Verified', detail: v.goProof?.ok ? 'Go proof ok' : 'Go proof missing', done: ok },
                ]}
              />
            </div>
            <pre className="mt-6 overflow-auto font-mono text-[11px] text-[#a1a1aa]">{JSON.stringify(v, null, 2)}</pre>
          </motion.div>
        )}
      </div>
    </div>
  )
}
