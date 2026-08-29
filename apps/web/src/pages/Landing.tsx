import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { MagneticButton } from '@/components/MagneticButton'
import { SmoothScroll } from '@/components/SmoothScroll'
import { HeroDesk } from '@/components/HeroDesk'
import { SvgArchitecture, SvgEngine, SvgPain, SvgVerify } from '@/components/svg/BursarScenes'
import { LIVE } from '@/lib/live'
import { addrUrl, shortHash, txUrl } from '@/lib/cn'

gsap.registerPlugin(ScrollTrigger)

const PAIN = 'Crypto teams paste vendor addresses into Discord. A fake invoice gets paid. USDC never comes back.'.split(' ')
const DESK = 'Invoice in. Fake blocked. USDC paid. The clerk never owns the vault.'.split(' ')

const FLOW = [
  { t: 'Source', d: 'PDF, API, MCP, SDK, or Telegram. Email intake coming later.' },
  { t: 'Private AI', d: 'Direct TeeML. processResponse recovers the registered signer via EIP-191.' },
  { t: 'Memory', d: 'Vendor remittance, typical amount, last pay, recipient changes.' },
  { t: 'Policy', d: 'Band 0 auto-pay. Band 1 owner review. Pause, expiry, revoke.' },
  { t: 'Action', d: 'The agent pays what is allowed. Dangerous payables stop.' },
  { t: 'Money', d: 'USDC.e transfer from this workspace vault only.' },
  { t: 'Proof', d: 'Storage root, Go proof, Paid event, ChainScan, /verify.' },
]

export function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-reveal', {
        y: 40,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out',
      })
      gsap.utils.toArray<HTMLElement>('.story-pin').forEach((section) => {
        const words = section.querySelectorAll('.word')
        gsap.set(words, { opacity: 0.12 })
        gsap.to(words, {
          opacity: 1,
          stagger: 0.04,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top top', end: '+=80%', pin: true, scrub: 0.6 },
        })
      })
      const pipe = root.current!.querySelector('.flow-pin')
      if (pipe) {
        gsap.from(pipe.querySelectorAll('.flow-step'), {
          y: 80,
          opacity: 0.15,
          stagger: 0.12,
          ease: 'none',
          scrollTrigger: { trigger: pipe, start: 'top top', end: '+=140%', pin: true, scrub: 0.8 },
        })
      }
      gsap.from('.arch-panel', {
        y: 32,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.arch-section', start: 'top 70%' },
      })
      gsap.from('.bento-card', {
        y: 28,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.bento-grid', start: 'top 78%' },
      })
      gsap.from('.proof-row', {
        x: 16,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: 'power2.out',
        scrollTrigger: { trigger: '#proof', start: 'top 72%' },
      })
    }, root)
    return () => ctx.revert()
  }, [reduce])

  return (
    <SmoothScroll>
      <main ref={root} className="w-full max-w-full overflow-x-hidden bg-[#09090b] text-[#fafafa]">
        <div className="grain" aria-hidden />

        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-black/10 bg-[#f4f4f5]/90 px-5 text-[#18181b] backdrop-blur-md md:px-10">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            BURSAR
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#52525b] md:flex">
            <a href="#story" className="hover:text-[#09090b]">
              Story
            </a>
            <a href="#work" className="hover:text-[#09090b]">
              How it works
            </a>
            <Link to="/verify" className="hover:text-[#09090b]">
              Verify
            </Link>
            <Link to="/agent" className="hover:text-[#09090b]">
              MCP / SDK
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/start"
              className="hidden h-9 items-center rounded-[4px] border border-[#09090b]/20 px-3 text-xs font-medium md:inline-flex"
            >
              Get started
            </Link>
            <MagneticButton href="/app" className="h-9 bg-[#09090b] px-3 text-xs uppercase tracking-wide text-white">
              Open console
            </MagneticButton>
          </div>
        </header>

        <section className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-[#f4f4f5] px-6 pb-16 pt-24 text-[#18181b] md:px-12">
            <p className="hero-reveal mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#52525b]">
              Accounts payable clerk for crypto companies · 0G Aristotle 16661
            </p>
            <h1 className="hero-reveal font-display max-w-2xl text-[clamp(2.3rem,4.2vw,3.7rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-balance">
              Invoice in. Fake blocked. USDC paid.
            </h1>
            <p className="hero-reveal mt-6 max-w-md text-base leading-relaxed text-[#52525b]">
              The AI clerk that cannot steal. Direct TeeML reads the invoice. Policy vault pays USDC.e. Duplicate and spliced bills revert. The agent never holds the treasury key.
            </p>
            <div className="hero-reveal mt-8 flex flex-wrap gap-3">
              <Link
                to="/start"
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[#18181b] px-5 text-sm font-medium text-white"
              >
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/verify"
                className="inline-flex h-11 items-center rounded-[4px] border border-[#18181b]/20 px-5 text-sm font-medium"
              >
                Verify (no wallet)
              </Link>
            </div>
            <dl className="hero-reveal mt-10 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-[4px] border border-[#18181b]/10 bg-[#18181b]/10">
              {[
                { k: 'Read', v: 'sealed TeeML' },
                { k: 'Block', v: 'splice / duplicate' },
                { k: 'Pay', v: 'vault USDC.e' },
              ].map((b) => (
                <div key={b.k} className="bg-[#f4f4f5] px-4 py-3">
                  <dt className="font-display text-sm font-bold tracking-tight">{b.k}</dt>
                  <dd className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717a]">{b.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative flex min-h-[62dvh] items-center justify-center overflow-hidden bg-[#09090b] px-6 py-16 lg:min-h-[100dvh] lg:py-0">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_42%,rgba(37,99,235,0.2),transparent_62%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_78%)]" />
            <div className="absolute left-6 top-24 flex items-center gap-2 md:left-10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563eb]" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#71717a]">
                Certified on Aristotle 16661
              </span>
            </div>
            <HeroDesk className="relative z-10 w-full max-w-[min(88vw,600px)]" />
          </div>
        </section>

        <section id="story" className="story-pin flex min-h-[100dvh] flex-col justify-center px-6 py-24 md:px-12">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {PAIN.map((w, i) => (
                <span key={`p-${i}`} className="word mr-[0.3em] inline-block">
                  {w}
                </span>
              ))}
            </h2>
            <SvgPain />
          </div>
        </section>

        <section className="story-pin flex min-h-[100dvh] flex-col justify-center bg-[#111113] px-6 py-24 md:px-12">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <SvgEngine />
            <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              {DESK.map((w, i) => (
                <span key={`d-${i}`} className="word mr-[0.3em] inline-block">
                  {w}
                </span>
              ))}
            </h2>
          </div>
        </section>

        <section className="bg-[#09090b] px-6 py-32 md:px-12 md:py-48">
          <div className="bento-grid mx-auto grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-6 md:grid-rows-2">
            <article className="bento-card lift rounded-[4px] border border-white/10 bg-[#111113] p-8 md:col-span-4 md:row-span-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#2563eb]">01 · Object</p>
              <h3 className="font-display mt-3 text-3xl font-bold tracking-tight">The object is an invoice the vault will pay or reject</h3>
              <p className="mt-4 max-w-md text-[#a1a1aa]">
                PDF, API, MCP, SDK, or Telegram become one payable. Same engine: sealed read, vendor memory, bands,
                USDC.e, /verify. Email intake is not live.
              </p>
            </article>
            <article className="bento-card lift rounded-[4px] border border-white/10 p-8 md:col-span-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#71717a]">02 · Owner</p>
              <h3 className="font-display mt-3 text-xl font-bold">Owner wallet</h3>
              <p className="mt-3 text-sm text-[#a1a1aa]">Creates the vault, funds it, sets policy, pauses, withdraws. Never a seed phrase.</p>
            </article>
            <article className="bento-card lift rounded-[4px] bg-[#2563eb] p-8 text-white md:col-span-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">03 · Agent</p>
              <h3 className="font-display mt-3 text-xl font-bold">Scoped agent</h3>
              <p className="mt-3 text-sm text-white/80">Ingests, analyzes, auto-pays Band 0. Never withdraws. Never owns the key.</p>
            </article>
          </div>
        </section>

        <section id="work" className="flow-pin flex min-h-[100dvh] flex-col justify-center px-6 py-20 md:px-12">
          <div className="mx-auto w-full max-w-5xl">
            <h2 className="font-display max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">From payable to sealed proof.</h2>
            <p className="mt-4 max-w-lg text-[#a1a1aa]">One pipeline. Six beats. Nothing left to hope.</p>
            <div className="mt-12 grid gap-3 md:grid-cols-3 lg:grid-cols-7">
              {FLOW.map((s, i) => (
                <div key={s.t} className="flow-step lift rounded-[4px] border border-white/10 bg-[#111113] p-5">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#2563eb]">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="font-display mt-3 text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#d4d4d8]">{s.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-sm text-[#a1a1aa]">
              processResponse is EIP-191 recovery of the registered TEE signer, not a hardware quote. We do not claim that 0G cannot see your data.
            </p>
          </div>
        </section>

        <section id="proof" className="px-6 py-28 md:px-12 md:py-36">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Open the chain. Do not trust a screenshot.</h2>
              <p className="mt-4 max-w-md text-[#a1a1aa]">
                Paid, USDC.e Transfer, and Go merkle proof must agree. The explorer is the source of truth.
              </p>
              <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
                {LIVE.proofs.map((p) => (
                  <li key={p.tx} className="proof-row flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">{p.label}</span>
                    <a className="font-mono text-xs text-[#93c5fd] hover:text-white" href={txUrl(p.tx)}>
                      {shortHash(p.tx, 8)}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-mono text-xs text-[#a1a1aa]">
                Factory{' '}
                <a className="text-[#93c5fd]" href={addrUrl(LIVE.factory)}>
                  {LIVE.factory}
                </a>
              </p>
            </div>
            <SvgVerify />
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#111113] px-6 py-24 md:px-12">
          <div className="mx-auto max-w-6xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-300">The attack</p>
            <h2 className="font-display mt-3 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Same invoice. Amount spliced to $19,000. Payment path dies.
            </h2>
            <p className="mt-4 max-w-xl text-[#a1a1aa]">
              Replay of a paid hash reverts DuplicateInvoice on-chain. A new PDF with the same invoice number and a
              bigger total is blocked as a manipulated duplicate before Band 0 can move USDC.e.
            </p>
            <Link to="/verify" className="mt-8 inline-flex text-sm text-[#93c5fd] underline">
              Open /verify with no wallet
            </Link>
          </div>
        </section>

        <section id="architecture" className="arch-section border-t border-white/10 bg-[#0c0c0e] px-6 py-28 md:px-12 md:py-36">
          <div className="mx-auto max-w-6xl">
            <h2 className="arch-panel font-display max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Privacy, memory, policy. One desk.
            </h2>
            <p className="arch-panel mt-4 max-w-xl text-[#a1a1aa]">
              You watch exceptions. The agent does the clerk work. The vault remains yours.
            </p>
            <div className="arch-panel mt-14">
              <SvgArchitecture />
            </div>
            <div className="arch-panel mt-10 grid gap-3 md:grid-cols-3">
              {[
                { t: 'Private AI', d: 'Direct TeeML vision on the invoice. Not a hardware quote. Not “0G cannot see your data.”' },
                { t: 'Vendor intelligence', d: 'Wallet, typical amount, last pay, recipient changes, prior blocks — from persisted history.' },
                { t: 'Policy boundary', d: 'Band 0 auto-pay. Owner review at the edge. Block on duplicate, wrong vendor, malformed proof.' },
              ].map((c) => (
                <div key={c.t} className="lift rounded-[4px] border border-white/10 p-6">
                  <h3 className="font-display text-xl font-bold">{c.t}</h3>
                  <p className="mt-2 text-sm text-[#a1a1aa]">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24 md:px-12 md:py-32">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[4px] border border-white/10 bg-[#111113] px-8 py-16 md:px-16">
            <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-[#2563eb]/20 blur-3xl" />
            <h2 className="font-display max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">Create your workspace.</h2>
            <p className="mt-4 max-w-md text-[#a1a1aa]">
              Connect the owner wallet. Deploy a vault. Authorize a scoped agent. Receive a payable.
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
