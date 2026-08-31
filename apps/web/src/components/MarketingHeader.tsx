import { Link } from 'react-router-dom'
import { MagneticButton } from '@/components/MagneticButton'
import { TelegramMark } from '@/components/TelegramMark'
import { LIVE } from '@/lib/live'

export function MarketingHeader({ light }: { light?: boolean }) {
  const ink = light ? 'text-[#18181b]' : 'text-[#fafafa]'
  const muted = light ? 'text-[#52525b] hover:text-[#09090b]' : 'text-[#a1a1aa] hover:text-white'
  const bar = light
    ? 'border-black/10 bg-[#f4f4f5]/90'
    : 'border-white/10 bg-[#09090b]/90'
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b px-5 backdrop-blur-md md:px-10 ${bar} ${ink}`}
    >
      <Link to="/" className="font-display text-lg font-bold tracking-tight">
        BURSAR
      </Link>
      <nav className={`hidden items-center gap-7 text-sm md:flex ${muted}`}>
        <a href="/#og">0G stack</a>
        <Link to="/start">Desk</Link>
        <Link to="/verify">Verify</Link>
        <Link to="/agent">MCP / SDK</Link>
      </nav>
      <div className="flex items-center gap-2">
        <a
          href={LIVE.telegram}
          target="_blank"
          rel="noreferrer"
          className={`hidden h-9 items-center gap-2 rounded-[4px] px-2 text-xs font-medium md:inline-flex ${muted}`}
        >
          <TelegramMark className="h-4 w-4" />
          @BURSARxbot
        </a>
        <Link
          to="/start"
          className={`hidden h-9 items-center rounded-[4px] border px-3 text-xs font-medium md:inline-flex ${
            light ? 'border-[#09090b]/20' : 'border-white/15'
          }`}
        >
          Get started
        </Link>
        <MagneticButton href="/start" className="h-9 bg-[#18181b] px-3 text-xs uppercase tracking-wide text-white">
          Open console
        </MagneticButton>
      </div>
    </header>
  )
}
