import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

const NODES = ['INVOICE', 'PRIVATE AI', 'POLICY', 'VAULT', 'USDC.e', 'PROOF'] as const

/** Directed financial execution system — BURSAR objects, not a generic orbit. */
export function OrbitSystem({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let t = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const { width, height } = parent.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5
      const cy = h * 0.5
      const rRing = Math.min(w, h) * 0.34
      const rNode = Math.min(w, h) * 0.38

      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(155,44,44,${0.06 + i * 0.03})`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 8 + i])
        ctx.arc(cx, cy, rRing - i * 18, 0, Math.PI * 2)
        ctx.stroke()
      }

      const pts = NODES.map((_, n) => {
        const a = -Math.PI / 2 + (n / NODES.length) * Math.PI * 2
        return { x: cx + Math.cos(a) * rNode, y: cy + Math.sin(a) * rNode, a }
      })

      ctx.setLineDash([])
      ctx.beginPath()
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.strokeStyle = 'rgba(155,44,44,0.35)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      const flow = (t * 0.12) % 1
      const seg = flow * NODES.length
      const i0 = Math.floor(seg) % NODES.length
      const i1 = (i0 + 1) % NODES.length
      const f = seg - Math.floor(seg)
      const px = pts[i0].x + (pts[i1].x - pts[i0].x) * f
      const py = pts[i0].y + (pts[i1].y - pts[i0].y) * f
      const pulse = ctx.createRadialGradient(px, py, 0, px, py, 16)
      pulse.addColorStop(0, 'rgba(155,44,44,0.9)')
      pulse.addColorStop(1, 'rgba(155,44,44,0)')
      ctx.fillStyle = pulse
      ctx.beginPath()
      ctx.arc(px, py, 16, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = '#efe8d8'
      ctx.arc(px, py, 3.2, 0, Math.PI * 2)
      ctx.fill()

      pts.forEach((p, n) => {
        const active = n === i0
        ctx.beginPath()
        ctx.fillStyle = n === 3 ? '#9b2c2c' : active ? '#fafafa' : 'rgba(250,250,250,0.7)'
        ctx.arc(p.x, p.y, n === 3 ? 5 : 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '500 10px "IBM Plex Mono", monospace'
        ctx.fillStyle = 'rgba(212,212,216,0.95)'
        ctx.textAlign = 'center'
        const lx = p.x + Math.cos(p.a) * 22
        const ly = p.y + Math.sin(p.a) * 22
        ctx.fillText(NODES[n], lx, ly)
      })

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64)
      g.addColorStop(0, 'rgba(155,44,44,0.55)')
      g.addColorStop(1, 'rgba(155,44,44,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, 64, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '700 15px Fraunces, serif'
      ctx.fillStyle = '#fafafa'
      ctx.textAlign = 'center'
      ctx.fillText('BURSAR', cx, cy - 2)
      ctx.font = '400 9px "IBM Plex Mono", monospace'
      ctx.fillStyle = 'rgba(161,161,170,0.9)'
      ctx.fillText('policy is law', cx, cy + 14)

      if (!reduce) {
        t += 0.016
        raf = requestAnimationFrame(draw)
      }
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [reduce])

  return (
    <div className={className || 'absolute inset-0 overflow-hidden'}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_22%,#09090b_90%)]" />
    </div>
  )
}
