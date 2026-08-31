import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { MagneticButton } from '@/components/MagneticButton'
import { MarketingHeader } from '@/components/MarketingHeader'
import { SmoothScroll } from '@/components/SmoothScroll'
import { HeroDesk } from '@/components/HeroDesk'
import { LIVE } from '@/lib/live'
import { api } from '@/lib/api'
import { addrUrl, shortHash, storageUrl, txUrl } from '@/lib/cn'
import { TelegramMark } from '@/components/TelegramMark'

gsap.registerPlugin(ScrollTrigger)

const STACK = [
  {
    t: '0G Chain',
    d: 'Policy, isolated BursarVault, Band 0 session pay, DuplicateInvoice revert, immutable Paid evidence. Without chain, money is not settled on 0G.',
    href: addrUrl(LIVE.ownerVault),
    proof: shortHash(LIVE.ownerVault, 4),
  },
  {
    t: '0G Compute',
    d: `Private invoice reasoning. Direct TeeML ${LIVE.model}. processResponse recovers signer ${shortHash(LIVE.teeSigner, 4)} via EIP-191. Prompts never leave the clerk.`,
    href: LIVE.compute,
    proof: LIVE.model,
  },
  {
    t: '0G Storage',
    d: 'Encrypted source artifact plus verifiable Merkle evidence. Go client must print Succeeded or /verify is not VERIFIED.',
    href: storageUrl(LIVE.featured.paid.storageRoot),
    proof: shortHash(LIVE.featured.paid.storageRoot, 4),
  },
  {
    t: 'ERC-7857',
    d: 'On-chain clerk identity. Production IERC7857 0x2afbede9. Identity only. Settlement is vault USDC.e.',
    href: addrUrl(LIVE.agentId),
    proof: shortHash(LIVE.agentId, 4),
  },
]

const FLOW = [
  { t: 'Untrusted payable', d: 'PDF, API, MCP, SDK, or Telegram. Same hash. Email is not live.' },
  { t: 'Private 0G intelligence', d: 'Encrypted Storage. Go merkle. Direct TeeML vision. EIP-191 signer recovery.' },
  { t: 'Memory', d: 'Recipient history, amount bands, frequency, prior hashes, obligations, recipient changes.' },
  { t: 'Policy', d: 'Band 0 session. Band 1 owner. Duplicate and splice block. Agent cannot own the vault.' },
  { t: 'Bounded money', d: 'BursarVault USDC.e transfer or $0. Session cap $200. Fail closed.' },
  { t: 'Proof', d: 'Public /verify. Paid + Transfer + Go proof. Clerk ERC-7857. Prompts stay private.' },
]

function LiveProofCard({ kind }: { kind: 'paid' | 'blocked' }) {
  const featured = kind === 'paid' ? LIVE.featured.paid : LIVE.featured.blocked
  const id = kind === 'paid' ? featured.tx : featured.invoice
  const q = useQuery({ queryKey: ['verify', id], queryFn: () => api.verify(id) })
  const v = q.data
  const paid = kind === 'paid'
  const status = q.isFetching ? '…' : v?.status || (paid ? 'VERIFIED' : 'BLOCKED')
  return (
    <article className={`hero-reveal rounded-[4px] border p-6 ${paid ? 'border-emerald-500/40' : 'border-red-500/35'} bg-[#111113]`}>
      <p className={`font-mono text-[10px] uppercase tracking-[0.18em] ${paid ? 'text-emerald-300' : 'text-red-300'}`}>
        {paid ? 'Paid' : 'Blocked'} · {status}
      </p>
      <p className="font-display mt-2 text-2xl font-bold">
        {paid ? '0.001 USDC.e left the vault' : 'Same invoice. Amount spliced. $0.'}
      </p>
      <p className="mt-2 font-mono text-xs text-[#a1a1aa]">{shortHash(id, 8)}</p>
      <p className="mt-3 text-sm text-[#a1a1aa]">{v?.decision?.why?.[0] || featured.note}</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <Link className="text-[#93c5fd] underline" to={'/verify/' + id}>
          Open /verify
        </Link>
        {paid ? (
          <a className="text-[#93c5fd] underline" href={txUrl(featured.tx)}>
            ChainScan
          </a>
        ) : null}
        <a className="text-[#93c5fd] underline" href={storageUrl(featured.storageRoot)}>
          Storage root
        </a>
      </div>
    </article>
  )
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const pan = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-reveal', {
        y: 28,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
      })
      if (pan.current && track.current) {
        const distance = () => Math.max(0, track.current!.scrollWidth - window.innerWidth)
        gsap.to(track.current, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: pan.current,
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        })
      }
      const cards = gsap.utils.toArray<HTMLElement>('.stack-card')
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return
        ScrollTrigger.create({
          trigger: card,
          start: 'top top',
          endTrigger: cards[cards.length - 1],
          end: 'top top',
          pin: true,
          pinSpacing: false,
        })
        gsap.to(card, {
          scale: 0.94,
          opacity: 0.55,
          ease: 'none',
          scrollTrigger: {
            trigger: cards[i + 1],
            start: 'top bottom',
            end: 'top top',
            scrub: true,
          },
        })
      })
      gsap.from('.flow-step', {
        y: 36,
        opacity: 0,
        stagger: 0.08,
        duration: 0.55,
        ease: 'power3.out',
        scrollTrigger: { trigger: '#work', start: 'top 72%' },
      })
    }, root)
    return () => ctx.revert()
  }, [reduce])

  return (
    <SmoothScroll>
      <main ref={root} className="w-full max-w-full overflow-x-hidden bg-[#09090b] text-[#fafafa]">
        <div className="grain" aria-hidden />
        <MarketingHeader light />

        <section className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-[#f4f4f5] px-6 pb-12 pt-24 text-[#18181b] md:px-12">
            <p className="hero-reveal text-xs font-medium uppercase tracking-[0.22em] text-[#52525b]">
              AP clerk on 0G Aristotle 16661
            </p>
            <h1 className="hero-reveal font-display mt-3 max-w-xl text-[clamp(2.2rem,4vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">
              Invoice in. Fake blocked. USDC paid.
            </h1>
            <p className="hero-reveal mt-3 max-w-md font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-[#52525b]">
              Untrusted payable → Private 0G intelligence → Memory → Policy → Bounded money → Proof
            </p>
            <p className="hero-reveal mt-5 max-w-md text-base leading-relaxed text-[#52525b]">
              0G is the trust substrate. Compute reads privately. Storage keeps the artifact. Chain settles policy and money. ERC-7857 names the clerk. The agent never holds the key.
            </p>
            <a
              href={LIVE.telegram}
              target="_blank"
              rel="noreferrer"
              className="hero-reveal mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#18181b]"
            >
              <TelegramMark className="h-5 w-5" />
              <span>Telegram @BURSARxbot</span>
            </a>
            <div className="hero-reveal mt-8 flex flex-wrap gap-3">
              <Link
                to="/start"
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[#18181b] px-5 text-sm font-medium text-white"
              >
                Try the desk <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={'/verify/' + LIVE.featured.paid.tx}
                className="inline-flex h-11 items-center rounded-[4px] border border-[#18181b]/20 px-5 text-sm font-medium"
              >
                Verify paid tx
              </Link>
            </div>
            <p className="hero-reveal mt-4 max-w-md text-xs text-[#71717a]">
              Same as Get started. Owner wallet, resume or bind your vault, authorize the agent, then Open inbox. Not the shared DEMO vault.
            </p>
          </div>
          <div className="flex items-center justify-center bg-[#09090b] px-4 py-16 lg:min-h-[100dvh] lg:px-8">
            <HeroDesk className="hero-reveal w-full max-w-[min(92vw,560px)]" />
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#09090b] px-6 py-10 md:px-12">
          <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-2">
            <LiveProofCard kind="paid" />
            <LiveProofCard kind="blocked" />
          </div>
        </section>

        <section ref={pan} id="og" className="relative overflow-hidden bg-[#0c0c0e]">
          <div ref={track} className="flex h-[100dvh] min-w-full items-stretch">
            <div className="flex h-[100dvh] w-[min(100vw,420px)] shrink-0 flex-col justify-center px-8 md:px-14">
              <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">0G is the trust substrate, not a logo.</h2>
              <p className="mt-4 max-w-sm text-[#a1a1aa]">
                Each panel is live on Aristotle. Every module is necessary for the proof of decision.
              </p>
            </div>
            {STACK.map((s, i) => (
              <a
                key={s.t}
                href={s.href}
                className="flex h-[100dvh] w-[min(100vw,380px)] shrink-0 flex-col justify-center border-l border-white/10 px-8 md:px-12"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">{String(i + 1).padStart(2, '0')} / 04</p>
                <h3 className="font-display mt-3 text-3xl font-bold md:text-5xl">{s.t}</h3>
                <p className="mt-4 max-w-xs text-lg text-[#d4d4d8]">{s.d}</p>
                <span className="mt-6 font-mono text-xs text-[#93c5fd]">{s.proof} · live 16661</span>
              </a>
            ))}
            <div className="flex h-[100dvh] w-[min(100vw,380px)] shrink-0 flex-col justify-center border-l border-white/10 px-8 md:px-12">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">honest</p>
              <h3 className="font-display mt-3 text-3xl font-bold md:text-5xl">Not claimed</h3>
              <p className="mt-4 max-w-xs text-lg text-[#d4d4d8]">
                0G Pay docs 404. Hardware TEE quote is not on the pay path. Email mailbox is not live. DA is not used.
              </p>
            </div>
          </div>
        </section>

        <div className="relative">
          <section className="stack-card sticky top-0 flex min-h-[100dvh] items-center bg-[#09090b] px-6 py-24 md:px-12">
            <div className="mx-auto max-w-5xl">
              <h2 className="font-display max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
                Crypto teams paste vendor addresses into Discord. A fake invoice gets paid. USDC does not come back.
              </h2>
            </div>
          </section>
          <section className="stack-card sticky top-0 flex min-h-[100dvh] items-center bg-[#111113] px-6 py-24 md:px-12">
            <div className="mx-auto max-w-5xl">
              <h2 className="font-display max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
                Memory remembers. Policy decides. The vault pays. The agent never owns it.
              </h2>
              <p className="mt-6 max-w-xl text-[#a1a1aa]">
                Recipient history, amount bands, prior invoice hashes, and recurring obligations change the next action. They never become treasury ownership.
              </p>
            </div>
          </section>
        </div>

        <section className="bg-[#09090b] px-6 py-28 md:px-12">
          <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-6">
            <article className="rounded-[4px] border border-white/10 bg-[#111113] p-8 md:col-span-3">
              <h3 className="font-display text-2xl font-bold">One clerk. Five clients.</h3>
              <p className="mt-3 text-[#a1a1aa]">
                Web, API, MCP, SDK, and Telegram are clients of the same payable engine. Same vault. Same memory. Same /verify. None of them own the treasury.
              </p>
            </article>
            <article className="rounded-[4px] border border-white/10 p-8 md:col-span-3">
              <h3 className="font-display text-2xl font-bold">Owner vs agent</h3>
              <p className="mt-3 text-[#a1a1aa]">
                Owner pauses, withdraws, sets vendors, pays Band 1. Agent ingests, screens, and Band-0 pays. MCP treasury tools return forbidden.
              </p>
            </article>
            <article className="rounded-[4px] bg-[#2563eb] p-8 text-white md:col-span-4">
              <h3 className="font-display text-2xl font-bold">Splice is not a hash replay</h3>
              <p className="mt-3 text-white/85">
                DuplicateInvoice catches the same bytes. Splice is a new PDF with the same invoice number and a bigger total. BURSAR blocks it before Band 0 can move money.
              </p>
            </article>
            <article className="rounded-[4px] border border-white/10 p-8 md:col-span-2">
              <h3 className="font-display text-2xl font-bold">Attention</h3>
              <p className="mt-3 text-[#a1a1aa]">Next action is PAY, OPEN, WHY, or PROOF. That is the whole desk.</p>
            </article>
          </div>
        </section>

        <section id="work" className="px-6 py-24 md:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">Untrusted payable to sealed proof.</h2>
            <p className="mt-4 max-w-lg text-[#a1a1aa]">Six stages. One vault. Memory informs PAY / OPEN / WHY. The agent still cannot own the money.</p>
            <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              {FLOW.map((s, i) => (
                <div key={s.t} className="flow-step rounded-[4px] border border-white/10 bg-[#111113] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#71717a]">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="font-display mt-2 text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#d4d4d8]">{s.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-sm text-[#a1a1aa]">
              processResponse is EIP-191 recovery of the registered TEE signer, not a hardware quote. We do not claim that 0G cannot see your data.
            </p>
          </div>
        </section>

        <section id="proof" className="border-t border-white/10 px-6 py-28 md:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Open the chain. Do not trust a screenshot.</h2>
            <p className="mt-4 max-w-xl text-[#a1a1aa]">
              Paid, USDC.e Transfer, and Go merkle proof must agree. Storage roots open on storagescan.0g.ai.
            </p>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-[4px] border border-white/10 bg-white/10 sm:grid-cols-2">
              {LIVE.proofs.slice(0, 8).map((p) => {
                const splice = p.tx === LIVE.featured.blocked.invoice
                return (
                <li key={p.tx} className="bg-[#09090b] px-5 py-4">
                  <p className="text-sm">{p.label}</p>
                  {splice ? (
                    <Link className="mt-1 inline-block font-mono text-xs text-[#93c5fd]" to={'/verify/' + p.tx}>
                      {shortHash(p.tx, 8)}
                    </Link>
                  ) : (
                    <a className="mt-1 inline-block font-mono text-xs text-[#93c5fd]" href={txUrl(p.tx)}>
                      {shortHash(p.tx, 8)}
                    </a>
                  )}
                  {'storageRoot' in p && p.storageRoot ? (
                    <a className="ml-3 font-mono text-xs text-[#93c5fd]" href={storageUrl(p.storageRoot)}>
                      root {shortHash(p.storageRoot, 4)}
                    </a>
                  ) : null}
                </li>
                )
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4 text-sm">
              <Link to="/verify" className="text-[#93c5fd] underline">
                Public /verify
              </Link>
              <Link to="/desk" className="text-[#93c5fd] underline">
                Public proofs (no wallet)
              </Link>
              <a className="text-[#93c5fd] underline" href={addrUrl(LIVE.factory)}>
                Factory {shortHash(LIVE.factory, 4)}
              </a>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 md:px-12">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[4px] border border-white/10 bg-[#111113] px-8 py-16 md:px-16">
            <h2 className="font-display max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">Create your workspace.</h2>
            <p className="mt-4 max-w-md text-[#a1a1aa]">
              Connect the owner wallet. Resume the existing vault if you already have one. Authorize a scoped agent.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticButton href="/start">
                Get started
                <ArrowRight className="h-4 w-4" />
              </MagneticButton>
              <MagneticButton href="/agent" variant="ghost">
                MCP / SDK
              </MagneticButton>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 px-6 py-10 text-sm text-[#a1a1aa] md:flex-row md:items-center md:justify-between md:px-12">
          <span className="font-display font-bold text-white">BURSAR</span>
          <span>The AP clerk that cannot steal. The vault is the final authority.</span>
        </footer>
      </main>
    </SmoothScroll>
  )
}
