import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

gsap.registerPlugin(MotionPathPlugin)

export type DeskMode = 'idle' | 'analyzing' | 'flagged' | 'approval' | 'paying' | 'paid' | 'blocked' | 'verified'

const STATIONS = [
  { key: 'invoice', t: 'INVOICE', s: 'artifact in', deg: -90, px: 280, py: 52 },
  { key: 'ai', t: 'PRIVATE AI', s: 'Direct TeeML', deg: -30, px: 470, py: 128 },
  { key: 'policy', t: 'POLICY', s: 'bands + vendors', deg: 30, px: 470, py: 372 },
  { key: 'vault', t: 'VAULT', s: 'final authority', deg: 90, px: 280, py: 508 },
  { key: 'usdc', t: 'USDC.e', s: 'transfer only', deg: 150, px: 90, py: 372 },
  { key: 'proof', t: 'PROOF', s: 'chain + Go', deg: 210, px: 90, py: 128 },
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

function tone(mode: DeskMode, key: string, active: string) {
  if (mode === 'blocked' && key === 'vault') return '#dc2626'
  if (mode === 'flagged' && key === 'policy') return '#d97706'
  if (mode === 'verified' && key === 'proof') return '#16a34a'
  if (mode === 'paid' && (key === 'usdc' || key === 'proof')) return '#16a34a'
  if (key === active) return '#2563eb'
  return 'rgba(250,250,250,0.55)'
}

/** BURSAR execution desk — original six-station finance loop. */
export function HeroDesk({ className, mode = 'idle' }: { className?: string; mode?: DeskMode }) {
  const ref = useRef<SVGSVGElement>(null)
  const reduce = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const cx = 280
  const cy = 280
  const R = 138
  const active = MODE_LIT[mode]

  useEffect(() => {
    const svg = ref.current
    if (!svg || reduce) return
    const ctx = gsap.context(() => {
      gsap.to(svg.querySelectorAll('[data-spin]'), {
        rotation: 360,
        duration: 22,
        repeat: -1,
        ease: 'none',
        svgOrigin: `${cx} ${cy}`,
      })
      gsap.to(svg.querySelectorAll('[data-spin-rev]'), {
        rotation: -360,
        duration: 32,
        repeat: -1,
        ease: 'none',
        svgOrigin: `${cx} ${cy}`,
      })
      const path = svg.querySelector<SVGPathElement>('[data-path="loop"]')
      svg.querySelectorAll<SVGElement>('[data-ride]').forEach((el, i) => {
        if (!path) return
        gsap.set(el, { opacity: 1 })
        gsap.to(el, {
          motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
          duration: 8,
          ease: 'none',
          repeat: -1,
          delay: i * 2.4,
        })
      })
      gsap.to(svg.querySelectorAll('[data-pulse]'), {
        opacity: 0.35,
        duration: 1.2,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        stagger: 0.12,
      })
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
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label={`BURSAR finance loop, state ${mode}`}
    >
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.42" />
          <stop offset="70%" stopColor="#2563eb" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-comet`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={232} fill={`url(#${uid}-glow)`} />
      <circle cx={cx} cy={cy} r={214} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={5} strokeDasharray="1 15" strokeLinecap="round" data-spin />
      <circle cx={cx} cy={cy} r={192} fill="none" stroke="rgba(255,255,255,0.06)" />
      <circle cx={cx} cy={cy} r={176} fill="none" stroke="rgba(37,99,235,0.14)" strokeDasharray="3 9" data-spin-rev />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(37,99,235,0.28)" strokeWidth={1.5} />
      <path
        data-path="loop"
        d={`M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx} ${cy + R} A${R} ${R} 0 1 1 ${cx} ${cy - R}`}
        fill="none"
        stroke="none"
      />
      <g data-spin>
        <path
          d={`M${cx} ${cy - R} A${R} ${R} 0 0 1 ${cx + R * 0.7} ${cy - R * 0.7}`}
          fill="none"
          stroke={`url(#${uid}-comet)`}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
      <circle r="3.5" fill="#93c5fd" opacity="0" data-ride />
      <g opacity="0" data-ride>
        <rect x="-16" y="-8" width="32" height="16" rx="8" fill="#111113" stroke="#2563eb" />
        <text x="0" y="4" textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily="IBM Plex Mono, monospace">
          PDF
        </text>
      </g>
      {STATIONS.map((s) => {
        const p = pol(cx, cy, R, s.deg)
        const c = tone(mode, s.key, active)
        return (
          <g key={s.key}>
            <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" />
            <circle cx={p.x} cy={p.y} r={22} fill="#0c0c0f" />
            <circle cx={p.x} cy={p.y} r={16} fill="none" stroke={c} strokeWidth={1.6} />
            <circle cx={p.x} cy={p.y} r={4.5} fill={c} {...(s.key === active ? { 'data-pulse': '' } : {})} />
            <rect x={s.px - 58} y={s.py - 16} width={116} height={32} rx={16} fill="rgba(12,12,15,0.94)" stroke="rgba(255,255,255,0.1)" />
            <circle cx={s.px - 40} cy={s.py} r={3.2} fill={c} />
            <text x={s.px - 30} y={s.py + 4} fill="#fafafa" fontSize="11" fontWeight={600} fontFamily="Instrument Sans, sans-serif" letterSpacing="0.12em">
              {s.t}
            </text>
            <text x={s.px} y={s.py + 28} textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="IBM Plex Mono, monospace">
              {s.s}
            </text>
          </g>
        )
      })}
      <circle cx={cx} cy={cy} r={58} fill="#0c0c0f" stroke="rgba(37,99,235,0.45)" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fafafa" fontSize="18" fontWeight={700} fontFamily="Instrument Sans, sans-serif" letterSpacing="0.14em">
        BURSAR
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#93c5fd" fontSize="8" fontFamily="IBM Plex Mono, monospace" letterSpacing="0.18em">
        {label}
      </text>
    </svg>
  )
}
