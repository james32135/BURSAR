import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { api } from '@/lib/api'
import { addrUrl, shortHash, txUrl } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { MagneticButton } from '@/components/MagneticButton'

export function Verify() {
  const { id } = useParams()
  const [lookup, setLookup] = useState(id || LIVE.proofs[0].tx)
  const [active, setActive] = useState(id || LIVE.proofs[0].tx)
  const q = useQuery({ queryKey: ['verify', active], queryFn: () => api.verify(active), enabled: !!active })
  const ident = useQuery({ queryKey: ['identity'], queryFn: api.identity })
  const v = q.data
  const ok = v?.status === 'VERIFIED'
  const sup = ident.data?.supportsInterface || v?.identity?.supportsInterface || {}

  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-6">
        <Link to="/" className="font-display text-lg font-bold">
          BURSAR
        </Link>
        <MagneticButton href="/app" className="h-9 bg-white px-3 text-xs text-[#09090b]">
          Open console
        </MagneticButton>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">No wallet required</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">Verify from chain.</h1>
        <p className="mt-3 max-w-xl text-[#a1a1aa]">
          Paid + USDC.e Transfer + Go merkle proof. ERC-7857 supportsInterface is a live eth_call. processResponse is
          EIP-191 recovery — not a hardware TEE quote. Settlement is vault USDC.e, not 0G Pay.
        </p>
        <form
          className="mt-8 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setActive(lookup.trim())
          }}
        >
          <input
            className="min-w-[240px] flex-1 rounded-[4px] border border-white/10 bg-[#111113] px-3 py-2 font-mono text-xs"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            aria-label="Transaction or invoice hash"
          />
          <MagneticButton type="submit" variant="seal">
            Verify on 0G
          </MagneticButton>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {LIVE.proofs.map((p) => (
            <button
              key={p.tx}
              type="button"
              className="rounded-[4px] border border-white/10 px-3 py-1 font-mono text-[10px]"
              onClick={() => {
                setLookup(p.tx)
                setActive(p.tx)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <section className="mt-10 rounded-[4px] border border-white/10 p-6">
          <h2 className="font-display text-xl font-bold">Clerk identity (ERC-7857)</h2>
          <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
            <dt className="text-[#71717a]">Contract</dt>
            <dd className="font-mono text-xs">
              {ident.data?.address ? (
                <a className="text-[#93c5fd]" href={addrUrl(ident.data.address)}>
                  {ident.data.address}
                </a>
              ) : (
                'not configured'
              )}
            </dd>
            <dt className="text-[#71717a]">standards-verifiable</dt>
            <dd>{ident.data?.standardsVerifiable ? 'true' : 'false'}</dd>
            {Object.entries(sup).map(([k, val]) => (
              <span key={k} className="contents">
                <dt className="text-[#71717a]">{k}</dt>
                <dd className="font-mono text-xs">{String(val)}</dd>
              </span>
            ))}
            <dt className="text-[#71717a]">iTransfer</dt>
            <dd className="text-[#a1a1aa]">{ident.data?.iTransfer || 'disabled until mainnet TEE attestor'}</dd>
          </dl>
        </section>
        <section className="mt-8">
          {q.isFetching && <p className="font-mono text-sm">Reconstructing from chain + Storage</p>}
          {v && (
            <div className={`rounded-[4px] border p-6 ${ok ? 'border-emerald-500/40' : 'border-white/10'}`}>
              <p className="font-display text-3xl font-bold">{v.status}</p>
              {v.reason && <p className="mt-2 text-sm text-amber-200">{v.reason}</p>}
              <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
                <dt className="text-[#71717a]">Amount</dt>
                <dd>{v.amount}</dd>
                <dt className="text-[#71717a]">Vendor</dt>
                <dd className="break-all font-mono text-xs">{v.vendor}</dd>
                <dt className="text-[#71717a]">Vault</dt>
                <dd className="break-all font-mono text-xs">{v.vault}</dd>
                <dt className="text-[#71717a]">AI signer</dt>
                <dd className="break-all font-mono text-xs">{v.recoveredSigner}</dd>
                <dt className="text-[#71717a]">Go proof</dt>
                <dd>{v.goProof?.ok ? 'Succeeded to validate the downloaded file' : 'failed or missing'}</dd>
              </dl>
              {v.txHash && (
                <a className="mt-4 inline-block text-sm text-[#93c5fd] underline" href={txUrl(v.txHash)}>
                  Open ChainScan {shortHash(v.txHash, 8)}
                </a>
              )}
            </div>
          )}
        </section>
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Proof deck</h2>
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {LIVE.deck.map((row) => (
              <li key={row.feature} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                <span className="text-sm">{row.feature}</span>
                {row.href ? (
                  <a className="font-mono text-xs text-[#93c5fd]" href={row.href}>
                    {row.proof}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-[#a1a1aa]">{row.proof}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
