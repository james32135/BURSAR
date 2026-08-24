import { MagneticButton } from './MagneticButton'

export function ConfirmDialog({
  open,
  intent,
  onCancel,
  onConfirm,
  busy,
  confirmLabel,
  title,
}: {
  open: boolean
  intent: { what: string; why: string; amount?: string; recipient?: string; contract: string; network: string; after: string } | null
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
  confirmLabel?: string
  title?: string
}) {
  if (!open || !intent) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-[4px] border border-[var(--border)] bg-[#111113] p-6 text-[#fafafa] shadow-xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#93c5fd]">{title || 'Confirm'}</p>
        <h2 className="font-display mt-2 text-2xl font-bold">Confirm this action</h2>
        <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
          <dt className="text-[var(--fg-muted)]">WHAT</dt><dd>{intent.what}</dd>
          <dt className="text-[var(--fg-muted)]">WHY</dt><dd>{intent.why}</dd>
          <dt className="text-[var(--fg-muted)]">HOW MUCH</dt><dd>{intent.amount || 'no token transfer from this call'}</dd>
          <dt className="text-[var(--fg-muted)]">WHO</dt><dd className="break-all font-mono text-xs">{intent.recipient || '-'}</dd>
          <dt className="text-[var(--fg-muted)]">CONTRACT</dt><dd className="break-all font-mono text-xs">{intent.contract}</dd>
          <dt className="text-[var(--fg-muted)]">NETWORK</dt><dd>{intent.network}</dd>
          <dt className="text-[var(--fg-muted)]">NEXT</dt><dd>{intent.after}</dd>
        </dl>
        <div className="mt-6 flex gap-2">
          <MagneticButton variant="seal" onClick={onConfirm} disabled={busy}>{busy ? 'Working' : confirmLabel || 'Sign'}</MagneticButton>
          <MagneticButton variant="ghost" onClick={onCancel}>Cancel</MagneticButton>
        </div>
      </div>
    </div>
  )
}
