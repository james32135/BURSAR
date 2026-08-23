import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

const MotionLink = motion(Link)

type Props = {
  children: React.ReactNode
  className?: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'seal'
  type?: 'button' | 'submit'
  disabled?: boolean
}

export function MagneticButton({
  children,
  className,
  href,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
}: Props) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 220, damping: 18 })
  const springY = useSpring(y, { stiffness: 220, damping: 18 })

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left - rect.width / 2) * 0.28)
    y.set((e.clientY - rect.top - rect.height / 2) * 0.28)
  }
  const onLeave = () => {
    x.set(0)
    y.set(0)
  }

  const styles = cn(
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-[4px] text-sm font-medium will-change-transform disabled:opacity-40 disabled:pointer-events-none',
    variant === 'primary' && 'bg-[var(--fg)] text-[var(--bg)]',
    variant === 'ghost' && 'border border-[var(--border)] text-[var(--fg)]',
    variant === 'seal' && 'bg-[var(--accent)] text-white',
    className
  )

  if (href) {
    const external = /^https?:/i.test(href)
    if (external) {
      return (
        <motion.a
          ref={ref as React.RefObject<HTMLAnchorElement>}
          href={href}
          target="_blank"
          rel="noreferrer"
          style={{ x: springX, y: springY }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className={styles}
        >
          {children}
        </motion.a>
      )
    }
    return (
      <MotionLink
        ref={ref as React.RefObject<HTMLAnchorElement>}
        to={href}
        style={{ x: springX, y: springY }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={styles}
      >
        {children}
      </MotionLink>
    )
  }

  return (
    <motion.button
      ref={ref as React.RefObject<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      style={{ x: springX, y: springY }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={styles}
    >
      {children}
    </motion.button>
  )
}
