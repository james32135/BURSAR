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

