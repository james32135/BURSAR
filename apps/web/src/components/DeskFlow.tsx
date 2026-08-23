import { cn } from '@/lib/cn'

const STEPS = ['Invoice', 'Private AI', 'Policy', 'Vault', 'Payment', 'Proof'] as const

export function DeskFlow({ active = -1, className }: { active?: number; className?: string }) {
  return (
    <ol className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6', className)} aria-label="Finance desk flow">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={cn(
            'rounded-md border px-3 py-3 text-sm',
            active === i ? 'border-[var(--fg)] bg-[var(--fg)] text-white' : 'border-[var(--border)] bg-white text-[var(--fg-muted)]'
          )}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">{String(i + 1).padStart(2, '0')}</span>
          <div className="mt-1 font-medium text-[var(--fg)]">{label}</div>
        </li>
      ))}
    </ol>
  )
}
