import { api, type Health } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

type Tone = 'live' | 'ready' | 'later'

function chip(label: string, tone: Tone) {
  const cls =
    tone === 'live'
      ? 'border-emerald-500/40 text-emerald-300'
      : tone === 'ready'
        ? 'border-white/20 text-[var(--fg)]'
        : 'border-[var(--border)] text-[var(--fg-muted)]'
  const word = tone === 'live' ? 'LIVE' : tone === 'ready' ? 'READY' : 'COMING LATER'
  return (
    <span key={label} className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 font-mono text-[10px] uppercase ${cls}`}>
      {label}
      <span className="opacity-70">{word}</span>
    </span>
  )
}

export function sourceTones(integrations?: Health['integrations']): { label: string; tone: Tone }[] {
  return [
    { label: 'Web', tone: 'live' },
    { label: 'PDF', tone: integrations?.pdf ? 'live' : 'ready' },
    { label: 'API', tone: integrations?.api ? 'live' : 'ready' },
    { label: 'MCP', tone: integrations?.mcp ? 'live' : 'ready' },
    { label: 'SDK', tone: integrations?.sdk ? 'live' : 'ready' },
    { label: 'Telegram', tone: integrations?.telegram ? 'live' : 'ready' },
    { label: 'Email', tone: integrations?.email ? 'live' : 'later' },
  ]
}

export function SourceChannels({ compact }: { compact?: boolean }) {
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30_000 })
  const items = sourceTones(health.data?.integrations)
  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'mt-4 flex flex-wrap gap-1.5'}>
      {items.map((s) => chip(s.label, s.tone))}
      {!compact && (
        <p className="basis-full pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          Same clerk · same vault · same /verify
        </p>
      )}
    </div>
  )
}
