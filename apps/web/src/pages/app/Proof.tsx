import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { addrUrl, txUrl, usd, storageUrl } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { MagneticButton } from '@/components/MagneticButton'
import { PageHeader } from '@/components/Product'
import { ProofTrail } from '@/components/ProofTrail'
import { ProofOfDecision } from '@/components/ProofOfDecision'
import { useState } from 'react'
import { motion } from 'motion/react'

export function Proof() {
  const { id } = useParams()
  const [lookup, setLookup] = useState(id || LIVE.featured.paid.tx)
  const [active, setActive] = useState(id || LIVE.featured.paid.tx)
  const q = useQuery({ queryKey: ['verify', active], queryFn: () => api.verify(active), enabled: !!active })
  const ident = useQuery({ queryKey: ['identity'], queryFn: api.identity })
  const v = q.data
  const ok = v?.status === 'VERIFIED'
  const sup = ident.data?.supportsInterface || {}

  return (
    <div>
      <PageHeader
        title="Proof of decision on 0G."
        body="What was received, privately computed, checked in memory, allowed by policy, and whether money moved. VERIFIED only when Paid + USDC.e Transfer + Go merkle proof agree. Prompts and keys stay off this page."
        extra={
          <Link to="/verify" className="font-mono text-xs text-[#93c5fd] underline">
            Public /verify
          </Link>
        }
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
        <button
          type="button"
          className="rounded-[4px] border border-emerald-500/40 px-3 py-1 font-mono text-[10px] uppercase text-emerald-300"
          onClick={() => {
            setLookup(LIVE.featured.paid.tx)
            setActive(LIVE.featured.paid.tx)
          }}
        >
          Paid
        </button>
        <button
          type="button"
          className="rounded-[4px] border border-red-500/35 px-3 py-1 font-mono text-[10px] uppercase text-red-300"
          onClick={() => {
            setLookup(LIVE.featured.blocked.invoice)
            setActive(LIVE.featured.blocked.invoice)
          }}
        >
          Splice blocked
        </button>
        {LIVE.proofs.filter((p) => 'invoice' in p && p.tx !== LIVE.featured.paid.tx && p.tx !== LIVE.featured.blocked.tx).slice(0, 4).map((p) => (
          <button
            key={p.tx}
            type="button"
            className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-mono text-[10px]"
            onClick={() => {
              setLookup(p.tx)
              setActive(p.tx)
            }}
          >
            {p.label}
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
              <dt className="text-[var(--fg-muted)]">Storage root</dt>
              <dd className="break-all font-mono text-xs">
                {v.storageRoot ? (
                  <a className="text-[#93c5fd]" href={v.storageScan || storageUrl(v.storageRoot)}>
                    {v.storageRoot}
                  </a>
                ) : (
                  '-'
                )}
              </dd>
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
              <ProofOfDecision v={v} />
              <ProofTrail
                steps={[
                  { label: 'Untrusted payable', detail: v.invoiceHash || '-', done: Boolean(v.invoiceHash) },
                  { label: 'Private 0G intelligence', detail: v.recoveredSigner || v.decision?.computed?.recoveredSigner || '-', done: Boolean(v.recoveredSigner || v.decision?.computed?.recoveredSigner) },
                  { label: 'Memory', detail: v.decision?.memory?.length ? v.decision.memory.map((m: { code: string }) => m.code).join(', ') : 'no memory flags', done: true },
                  { label: 'Policy', detail: `${v.decision?.policy?.decision || v.status} → ${v.nextAction || v.decision?.policy?.nextAction || '-'}`, done: Boolean(v.status) },
                  { label: 'Bounded money', detail: v.txHash || '$0 moved', href: v.txHash ? txUrl(v.txHash) : undefined, done: Boolean(v.didMoneyMove) },
                  { label: 'Proof', detail: v.goProof?.ok ? 'Go proof ok' : 'Go proof missing', done: ok },
                ]}
              />
            </div>
            <pre className="mt-6 overflow-auto font-mono text-[11px] text-[#a1a1aa]">{JSON.stringify(v, null, 2)}</pre>
          </motion.div>
        )}
      </div>
      <section className="mt-10 rounded-[4px] border border-[var(--border)] p-6">
        <h2 className="font-display text-xl font-bold">Clerk identity</h2>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          Production ERC-7857 IDs 0x2afbede9 / 0xdf597d99 / 0x74f8628b. iTransfer reverts until a mainnet TEE attestor exists.
          This is identity, not settlement.
        </p>
        <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">Contract</dt>
          <dd className="font-mono text-xs">
            {ident.data?.address ? (
              <a className="text-[#93c5fd]" href={addrUrl(ident.data.address)}>
                {ident.data.address}
              </a>
            ) : (
              'not configured'
            )}
          </dd>
          <dt className="text-[var(--fg-muted)]">standards-verifiable</dt>
          <dd>{ident.data?.standardsVerifiable ? 'true' : 'false'}</dd>
          {Object.entries(sup).map(([k, val]) => (
            <span key={k} className="contents">
              <dt className="text-[var(--fg-muted)]">{k}</dt>
              <dd className="font-mono text-xs">{String(val)}</dd>
            </span>
          ))}
        </dl>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Proof deck</h2>
        <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {LIVE.deck.map((row) => (
            <li key={row.feature} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
              <span className="text-sm">{row.feature}</span>
              {row.href ? (
                <a className="font-mono text-xs text-[#93c5fd]" href={row.href}>
                  {row.proof}
                </a>
              ) : (
                <span className="font-mono text-xs text-[var(--fg-muted)]">{row.proof}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
