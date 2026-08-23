import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

const C = {
  panel: '#121215',
  line: 'rgba(255,255,255,0.10)',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
  seal: '#2563eb',
  sealSoft: 'rgba(37,99,235,0.18)',
  ok: '#16a34a',
  paper: '#f4f4f5',
  ink: '#09090b',
}

function Scene({
  children,
  className,
  viewBox = '0 0 560 320',
  title,
}: {
  children: (uid: string) => React.ReactNode
  className?: string
  viewBox?: string
  title: string
}) {
  const ref = useRef<SVGSVGElement>(null)
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')

  useEffect(() => {
    const svg = ref.current
    if (!svg || reduce) return
    const num = (el: Element, attr: string, fallback: number) => {
      const n = Number(el.getAttribute(attr))
      return Number.isFinite(n) ? n : fallback
    }
    const ctx = gsap.context(() => {
      svg.querySelectorAll<SVGGeometryElement>('[data-draw]').forEach((el, i) => {
        let len = 280
        try {
          len = el.getTotalLength() || 280
        } catch {
          if (el.tagName === 'rect') {
            len = 2 * (num(el, 'width', 80) + num(el, 'height', 40))
          }
        }
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(el, {
          strokeDashoffset: 0,
          duration: 1.05,
          delay: Math.min(i * 0.03, 0.9),
          ease: 'power2.out',
          scrollTrigger: { trigger: svg, start: 'top 85%', once: true },
        })
      })
      const fade = svg.querySelectorAll('[data-fade]')
      if (fade.length) {
        gsap.from(fade, {
          opacity: 0,
          y: 10,
          duration: 0.65,
          stagger: 0.05,
          ease: 'power2.out',
          scrollTrigger: { trigger: svg, start: 'top 85%', once: true },
        })
      }
      svg.querySelectorAll<SVGGeometryElement>('[data-flow]').forEach((el) => {
        const dash = el.getAttribute('data-flow') || '6 12'
        const parts = dash.split(/\s+/).map(Number)
        const period = (parts[0] || 6) + (parts[1] ?? 12)
        gsap.set(el, { strokeDasharray: dash })
        gsap.fromTo(el, { strokeDashoffset: 0 }, { strokeDashoffset: -period * 2, duration: 1.6, ease: 'none', repeat: -1 })
      })
      svg.querySelectorAll<SVGElement>('[data-travel]').forEach((el) => {
        const name = el.getAttribute('data-travel')
        const path = svg.querySelector<SVGPathElement>(`[data-path="${name}"]`)
        if (!path) return
        gsap.set(el, { opacity: 1 })
        gsap.to(el, {
          motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
          duration: num(el, 'data-travel-dur', 5),
          ease: 'none',
          repeat: -1,
        })
      })
      const pulse = svg.querySelectorAll('[data-pulse]')
      if (pulse.length) {
        gsap.to(pulse, { opacity: 0.28, duration: 1.25, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.14 })
      }
    }, svg)
    return () => ctx.revert()
  }, [reduce])

  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label={title}
    >
      {children(uid)}
    </svg>
  )
}

/** Hot wallet paying invoices — the failure BURSAR replaces. */
export function SvgHotWallet({ className }: { className?: string }) {
  return (
    <Scene className={className} title="An agent holding the treasury key">
      {(uid) => (
        <>
          <rect x="24" y="36" width="512" height="248" rx="4" fill={C.panel} stroke={C.line} />
          <rect data-draw x="56" y="88" width="160" height="140" rx="4" fill="none" stroke={C.seal} />
          <text data-fade x="136" y="120" textAnchor="middle" fill={C.paper} fontFamily="Instrument Sans, sans-serif" fontSize="16" fontWeight="700">
            TREASURY
          </text>
          <text data-fade x="136" y="144" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Mono, monospace" fontSize="10">
            owner key on disk
          </text>
          <path
            data-draw
            d="M216 158 H320"
            fill="none"
            stroke={C.seal}
            strokeWidth="1.4"
          />
          <circle data-travel="leak" data-travel-dur="3.2" r="4" fill={C.seal} opacity="0" />
          <path data-path="leak" d="M216 158 H390" fill="none" stroke="none" />
          <rect data-draw x="330" y="108" width="170" height="100" rx="4" fill="none" stroke="rgba(250,250,250,0.2)" />
          <text data-fade x="415" y="148" textAnchor="middle" fill={C.text} fontFamily="IBM Plex Sans, sans-serif" fontSize="13">
            Unscoped agent
          </text>
          <text data-fade x="415" y="170" textAnchor="middle" fill={C.dim} fontFamily="IBM Plex Mono, monospace" fontSize="10">
            can empty the vault
          </text>
          <circle data-pulse cx="136" cy="188" r="6" fill={C.seal} />
        </>
      )}
    </Scene>
  )
}

/** Invoice → sealed AI → vault policy. The agent never holds the key. */
export function SvgVaultAuthority({ className }: { className?: string }) {
  return (
    <Scene className={className} title="AI recommends. The vault decides.">
      {(uid) => (
        <>
          <rect x="24" y="36" width="512" height="248" rx="4" fill={C.panel} stroke={C.line} />
          <rect data-draw x="48" y="92" width="110" height="136" rx="3" fill={C.paper} />
          <line x1="64" y1="118" x2="142" y2="118" stroke={C.ink} strokeWidth="1" opacity="0.35" data-fade />
          <line x1="64" y1="134" x2="128" y2="134" stroke={C.ink} strokeWidth="1" opacity="0.25" data-fade />
          <line x1="64" y1="150" x2="136" y2="150" stroke={C.ink} strokeWidth="1" opacity="0.25" data-fade />
          <text data-fade x="103" y="206" textAnchor="middle" fill={C.ink} fontFamily="IBM Plex Mono, monospace" fontSize="9">
            INVOICE
          </text>
          <path data-draw d="M168 160 H228" fill="none" stroke={C.seal} />
          <rect data-draw x="228" y="112" width="120" height="96" rx="4" fill="none" stroke={C.seal} />
          <text data-fade x="288" y="152" textAnchor="middle" fill={C.text} fontFamily="Instrument Sans, sans-serif" fontSize="14" fontWeight="700">
            Direct TeeML
          </text>
          <text data-fade x="288" y="174" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Mono, monospace" fontSize="9">
            recommend, not pay
          </text>
          <path data-draw d="M348 160 H408" fill="none" stroke={C.ok} />
          <rect data-draw x="408" y="104" width="120" height="112" rx="4" fill="none" stroke={C.ok} />
          <text data-fade x="468" y="148" textAnchor="middle" fill={C.text} fontFamily="Instrument Sans, sans-serif" fontSize="14" fontWeight="700">
            VAULT
          </text>
          <text data-fade x="468" y="170" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Mono, monospace" fontSize="9">
            final authority
          </text>
          <circle data-travel="desk" data-travel-dur="4.4" r="3.5" fill={C.seal} opacity="0" />
          <path data-path="desk" d="M158 160 H468" fill="none" stroke="none" />
        </>
      )}
    </Scene>
  )
}

/** Chain + Storage + TEE signer reconstruct /verify. */
export function SvgProofLedger({ className }: { className?: string }) {
  return (
    <Scene className={className} title="Proof reconstructed from chain and Storage">
      {() => (
        <>
          <rect x="24" y="36" width="512" height="248" rx="4" fill={C.panel} stroke={C.line} />
          {[
            ['Invoice hash', 70],
            ['Storage root + Go proof', 128],
            ['TEE signer recovered', 186],
            ['USDC.e Transfer + Paid', 244],
          ].map(([label, y], i) => (
            <g key={label}>
              <rect data-draw x="64" y={Number(y) - 22} width="432" height="44" rx="3" fill="none" stroke={C.line} />
              <text data-fade x="88" y={Number(y) + 4} fill={C.dim} fontFamily="IBM Plex Mono, monospace" fontSize="10">
                {String(i + 1).padStart(2, '0')}
              </text>
              <text data-fade x="128" y={Number(y) + 4} fill={C.text} fontFamily="IBM Plex Sans, sans-serif" fontSize="14">
                {label}
              </text>
            </g>
          ))}
          <path data-flow="5 10" d="M48 48 V272" fill="none" stroke={C.seal} strokeWidth="1.2" />
        </>
      )}
    </Scene>
  )
}

/** Scoped session inside a fence. Treasury key stays with the owner. */
export function SvgScopedAgent({ className }: { className?: string }) {
  return (
    <Scene className={className} title="Scoped agent cannot withdraw or change policy">
      {() => (
        <>
          <rect x="24" y="36" width="512" height="248" rx="4" fill={C.panel} stroke={C.line} />
          <rect data-draw x="70" y="72" width="250" height="176" rx="4" fill="none" stroke={C.seal} strokeDasharray="6 6" />
          <text data-fade x="195" y="104" textAnchor="middle" fill={C.seal} fontFamily="IBM Plex Mono, monospace" fontSize="10">
            SESSION SCOPE
          </text>
          <text data-fade x="195" y="148" textAnchor="middle" fill={C.text} fontFamily="Instrument Sans, sans-serif" fontSize="18" fontWeight="700">
            Band-0 pay
          </text>
          <text data-fade x="195" y="172" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Sans, sans-serif" fontSize="12">
            allowlisted vendors only
          </text>
          <text data-fade x="195" y="220" textAnchor="middle" fill={C.dim} fontFamily="IBM Plex Mono, monospace" fontSize="10">
            cannot withdraw · cannot setVendor
          </text>
          <rect data-draw x="360" y="96" width="150" height="128" rx="4" fill="none" stroke={C.ok} />
          <text data-fade x="435" y="148" textAnchor="middle" fill={C.text} fontFamily="Instrument Sans, sans-serif" fontSize="16" fontWeight="700">
            Owner key
          </text>
          <text data-fade x="435" y="172" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Mono, monospace" fontSize="10">
            outside the fence
          </text>
        </>
      )}
    </Scene>
  )
}

/** Four 0G rails that BURSAR actually uses. */
export function SvgIntegrations({ className }: { className?: string }) {
  return (
    <Scene className={className} title="0G Compute, Storage, Aristotle, USDC.e" viewBox="0 0 560 220">
      {() => (
        <>
          {[
            ['0G Compute', 'Direct TeeML', 40],
            ['0G Storage', 'encrypted + Go proof', 160],
            ['Aristotle', 'BursarVault 16661', 280],
            ['USDC.e', 'vault transfer only', 400],
          ].map(([t, d, x]) => (
            <g key={t} data-fade>
              <rect x={Number(x)} y="48" width="108" height="124" rx="4" fill="none" stroke={C.line} data-draw />
              <text x={Number(x) + 54} y="98" textAnchor="middle" fill={C.text} fontFamily="Instrument Sans, sans-serif" fontSize="13" fontWeight="700">
                {t}
              </text>
              <text x={Number(x) + 54} y="124" textAnchor="middle" fill={C.muted} fontFamily="IBM Plex Mono, monospace" fontSize="9">
                {d}
              </text>
            </g>
          ))}
        </>
      )}
    </Scene>
  )
}
