const STEPS = [
  { id: 'received', label: 'Received' },
  { id: 'encrypting', label: 'Encrypting' },
  { id: 'stored', label: 'Stored' },
  { id: 'analyzing', label: 'Private analysis' },
  { id: 'checking_vendor', label: 'Vendor' },
  { id: 'checking_policy', label: 'Policy' },
  { id: 'ready', label: 'Ready' },
  { id: 'paying', label: 'Paying' },
  { id: 'confirmed', label: 'Confirmed' },
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
  const current = pipeline || ''
  return (
    <ol className="mt-6 flex flex-wrap gap-1">
      {STEPS.filter((s) => s.id !== 'blocked' || current === 'blocked' || seen.has('blocked')).map((s) => {
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
