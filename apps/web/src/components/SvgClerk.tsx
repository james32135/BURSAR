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
