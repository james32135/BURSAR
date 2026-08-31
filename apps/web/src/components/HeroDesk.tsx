import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

gsap.registerPlugin(MotionPathPlugin)

export type DeskMode = 'idle' | 'analyzing' | 'flagged' | 'approval' | 'paying' | 'paid' | 'blocked' | 'verified'

const BLUE = '#2563eb'
const INK = '#fafafa'
const FACE = 'Outfit, IBM Plex Sans, system-ui, sans-serif'
const MONO = 'IBM Plex Mono, ui-monospace, monospace'

const STATIONS = [
  { key: 'invoice', t: 'PAYABLE', s: 'untrusted in', n: '01', deg: -90, px: 280, py: 72 },
  { key: 'ai', t: '0G TEE', s: 'private intel', n: '02', deg: -30, px: 488, py: 148 },
  { key: 'policy', t: 'MEMORY', s: 'history + bands', n: '03', deg: 30, px: 488, py: 412 },
  { key: 'vault', t: 'POLICY', s: 'cannot steal', n: '04', deg: 90, px: 280, py: 514 },
  { key: 'usdc', t: 'MONEY', s: 'bounded USDC.e', n: '05', deg: 150, px: 72, py: 412 },
  { key: 'proof', t: 'PROOF', s: 'chain + Go', n: '06', deg: 210, px: 72, py: 148 },
] as const

const MODE_LIT: Record<DeskMode, string> = {
  idle: 'invoice',
  analyzing: 'ai',
  flagged: 'policy',
  approval: 'policy',
  paying: 'usdc',
  paid: 'usdc',
  blocked: 'vault',
  verified: 'proof',
}

function pol(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

function hexPts(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = pol(cx, cy, r, a0)
  const p1 = pol(cx, cy, r, a1)
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0
  return `M${p0.x} ${p0.y} A${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`
}

function tone(mode: DeskMode, key: string, active: string) {
  if (mode === 'blocked' && key === 'vault') return '#dc2626'
  if (mode === 'flagged' && key === 'policy') return '#d97706'
  if (mode === 'verified' && key === 'proof') return '#4ade80'
  if (mode === 'paid' && (key === 'usdc' || key === 'proof')) return '#4ade80'
  if (key === active) return BLUE
  return 'rgba(250,250,250,0.55)'
}

const HEX_CELLS: Array<[number, number]> = []
;(() => {
  const size = 22
  const dx = size * Math.sqrt(3)
  const dy = size * 1.5
  for (let row = -7; row <= 7; row++) {
    for (let col = -8; col <= 8; col++) {
      const x = 280 + col * dx + (row % 2 ? dx / 2 : 0)
      const y = 280 + row * dy
      if ((x - 280) ** 2 + (y - 280) ** 2 < 248 ** 2) HEX_CELLS.push([x, y])
    }
  }
})()

/** BURSAR payable loop — original six-station desk. */
export function HeroDesk({ className, mode = 'idle' }: { className?: string; mode?: DeskMode }) {
  const ref = useRef<SVGSVGElement>(null)
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const cx = 280
  const cy = 280
  const R = 142
  const active = MODE_LIT[mode]

  useEffect(() => {
    const svg = ref.current
    if (!svg || reduce) return

    const num = (el: Element, attr: string, fallback: number) => {
      const v = el.getAttribute(attr)
      const n = v === null ? NaN : Number(v)
      return Number.isFinite(n) ? n : fallback
    }

    const ctx = gsap.context(() => {
      svg.querySelectorAll<SVGElement>('[data-orbit]').forEach((el) => {
        gsap.to(el, {
          rotation: num(el, 'data-orbit-dir', 1) < 0 ? -360 : 360,
          duration: num(el, 'data-orbit', 14),
          repeat: -1,
          ease: 'none',
          svgOrigin: `${cx} ${cy}`,
        })
      })

      const path = svg.querySelector<SVGPathElement>('[data-path="loop"]')
      svg.querySelectorAll<SVGElement>('[data-travel]').forEach((el) => {
        if (!path) return
        const dur = num(el, 'data-travel-dur', 8)
        const offset = num(el, 'data-travel-at', 0)
        const tl = gsap.timeline({ repeat: -1 })
        tl.to(el, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, duration: dur, ease: 'none' }, 0)
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: dur * 0.12, ease: 'none' }, 0)
        tl.to(el, { opacity: 0, duration: dur * 0.18, ease: 'none' }, dur * 0.82)
        if (offset) tl.progress(offset % 1)
      })

      const pulse = svg.querySelectorAll('[data-pulse]')
      if (pulse.length) {
        gsap.to(pulse, {
          opacity: 0.28,
          duration: 1.25,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          stagger: 0.12,
        })
      }

      svg.querySelectorAll<SVGElement>('[data-blip]').forEach((el, i) => {
        gsap.fromTo(
          el,
          { scale: 0.7, opacity: 0.85, transformOrigin: '50% 50%' },
          { scale: 2.2, opacity: 0, duration: 2.1, delay: i * 0.38, repeat: -1, ease: 'power2.out' },
        )
      })

      const seq = Array.from(svg.querySelectorAll<SVGElement>('[data-seq]')).sort(
        (a, b) => num(a, 'data-seq', 0) - num(b, 'data-seq', 0),
      )
      if (seq.length && mode === 'idle') {
        gsap.set(seq, { opacity: 0.22 })
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.35 })
        seq.forEach((el, i) => {
          tl.to(el, { opacity: 1, duration: 0.28, ease: 'power2.out' }, i * 0.55)
            .to(el, { opacity: 0.22, duration: 0.4, ease: 'power1.in' }, i * 0.55 + 0.58)
        })
      }

      const fade = svg.querySelectorAll('[data-fade]')
      if (fade.length) {
        gsap.from(fade, { opacity: 0, y: 10, duration: 0.7, stagger: 0.05, ease: 'power2.out' })
      }
    }, svg)
    return () => ctx.revert()
  }, [reduce, mode])

  const label =
    mode === 'blocked'
      ? 'BLOCKED'
      : mode === 'verified'
        ? 'VERIFIED'
        : mode === 'paying'
          ? 'PAYING'
          : mode === 'analyzing'
            ? 'ANALYZING'
            : mode === 'flagged' || mode === 'approval'
              ? 'REVIEW'
              : 'POLICY IS LAW'

  return (
    <svg
      ref={ref}
      viewBox="0 0 560 560"
      className={cn('h-auto w-full overflow-visible', className)}
      role="img"
      aria-label={`BURSAR finance loop, state ${mode}`}
    >
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="42%" r="54%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.38" />
          <stop offset="42%" stopColor={BLUE} stopOpacity="0.1" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-comet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0" />
          <stop offset="55%" stopColor={BLUE} stopOpacity="0.5" />
          <stop offset="100%" stopColor="#bfdbfe" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`${uid}-hex`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.22" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.04" />
        </linearGradient>
        <filter id={`${uid}-bloom`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={248} fill={`url(#${uid}-glow)`} />

      {HEX_CELLS.map(([x, y]) => (
        <polygon
          key={`${x.toFixed(1)}-${y.toFixed(1)}`}
          points={hexPts(x, y, 11)}
          fill="none"
          stroke="rgba(37,99,235,0.07)"
          strokeWidth={0.7}
        />
      ))}

      {[
        [48, 78],
        [512, 92],
        [36, 214],
        [528, 248],
        [58, 468],
        [508, 452],
        [148, 36],
        [412, 524],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={INK} opacity={0.45} data-pulse />
      ))}

      <polygon points={hexPts(cx, cy, 214)} fill="none" stroke="rgba(37,99,235,0.16)" strokeWidth={1.2} />
      <polygon points={hexPts(cx, cy, 188)} fill="none" stroke="rgba(255,255,255,0.05)" />
      <g data-orbit="28" data-orbit-dir="-1">
        <polygon points={hexPts(cx, cy, 202)} fill="none" stroke="rgba(37,99,235,0.12)" strokeDasharray="3 11" />
      </g>

      <circle cx={cx} cy={cy} r={214} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={5} strokeDasharray="1 15" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={176} fill="none" stroke="rgba(37,99,235,0.14)" strokeDasharray="3 9" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(37,99,235,0.32)" strokeWidth={1.6} />

      <path
        data-path="loop"
        d={`M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx} ${cy + R} A${R} ${R} 0 1 1 ${cx} ${cy - R}`}
        fill="none"
        stroke="none"
      />

      <g data-orbit="12">
        <path
          d={arc(cx, cy, R, -150, -28)}
          fill="none"
          stroke={`url(#${uid}-comet)`}
          strokeWidth={3.2}
          strokeLinecap="round"
          filter={`url(#${uid}-bloom)`}
        />
      </g>
      <g data-orbit="18" data-orbit-dir="-1">
        <circle cx={cx} cy={cy - R} r={3.2} fill="#bfdbfe" filter={`url(#${uid}-bloom)`} />
      </g>

      {STATIONS.map((s) => {
        const p = pol(cx, cy, R - 26, s.deg)
        return (
          <line
            key={`sp-${s.key}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.06)"
          />
        )
      })}

      <circle r="3.4" fill={BLUE} opacity="0" data-travel data-travel-dur="8" data-travel-at="0.18" />
      <circle r="2.4" fill="#bfdbfe" opacity="0" data-travel data-travel-dur="8" data-travel-at="0.62" />
      <g opacity="0" data-travel data-travel-dur="8" data-travel-at="0">
        <rect x="-18" y="-8" width="36" height="16" rx="8" fill="#111113" stroke={BLUE} />
        <text x="0" y="4" textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily={MONO}>
          PDF
        </text>
      </g>
      <g opacity="0" data-travel data-travel-dur="8" data-travel-at="0.48">
        <rect x="-22" y="-8" width="44" height="16" rx="8" fill="#111113" stroke="#4ade80" />
        <text x="0" y="4" textAnchor="middle" fill="#86efac" fontSize="8" fontFamily={MONO}>
          USDC.e
        </text>
      </g>

      {STATIONS.map((s, i) => {
        const p = pol(cx, cy, R, s.deg)
        const c = tone(mode, s.key, active)
        return (
          <g key={s.key}>
            <circle cx={p.x} cy={p.y} r={26} fill="#0c0c0f" />
            <circle cx={p.x} cy={p.y} r={18} fill="none" stroke={c} strokeWidth={1.7} data-seq={i + 1} />
            <circle cx={p.x} cy={p.y} r={18} fill="none" stroke={c} strokeWidth={1} data-blip />
            <circle cx={p.x} cy={p.y} r={5} fill={c} {...(s.key === active ? { 'data-pulse': '' } : {})} />
            <g data-fade>
              <rect x={s.px - 56} y={s.py - 16} width={112} height={32} rx={16} fill="rgba(12,12,15,0.94)" stroke="rgba(255,255,255,0.1)" />
              <circle cx={s.px - 40} cy={s.py} r={3.2} fill={c} />
              <text x={s.px - 30} y={s.py + 4} fill={INK} fontSize="11" fontWeight={600} fontFamily={FACE} letterSpacing="0.12em">
                {s.t}
              </text>
              <text x={s.px} y={s.py + 28} textAnchor="middle" fill="#71717a" fontSize="9" fontFamily={MONO}>
                {s.s}
              </text>
            </g>
          </g>
        )
      })}

      <polygon points={hexPts(cx, cy, 72)} fill={`url(#${uid}-glow)`} opacity={0.85} />
      <circle cx={cx} cy={cy} r={58} fill="#0c0c0f" stroke="rgba(37,99,235,0.5)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={46} fill="none" stroke="rgba(255,255,255,0.06)" />
      <circle cx={cx} cy={cy - 28} r={3} fill={BLUE} data-pulse />
      <text x={cx} y={cy + 2} textAnchor="middle" fill={INK} fontSize="18" fontWeight={800} fontFamily={FACE} letterSpacing="0.16em">
        BURSAR
      </text>
      <text x={cx} y={cy + 20} textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily={MONO} letterSpacing="0.2em">
        {label}
      </text>
    </svg>
  )
}
