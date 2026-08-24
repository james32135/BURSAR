import { NavLink, Outlet, Link, Navigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn, usd } from '@/lib/cn'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { WalletBar } from '@/components/WalletBar'
import { WorkflowRail } from '@/components/Product'
import { isDemoMode, loadWorkspace } from '@/lib/workspace'

const NAV = [
  { to: '/app', end: true, label: 'Workspace' },
  { to: '/app/inbox', label: 'Inbox' },
  { to: '/app/review', label: 'Review' },
  { to: '/app/payments', label: 'Payments' },
  { to: '/app/vendors', label: 'Vendors' },
  { to: '/app/policies', label: 'Policy' },
  { to: '/app/agent', label: 'Agent' },
  { to: '/app/proof', label: 'Proof' },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 20_000 })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const stored = loadWorkspace()
  const demo = isDemoMode()
  const paused = (wsQ.data?.vaultState || (demo ? health.data?.vaultState : undefined))?.paused
  const usdc = (wsQ.data?.vaultState || (demo ? health.data?.vaultState : undefined))?.usdc
  if (!stored && !demo) return <Navigate to="/start" replace />

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--fg)]">
      <div className="grain" aria-hidden />
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[#09090b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
          <button type="button" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg font-bold tracking-tight">BURSAR</Link>
          <nav className="ml-2 hidden min-w-0 items-center gap-0.5 overflow-x-auto lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-[4px] px-2.5 py-1.5 text-[13px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]',
                    isActive && 'bg-white text-[#09090b]'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-muted)]">
                {demo ? 'DEMO workspace' : 'Your workspace'}
              </div>
              <div className={cn('text-xs font-medium', paused ? 'text-red-400' : 'text-emerald-400')}>
                {paused ? 'PAUSED' : 'OPEN'} {usd(usdc)}
              </div>
            </div>
            <Link to="/app/settings" className="hidden text-xs text-[var(--fg-muted)] hover:text-white lg:inline">
              Settings
            </Link>
            <WalletBar />
          </div>
        </div>
      </header>
      <div className="mx-auto hidden max-w-7xl px-4 pt-4 md:px-6 lg:block">
        <WorkflowRail />
      </div>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--border)] bg-[#09090b] p-5 transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!open}
        hidden={!open}
      >
        <div className="mb-8 flex items-center justify-between">
          <span className="font-display text-lg font-bold">BURSAR</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn('rounded-[4px] px-3 py-2.5 text-sm text-[var(--fg-muted)]', isActive && 'bg-white text-[#09090b]')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <NavLink
            to="/app/settings"
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn('rounded-[4px] px-3 py-2.5 text-sm text-[var(--fg-muted)]', isActive && 'bg-white text-[#09090b]')
            }
          >
            Settings
          </NavLink>
        </nav>
        <div className="mt-8">
          <WorkflowRail />
        </div>
      </aside>
      {open && (
        <button type="button" className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close overlay" onClick={() => setOpen(false)} />
      )}
      <main className="mx-auto max-w-7xl px-4 py-8 pb-16 md:px-6">
        <Outlet />
      </main>
    </div>
  )
}
