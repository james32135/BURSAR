import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

gsap.registerPlugin(ScrollTrigger)

const ink = '#fafafa'
const mute = '#a1a1aa'
const dim = '#71717a'
const blue = '#2563eb'
const FACE = 'Outfit, IBM Plex Sans, system-ui, sans-serif'
const BODY = 'IBM Plex Sans, system-ui, sans-serif'
const MONO = 'IBM Plex Mono, ui-monospace, monospace'

function Scene({
  title,
  viewBox = '0 0 560 320',
  className,
  children,
}: {
  title: string
  viewBox?: string
  className?: string
  children: (uid: string) => React.ReactNode
}) {
  const ref = useRef<SVGSVGElement>(null)
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')

  useEffect(() => {
    const svg = ref.current
    if (!svg || reduce) return
    const num = (el: Element, attr: string, fallback: number) => {
      const v = el.getAttribute(attr)
      const n = v === null ? NaN : Number(v)
      return Number.isFinite(n) ? n : fallback
    }
    const ctx = gsap.context(() => {
      svg.querySelectorAll<SVGGeometryElement>('[data-draw]').forEach((el, i) => {
        let len = 240
        if (el.tagName === 'rect') {
          len = 2 * (num(el, 'width', 80) + num(el, 'height', 40))
        } else {
          try {
            len = el.getTotalLength()
          } catch {
            /* text / group */
          }
        }
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
        gsap.to(el, {
          strokeDashoffset: 0,
          duration: 1.05,
          delay: Math.min(i * 0.04, 0.9),
          ease: 'power2.out',
          scrollTrigger: { trigger: svg, start: 'top 82%', once: true },
        })
      })
      const fade = svg.querySelectorAll('[data-fade]')
      if (fade.length) {
        gsap.from(fade, {
          opacity: 0,
          y: 12,
          duration: 0.7,
          stagger: 0.055,
          ease: 'power2.out',
          scrollTrigger: { trigger: svg, start: 'top 82%', once: true },
        })
      }
      svg.querySelectorAll<SVGElement>('[data-flow]').forEach((el) => {
        const dash = el.getAttribute('data-flow') || '7 14'
        gsap.set(el, { strokeDasharray: dash })
        gsap.to(el, { strokeDashoffset: -42, duration: 1.6, ease: 'none', repeat: -1 })
      })
      const pulse = svg.querySelectorAll('[data-pulse]')
      if (pulse.length) {
        gsap.to(pulse, {
          opacity: 0.3,
          duration: 1.2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          stagger: 0.14,
        })
      }
      svg.querySelectorAll<SVGElement>('[data-blip]').forEach((el, i) => {
        gsap.fromTo(
          el,
          { scale: 0.7, opacity: 0.9, transformOrigin: '50% 50%' },
          { scale: 2.1, opacity: 0, duration: 2, delay: i * 0.5, repeat: -1, ease: 'power2.out' },
        )
      })
    }, svg)
    return () => ctx.revert()
  }, [reduce])

  return (
    <svg ref={ref} viewBox={viewBox} className={cn('h-auto w-full overflow-visible', className)} role="img" aria-label={title}>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="80%" cy="18%" r="42%">
          <stop offset="0%" stopColor={blue} stopOpacity="0.2" />
          <stop offset="100%" stopColor={blue} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-bloom`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {children(uid)}
    </svg>
  )
}

function Card({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = 'rgba(255,255,255,0.12)',
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub: string
  accent?: string
}) {
  return (
    <g data-fade>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#111113" stroke={accent} />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fill={ink} fontSize="13" fontWeight={700} fontFamily={FACE}>
        {title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fill={dim} fontSize="8" fontFamily={MONO} letterSpacing="0.14em">
        {sub}
      </text>
    </g>
  )
}

/** Unpaid chaos — original BURSAR scene. */
export function SvgPain({ className }: { className?: string }) {
  return (
    <Scene title="Invoices pile up across inboxes with no policy and no proof" className={className}>
      {(uid) => (
        <g>
          <rect width="560" height="320" fill="#0c0c0f" />
          <rect width="560" height="320" fill={`url(#${uid}-glow)`} />
          {[
            { x: 32, y: 42, rot: -9, stamp: 'OVERDUE', amount: '4,200' },
            { x: 188, y: 68, rot: 5, stamp: 'UNKNOWN', amount: '880' },
            { x: 344, y: 36, rot: -3, stamp: 'DUP', amount: '12,040' },
          ].map((c) => (
            <g key={c.stamp} transform={`translate(${c.x} ${c.y}) rotate(${c.rot})`} data-fade>
              <rect width="172" height="196" rx="4" fill="#f4f4f5" />
              <rect x="16" y="18" width="92" height="8" rx="2" fill="#09090b" />
              <rect x="16" y="38" width="124" height="6" rx="2" fill="#d4d4d8" />
              <rect x="16" y="52" width="78" height="6" rx="2" fill="#e4e4e7" />
              <rect x="16" y="78" width="140" height="1" fill="#e4e4e7" />
              {[0, 1, 2, 3].map((r) => (
                <g key={r}>
                  <rect x="16" y={92 + r * 16} width="70" height="5" rx="1" fill="#d4d4d8" />
                  <rect x="110" y={92 + r * 16} width="42" height="5" rx="1" fill="#a1a1aa" />
                </g>
              ))}
              <text x="16" y="168" fill="#09090b" fontSize="11" fontFamily={MONO}>
                ${c.amount}
              </text>
              <text x="16" y="186" fill="#b91c1c" fontSize="9" fontFamily={MONO} letterSpacing="0.16em">
                {c.stamp}
              </text>
            </g>
          ))}
          <path data-draw d="M40 268 H520" fill="none" stroke="rgba(255,255,255,0.12)" />
          <circle cx="520" cy="268" r="4" fill="#f87171" data-pulse />
          <text data-fade x="40" y="294" fill={mute} fontSize="12" fontFamily={BODY}>
            Work happens in email. Money waits. Proof does not exist.
          </text>
        </g>
      )}
    </Scene>
  )
}

/** Same payable engine, six beats. */
export function SvgEngine({ className }: { className?: string }) {
  const steps = [
    { t: 'Intake', s: 'PDF · API · MCP' },
    { t: 'TeeML', s: 'private vision' },
    { t: 'Memory', s: 'vendor history' },
    { t: 'Policy', s: 'band · pause' },
    { t: 'USDC.e', s: 'vault transfer' },
    { t: 'Proof', s: 'Paid + Go' },
  ]
  return (
    <Scene title="BURSAR payable engine from intake to on-chain proof" className={className}>
      {(uid) => (
        <g>
          <rect width="560" height="320" fill="#09090b" />
          <rect width="560" height="320" fill={`url(#${uid}-glow)`} />
          <text data-fade x="28" y="46" fill={ink} fontSize="20" fontFamily={FACE} fontWeight={700}>
            One object. One engine.
          </text>
          <path data-draw d="M28 62 H248" fill="none" stroke="rgba(37,99,235,0.55)" strokeWidth="1.5" />
          {steps.map((s, i) => {
            const x = 20 + i * 90
            return (
              <g key={s.t}>
                {i < steps.length - 1 && (
                  <path
                    data-flow="6 10"
                    d={`M${x + 82} 168 H${x + 90}`}
                    fill="none"
                    stroke={blue}
                    strokeWidth="1.6"
                    filter={`url(#${uid}-bloom)`}
                  />
                )}
                <g data-fade>
                  <rect x={x} y="108" width="80" height="120" rx="4" fill="#111113" stroke="rgba(255,255,255,0.1)" />
                  <text x={x + 40} y="132" textAnchor="middle" fill={blue} fontSize="10" fontFamily={MONO}>
                    {String(i + 1).padStart(2, '0')}
                  </text>
                  <circle cx={x + 40} cy="158" r="5" fill={blue} data-pulse />
                  <circle cx={x + 40} cy="158" r="10" fill="none" stroke={blue} strokeWidth="1" data-blip />
                  <text x={x + 40} y="186" textAnchor="middle" fill={ink} fontSize="12" fontFamily={FACE} fontWeight={700}>
                    {s.t}
                  </text>
                  <text x={x + 40} y="206" textAnchor="middle" fill={dim} fontSize="8" fontFamily={MONO}>
                    {s.s}
                  </text>
                </g>
              </g>
            )
          })}
          <text data-fade x="28" y="268" fill={mute} fontSize="12" fontFamily={BODY}>
            PDF, API, and MCP all become a payable. The vault is the final authority.
          </text>
        </g>
      )}
    </Scene>
  )
}

/** Chain reconstruction, not a screenshot. */
export function SvgVerify({ className }: { className?: string }) {
  return (
    <Scene title="Paid event, USDC.e transfer, and Go storage proof must agree" className={className}>
      {() => (
        <g>
          <rect width="560" height="320" fill="#0c0c0f" />
          {[
            { y: 36, t: 'Paid', d: 'BursarVault event on Aristotle 16661' },
            { y: 118, t: 'Transfer', d: 'USDC.e vault → remittance, amount match' },
            { y: 200, t: 'Go proof', d: 'Succeeded to validate the downloaded file' },
          ].map((row) => (
            <g key={row.t} data-fade>
              <rect x="28" y={row.y} width="504" height="68" rx="4" fill="#111113" stroke="rgba(255,255,255,0.08)" />
              <circle cx="62" cy={row.y + 34} r="11" fill="none" stroke="#4ade80" strokeWidth="2" data-draw />
              <path d={`M56 ${row.y + 34} l4 4 8-9`} fill="none" stroke="#4ade80" strokeWidth="2" data-draw />
              <circle cx="62" cy={row.y + 34} r="16" fill="none" stroke="#4ade80" strokeWidth="0.8" data-blip />
              <text x="92" y={row.y + 30} fill={ink} fontSize="16" fontFamily={FACE} fontWeight={700}>
                {row.t}
              </text>
              <text x="92" y={row.y + 50} fill={mute} fontSize="12" fontFamily={BODY}>
                {row.d}
              </text>
              <text x="500" y={row.y + 38} textAnchor="end" fill="#4ade80" fontSize="9" fontFamily={MONO} letterSpacing="0.16em">
                MATCH
              </text>
            </g>
          ))}
        </g>
      )}
    </Scene>
  )
}

/** Four layers of the finance desk. */
export function SvgArchitecture({ className }: { className?: string }) {
  return (
    <Scene title="BURSAR architecture: console over the payable engine, settling on Aristotle and 0G Storage" viewBox="0 0 560 360" className={className}>
      {() => (
        <g>
          <rect width="560" height="360" fill="#0c0c0e" />
          {[72, 158, 244, 312].map((y) => (
            <line key={y} x1="58" y1={y} x2="58" y2={y + 36} stroke="rgba(37,99,235,0.4)" strokeWidth="1.5" />
          ))}
          {[
            { y: 86, t: 'SURFACE' },
            { y: 172, t: 'ENGINE' },
            { y: 258, t: 'POLICY' },
            { y: 326, t: 'SETTLE' },
          ].map((l) => (
            <text key={l.t} data-fade x="48" y={l.y} textAnchor="end" fill={dim} fontSize="8" fontFamily={MONO} letterSpacing="0.16em">
              {l.t}
            </text>
          ))}
          <Card x={72} y={26} w={222} h={44} title="Console" sub="ATTENTION HOME" />
          <Card x={326} y={26} w={222} h={44} title="Onboarding" sub="OWNER WALLET" />
          <rect
            x="72"
            y="112"
            width="476"
            height="48"
            rx="6"
            fill="rgba(37,99,235,0.07)"
            stroke="rgba(37,99,235,0.5)"
            data-draw
          />
          <g data-fade>
            <text x="280" y="132" textAnchor="middle" fill={ink} fontSize="13" fontFamily={FACE} fontWeight={700}>
              PAYABLE ENGINE
            </text>
            <text x="280" y="148" textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily={MONO} letterSpacing="0.16em">
              INTAKE · TEEML · MEMORY · DECIDE
            </text>
          </g>
          <circle cx="88" cy="136" r="4" fill={blue} data-pulse />
          <circle cx="532" cy="136" r="4" fill={blue} data-pulse />
          {[
            { t: 'Owner', s: 'VAULT KEY' },
            { t: 'Agent', s: 'SCOPED PAY' },
            { t: 'Vendors', s: 'MEMORY' },
            { t: 'Bands', s: 'AUTO / REVIEW' },
          ].map((a, i) => (
            <Card key={a.t} x={72 + i * 122} y={202} w={110} h={50} title={a.t} sub={a.s} />
          ))}
          <Card x={72} y={294} w={222} h={44} title="Aristotle 16661" sub="USDC.e TRANSFER" accent="rgba(74,222,128,0.4)" />
          <Card x={326} y={294} w={222} h={44} title="0G Storage" sub="GO MERKLE PROOF" accent="rgba(147,197,253,0.4)" />
          {[183, 437].map((x) => (
            <g key={x}>
              <line x1={x} y1="70" x2={x} y2="112" stroke="rgba(255,255,255,0.12)" data-flow="4 8" />
              <line x1={x} y1="160" x2={x} y2="202" stroke="rgba(255,255,255,0.12)" data-flow="4 8" />
            </g>
          ))}
          <line x1="183" y1="252" x2="183" y2="294" stroke="rgba(255,255,255,0.12)" data-flow="4 8" />
          <line x1="437" y1="252" x2="437" y2="294" stroke="rgba(255,255,255,0.12)" data-flow="4 8" />
          <circle cx="280" cy="136" r="18" fill="none" stroke={blue} strokeWidth="0.8" data-blip />
        </g>
      )}
    </Scene>
  )
}
