import { usePrivy, useWallets } from '@privy-io/react-auth'
import { LIVE } from '@/lib/live'
import { isDemoMode, loadWorkspace } from '@/lib/workspace'
import { ensureAristotle } from '@/lib/owner'
import { useState } from 'react'

function expectedOwner() {
  const ws = loadWorkspace()
  if (ws?.owner) return ws.owner.toLowerCase()
  if (isDemoMode()) return LIVE.owner.toLowerCase()
  return ''
}

export function WalletBar() {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const addr = (wallet?.address || user?.wallet?.address || '').toLowerCase()
  const expected = expectedOwner()
  const isOwner = Boolean(addr && expected && addr === expected)
  const [netErr, setNetErr] = useState('')
  const [netBusy, setNetBusy] = useState(false)

  async function onSwitch() {
    if (!wallet) return
    setNetErr('')
    setNetBusy(true)
    try {
      await ensureAristotle(wallet)
    } catch (e) {
      setNetErr(e instanceof Error ? e.message : String(e))
    } finally {
      setNetBusy(false)
    }
  }

  if (!ready) return <span className="font-mono text-[10px] text-[var(--fg-muted)]">wallet</span>

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={() => login()}
        className="h-9 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--fg)]"
      >
        Connect owner
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`hidden font-mono text-[10px] sm:inline ${isOwner ? 'text-emerald-400' : 'text-[var(--fg-muted)]'}`}>
        {isOwner ? 'OWNER' : 'CONNECTED'} {addr.slice(0, 6)}...{addr.slice(-4)}
      </span>
      <button
        type="button"
        onClick={onSwitch}
        disabled={netBusy}
        className="hidden h-9 rounded-[4px] border border-[var(--border)] px-3 text-xs sm:inline"
      >
        {netBusy ? 'Switching…' : '0G Aristotle'}
      </button>
      <button type="button" onClick={() => logout()} className="h-9 rounded-[4px] border border-[var(--border)] px-3 text-xs">
        Disconnect
      </button>
      {netErr && <span className="hidden max-w-[12rem] truncate text-[10px] text-red-400 lg:inline">{netErr}</span>}
    </div>
  )
}

export function useOwnerWallet() {
  const { authenticated } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets[0]
  const addr = (wallet?.address || '').toLowerCase()
  const expected = expectedOwner()
  const isOwner = authenticated && Boolean(addr && expected && addr === expected)
  return { wallet, addr, isOwner, authenticated }
}
