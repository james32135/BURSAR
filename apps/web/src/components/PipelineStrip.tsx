const STEPS = [
  { id: 'received', label: 'Received' },
  { id: 'encrypting', label: 'Encrypted' },
  { id: 'stored', label: 'Storage verified' },
  { id: 'analyzing', label: 'Private AI' },
  { id: 'checking_vendor', label: 'Vendor check' },
  { id: 'checking_policy', label: 'Policy check' },
  { id: 'ready', label: 'Decision' },
  { id: 'paying', label: 'Pay' },
  { id: 'confirmed', label: 'Chain confirmed' },
  { id: 'verified', label: 'Proof verified' },
  { id: 'blocked', label: 'Blocked' },
] as const

export function PipelineStrip({
  pipeline,
  events,
}: {
  pipeline?: string | null
  events?: { kind: string }[]
}) {
  const seen = new Set((events || []).map((e) => e.kind))
  let current = pipeline || ''
  if (current === 'queued') current = 'received'
  if (current === 'encrypted') current = 'encrypting'
  if (seen.has('encrypting')) seen.add('encrypting')
  if (pipeline === 'queued' || pipeline === 'received') seen.add('received')
  return (
    <ol className="mt-6 flex flex-wrap gap-1">
      {STEPS.filter((s) => {
        if (s.id === 'blocked') return current === 'blocked' || seen.has('blocked')
        if ((current === 'blocked' || seen.has('blocked')) && (s.id === 'paying' || s.id === 'confirmed' || s.id === 'verified')) return false
        return true
      }).map((s) => {
        const on = seen.has(s.id) || s.id === current
        const active = s.id === current
        return (
          <li
            key={s.id}
            className={`rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase ${
              active
                ? 'border-white bg-white text-[#09090b]'
                : on
                  ? 'border-emerald-500/40 text-emerald-300'
                  : 'border-[var(--border)] text-[var(--fg-muted)]'
            }`}
          >
            {s.label}
          </li>
        )
      })}
    </ol>
  )
}
