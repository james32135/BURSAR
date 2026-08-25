import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { MagneticButton } from '@/components/MagneticButton'
import { SmoothScroll } from '@/components/SmoothScroll'
import { OrbitSystem } from '@/components/OrbitSystem'
import { LIVE } from '@/lib/live'
import { addrUrl, txUrl } from '@/lib/cn'

gsap.registerPlugin(ScrollTrigger)

const STORY =
  'It handles payables without giving an agent unrestricted access to your treasury.'.split(' ')

export function Landing() {
  const root = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || !root.current) return
    const ctx = gsap.context(() => {
      gsap.from('.hero-reveal', {
        y: 24,
        opacity: 0,
        duration: 0.85,
        stagger: 0.07,
        ease: 'power3.out',
      })
      const story = root.current!.querySelector('.story-pin')
      if (story) {
        const words = story.querySelectorAll('.word')
        gsap.set(words, { opacity: 0.12 })
        gsap.to(words, {
          opacity: 1,
          stagger: 0.05,
          ease: 'none',
          scrollTrigger: { trigger: story, start: 'top top', end: '+=90%', pin: true, scrub: 0.6 },
        })
      }
      const pipe = root.current!.querySelector('.flow-pin')
      if (pipe) {
        gsap.from(pipe.querySelectorAll('.flow-step'), {
          y: 64,
          opacity: 0.2,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: pipe, start: 'top top', end: '+=120%', pin: true, scrub: 0.8 },
        })
      }
    }, root)
    return () => ctx.revert()
  }, [reduce])

  return (
    <SmoothScroll>
      <main ref={root} className="w-full max-w-full overflow-x-hidden bg-[#09090b] text-[#fafafa]">
        <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-black/10 bg-white px-5 text-[#09090b] md:px-10">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            BURSAR
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#52525b] md:flex">
            <a href="#work" className="hover:text-[#09090b]">How it works</a>
            <a href="#proof" className="hover:text-[#09090b]">Proof</a>
            <Link to="/agent" className="hover:text-[#09090b]">MCP / SDK</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/start" className="hidden h-9 items-center rounded-[4px] border border-[#09090b]/20 px-3 text-xs font-medium md:inline-flex">
              Get started
            </Link>
            <Link to="/app" className="inline-flex h-9 items-center rounded-[4px] bg-[#09090b] px-3 text-xs font-medium text-white">
              Open console
            </Link>
          </div>
        </header>

        <section className="relative min-h-[100dvh] pt-16 md:grid md:grid-cols-2">
          <div className="flex flex-col justify-between bg-white px-6 py-16 text-[#09090b] md:px-12 md:py-20">
            <div>
              <p className="hero-reveal font-mono text-[10px] uppercase tracking-[0.22em] text-[#71717a]">
                The vault pays · the agent works
              </p>
              <h1 className="hero-reveal font-display mt-6 max-w-xl text-[clamp(2.4rem,4.4vw,4.4rem)] font-bold leading-[0.98] tracking-[-0.05em]">
                Your finance agent can do the work. Your policy controls the money.
              </h1>
              <p className="hero-reveal mt-6 max-w-md text-base leading-relaxed text-[#52525b]">
                Recurring payables enter BURSAR. Direct TeeML reads them privately. Vendor memory and vault policy decide. Allowed USDC.e moves. Risk is blocked. Proof lives on 0G Aristotle.
              </p>
              <div className="hero-reveal mt-8 flex flex-wrap gap-3">
                <Link to="/start" className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-[#09090b] px-5 text-sm font-medium text-white">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/agent" className="inline-flex h-11 items-center rounded-[4px] border border-[#09090b]/20 px-5 text-sm font-medium">
                  Connect agent
                </Link>
              </div>
            </div>
            <div className="hero-reveal mt-16 grid gap-6 border-t border-[#09090b]/10 pt-8 font-mono text-[10px] uppercase tracking-[0.16em] sm:grid-cols-3">
              <div>
                <div className="text-[#09090b]">Intake from work</div>
                <div className="mt-2 text-[#71717a]">PDF · API · MCP</div>
              </div>
              <div>
                <div className="text-[#09090b]">Remember vendors</div>
                <div className="mt-2 text-[#71717a]">Recipient · amount · blocks</div>
              </div>
              <div>
                <div className="text-[#09090b]">Prove on 0G</div>
                <div className="mt-2 text-[#71717a]">Storage · TeeML · ChainScan</div>
              </div>
            </div>
          </div>
          <div className="relative min-h-[70vh] overflow-hidden bg-[#09090b] md:min-h-[100dvh]">
            <p className="absolute left-6 top-6 z-10 font-mono text-[10px] uppercase tracking-[0.18em] text-[#a1a1aa]">
              Certified on Aristotle 16661
            </p>
            <OrbitSystem />
          </div>
        </section>

        <section className="story-pin flex min-h-[100dvh] items-center bg-[#09090b] px-6 md:px-12">
          <h2 className="font-display mx-auto max-w-5xl text-4xl font-bold tracking-tight md:text-6xl">
            {STORY.map((w, i) => (
              <span key={i} className="word mr-[0.28em] inline-block">{w}</span>
            ))}
          </h2>
        </section>

        <section className="bg-[#09090b] px-6 py-32 md:px-12 md:py-48">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-6 md:grid-rows-2">
            <article className="rounded-[4px] border border-white/10 bg-[#111113] p-8 md:col-span-4 md:row-span-2">
              <h3 className="font-display text-3xl font-bold tracking-tight">The object is a payable</h3>
              <p className="mt-4 max-w-md text-[#a1a1aa]">
                Not a PDF app. A payable can be an invoice, a contractor request, a renewal, or an agent expense. Every one hits the same engine: identity, extraction, vendor memory, policy, pay or block, proof.
              </p>
            </article>
            <article className="rounded-[4px] border border-white/10 p-8 md:col-span-2">
              <h3 className="font-display text-xl font-bold">Owner wallet</h3>
              <p className="mt-3 text-sm text-[#a1a1aa]">Creates the vault, funds it, sets policy, pauses, withdraws.</p>
            </article>
            <article className="rounded-[4px] bg-[#2563eb] p-8 text-white md:col-span-2">
              <h3 className="font-display text-xl font-bold">Scoped agent</h3>
              <p className="mt-3 text-sm text-white/80">Ingests, analyzes, auto-pays Band 0. Never withdraws. Never owns the key.</p>
            </article>
          </div>
        </section>

        <section id="work" className="flow-pin flex min-h-[100dvh] flex-col justify-center bg-[#09090b] px-6 md:px-12">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              Payable. Private AI. Vendor memory. Policy. Vault. USDC.e. Proof.
            </h2>
            <div className="mt-12 flex gap-2 overflow-x-auto md:grid md:grid-cols-6 md:gap-3 md:overflow-visible">
              {[
                { t: 'Intake', d: 'PDF, API, or MCP. Telegram only when TELEGRAM_BOT_TOKEN is set.' },
                { t: 'Direct TeeML', d: 'Vision 0gm-1.0-35b-a3b. Signed response recovered.' },
                { t: '0G Storage', d: 'Encrypted upload. Go client proves the download.' },
                { t: 'Policy', d: 'Vendor, band, session cap, pause, expiry, revoke.' },
                { t: 'USDC.e', d: 'BursarVault.transfer. Not Payment Layer. Not 0G Pay.' },
                { t: 'Aristotle', d: '/verify reconstructs Paid + Transfer + merkle proof.' },
              ].map((s) => (
                <div key={s.t} className="flow-step min-w-[220px] rounded-[4px] border border-white/10 bg-[#111113] p-5 md:min-w-0">
                  <h3 className="font-display text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm text-[#a1a1aa]">{s.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-sm text-[#a1a1aa]">
              processResponse is EIP-191 recovery of the registered TEE signer, not a hardware quote. We do not claim that 0G cannot see your data.
            </p>
          </div>
        </section>

        <section id="proof" className="bg-[#09090b] px-6 py-32 md:px-12 md:py-48">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">Open the chain. Do not trust a screenshot.</h2>
            <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
              {LIVE.proofs.map((p) => (
                <li key={p.tx} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm">{p.label}</span>
                  <a className="font-mono text-xs text-[#93c5fd] hover:text-white" href={txUrl(p.tx)}>
                    {p.tx}
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
        </section>

        <section className="bg-[#09090b] px-6 py-24 md:px-12 md:py-32">
          <div className="mx-auto max-w-5xl rounded-[4px] border border-white/10 bg-[#111113] px-8 py-16 md:px-16">
            <h2 className="font-display max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">Create your workspace.</h2>
            <p className="mt-4 max-w-md text-[#a1a1aa]">
              Connect the owner wallet. Deploy a vault. Authorize a scoped agent. Connect an intake channel. Receive a payable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticButton href="/start" variant="ghost">
                Get started
              </MagneticButton>
              <MagneticButton href="/agent" variant="ghost">
                MCP / SDK
              </MagneticButton>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 bg-[#09090b] px-6 py-10 text-sm text-[#a1a1aa] md:flex-row md:items-center md:justify-between md:px-12">
          <span className="font-display font-bold text-white">BURSAR</span>
          <span>Autonomous finance desk. The vault is the final authority.</span>
        </footer>
      </main>
    </SmoothScroll>
  )
}
