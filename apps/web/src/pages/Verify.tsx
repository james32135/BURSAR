import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { api } from '@/lib/api'
import { addrUrl, shortHash, storageUrl, txUrl, usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { MagneticButton } from '@/components/MagneticButton'
import { MarketingHeader } from '@/components/MarketingHeader'

const ID_ROWS = [
  { label: 'IERC7857', key: 'IERC7857' as const, id: LIVE.production7857.IERC7857 },
  { label: 'Authorize', key: 'IERC7857Authorize' as const, id: LIVE.production7857.IERC7857Authorize },
  { label: 'Cloneable', key: 'IERC7857Cloneable' as const, id: LIVE.production7857.IERC7857Cloneable },
]

export function Verify() {
  const { id } = useParams()
  const fallback = LIVE.featured.paid.tx
  const [lookup, setLookup] = useState(id || fallback)
  const [active, setActive] = useState(id || fallback)
  const q = useQuery({ queryKey: ['verify', active], queryFn: () => api.verify(active), enabled: !!active })
  const ident = useQuery({ queryKey: ['identity'], queryFn: api.identity })
  const v = q.data
  const ok = v?.status === 'VERIFIED'
  const blocked = v?.status === 'BLOCKED'
  const sup = ident.data?.supportsInterface || v?.identity?.supportsInterface || {}
  const root = v?.storageRoot || v?.invoice?.storageRoot || v?.chainPayment?.storageRoot

  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">No wallet required</p>
        <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">Verify from chain and Storage.</h1>
        <p className="mt-3 max-w-xl text-[#a1a1aa]">
          Paid + USDC.e Transfer + Go merkle proof. ERC-7857 is a live eth_call. processResponse is EIP-191, not a hardware quote. Settlement is vault USDC.e, not 0G Pay.
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
          {LIVE.proofs.slice(2, 6).map((p) => (
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
          <p className="mt-2 text-sm text-[#a1a1aa]">
            Production IDs from 0g-agentic-id. Identity, not vendor settlement. iTransfer reverts until a mainnet TEE attestor exists.
          </p>
          <p className="mt-3 font-mono text-xs">
            {ident.data?.address ? (
              <a className="text-[#93c5fd]" href={addrUrl(ident.data.address)}>
                {ident.data.address}
              </a>
            ) : (
              'not configured'
            )}
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <tbody>
              {ID_ROWS.map((row) => {
                const shown = Boolean(sup[row.key])
                return (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-2 pr-3">{row.label}</td>
                    <td className="py-2 font-mono text-xs text-[#a1a1aa]">{row.id}</td>
                    <td className={`py-2 font-mono text-xs ${shown ? 'text-emerald-300' : 'text-red-300'}`}>{String(shown)}</td>
                  </tr>
                )
              })}
              <tr className="border-t border-white/10">
                <td className="py-2 pr-3">Control (must be false)</td>
                <td className="py-2 font-mono text-xs text-[#a1a1aa]">{LIVE.production7857.controlFalse}</td>
                <td className="py-2 font-mono text-xs text-red-300">false</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          {q.isFetching && <p className="font-mono text-sm">Reconstructing from chain + Storage</p>}
          {v && (
            <div className={`rounded-[4px] border p-6 ${ok ? 'border-emerald-500/40' : blocked ? 'border-red-500/35' : 'border-white/10'}`}>
              <p className="font-display text-3xl font-bold">{v.status}</p>
              {v.reason && <p className="mt-2 text-sm text-amber-200">{v.reason}</p>}
              {blocked && <p className="mt-2 text-sm text-[#a1a1aa]">{LIVE.featured.blocked.note}</p>}
              <dl className="mt-4 grid grid-cols-[160px_1fr] gap-y-2 text-sm">
                <dt className="text-[#71717a]">Amount</dt>
                <dd>{v.amount ? usd(v.amount) : blocked ? '0.00 USDC.e' : '-'}</dd>
                <dt className="text-[#71717a]">Vendor</dt>
                <dd className="break-all font-mono text-xs">{v.vendor || '-'}</dd>
                <dt className="text-[#71717a]">Vault</dt>
                <dd className="break-all font-mono text-xs">{v.vault || LIVE.ownerVault}</dd>
                <dt className="text-[#71717a]">AI signer</dt>
                <dd className="break-all font-mono text-xs">{v.recoveredSigner || '-'}</dd>
                <dt className="text-[#71717a]">Go proof</dt>
                <dd>{v.goProof?.ok ? 'Succeeded to validate the downloaded file' : blocked ? 'no pay tx' : 'failed or missing'}</dd>
                <dt className="text-[#71717a]">Storage root</dt>
                <dd className="break-all font-mono text-xs">
                  {root ? (
                    <a className="text-[#93c5fd]" href={v.storageScan || storageUrl(root)}>
                      {root}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
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
