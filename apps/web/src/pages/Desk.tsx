import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { LIVE } from '@/lib/live'
import { addrUrl, shortHash, storageUrl, txUrl, usd } from '@/lib/cn'
import { MarketingHeader } from '@/components/MarketingHeader'
import { PipelineStrip } from '@/components/PipelineStrip'

function Card({
  title,
  id,
  kind,
}: {
  title: string
  id: string
  kind: 'paid' | 'blocked'
}) {
  const q = useQuery({ queryKey: ['verify', id], queryFn: () => api.verify(id) })
  const v = q.data
  const paid = kind === 'paid'
  const ok = v?.status === 'VERIFIED'
  return (
    <article className={`rounded-[4px] border p-6 ${paid ? 'border-emerald-500/40 bg-[#111113]' : 'border-red-500/35 bg-[#111113]'}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#71717a]">{title}</p>
      <p className="font-display mt-2 text-3xl font-bold">{q.isFetching ? '…' : v?.status || (paid ? 'VERIFIED' : 'BLOCKED')}</p>
      <p className="mt-2 text-sm text-[#a1a1aa]">{paid ? LIVE.featured.paid.note : LIVE.featured.blocked.note}</p>
      <dl className="mt-5 grid gap-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#71717a]">USDC.e</dt>
          <dd>{v?.amount ? usd(v.amount) : paid ? '0.001' : '0.00'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#71717a]">Money moved</dt>
          <dd>{paid && ok ? 'yes' : 'no'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#71717a]">Go proof</dt>
          <dd>{v?.goProof?.ok ? 'file validated' : paid ? 'pending' : 'no pay tx'}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3 text-xs">
        {paid ? (
          <a className="text-[#93c5fd] underline" href={txUrl(LIVE.featured.paid.tx)}>
            ChainScan {shortHash(LIVE.featured.paid.tx, 6)}
          </a>
        ) : (
          <Link className="text-[#93c5fd] underline" to={'/verify/' + LIVE.featured.blocked.invoice}>
            Open /verify
          </Link>
        )}
        <a className="text-[#93c5fd] underline" href={storageUrl(paid ? LIVE.featured.paid.storageRoot : LIVE.featured.blocked.storageRoot)}>
          Storage root
        </a>
      </div>
    </article>
  )
}

export function Desk() {
  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">90 second desk. No wallet.</p>
        <h1 className="font-display mt-2 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          One payable paid. One splice blocked.
        </h1>
        <p className="mt-4 max-w-xl text-[#a1a1aa]">
          Same invoice number. Different amount. The vault paid the real bill and refused the fake. Reconstruct both from chain and 0G Storage.
        </p>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Card title="Allow" id={LIVE.featured.paid.tx} kind="paid" />
          <Card title="Block" id={LIVE.featured.blocked.invoice} kind="blocked" />
        </div>
        <section className="mt-14 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold">Allow path</h2>
            <PipelineStrip
              pipeline="verified"
              events={['received', 'stored', 'analyzing', 'checking_vendor', 'checking_policy', 'ready', 'paying', 'confirmed', 'verified'].map((kind) => ({ kind }))}
            />
            <p className="mt-3 text-sm text-[#a1a1aa]">Money moved. Public /verify is VERIFIED.</p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">Block path</h2>
            <PipelineStrip
              pipeline="blocked"
              events={['received', 'stored', 'analyzing', 'checking_vendor', 'checking_policy', 'blocked'].map((kind) => ({ kind }))}
            />
            <p className="mt-3 text-sm text-[#a1a1aa]">Same number, bigger amount. Session pay 400. $0 moved.</p>
          </div>
        </section>
        <section className="mt-12 grid gap-3 md:grid-cols-4">
          {[
            { t: 'Chain 16661', d: 'BursarVault USDC.e transfer. Paid event.', href: addrUrl(LIVE.ownerVault) },
            { t: 'Compute', d: `Direct ${LIVE.model}. EIP-191 signer recovery.`, href: LIVE.compute },
            { t: 'Storage', d: 'Encrypted invoice + Go proof.', href: storageUrl(LIVE.featured.paid.storageRoot) },
            { t: 'Agentic ID', d: 'Production ERC-7857 clerk identity.', href: addrUrl(LIVE.agentId) },
          ].map((s) => (
            <a key={s.t} href={s.href} className="rounded-[4px] border border-white/10 p-5 hover:border-white/25">
              <h3 className="font-display text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-[#a1a1aa]">{s.d}</p>
            </a>
          ))}
        </section>
        <p className="mt-10 text-sm text-[#a1a1aa]">
          0G Pay is not claimed. Hardware TEE quote is not on the payment path. Email intake is not live.
        </p>
      </main>
    </div>
  )
}
