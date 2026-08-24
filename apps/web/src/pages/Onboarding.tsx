import { Link, useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { LIVE } from '@/lib/live'
import { WalletBar, useOwnerWallet } from '@/components/WalletBar'
import { MagneticButton } from '@/components/MagneticButton'
import { AuthorityBadge } from '@/components/Product'
import { api } from '@/lib/api'
import { createVault, fundVault, ownerWrite, signBind, ensureAristotle, formatOwnerError } from '@/lib/owner'
import { enterDemo, loadWorkspace, saveWorkspace } from '@/lib/workspace'
import { addrUrl } from '@/lib/cn'

export default function Onboarding() {
  const nav = useNavigate()
  const { ready, authenticated, login } = usePrivy()
  const { wallet, addr, authenticated: authed } = useOwnerWallet()
  const existing = loadWorkspace()
  const [step, setStep] = useState(existing && !existing.demo ? 3 : 0)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [vault, setVault] = useState(existing && !existing.demo ? existing.vault : '')
  const [bound, setBound] = useState<{ sessionId: string; agentAddress: string; agentToken: string; id: string } | null>(
    existing && !existing.demo
      ? { sessionId: existing.sessionId, agentAddress: existing.agentAddress, agentToken: existing.agentToken, id: existing.id }
      : null
  )
  const [sessionOk, setSessionOk] = useState(false)
  const [vendorOk, setVendorOk] = useState(false)
  const [funded, setFunded] = useState(false)

  useEffect(() => {
    if (!existing || existing.demo) return
    let cancelled = false
    api.workspace().then((ws) => {
      if (cancelled) return
      setSessionOk(Boolean(ws.session?.exists && !ws.session?.revoked))
      setVendorOk(typeof ws.remittanceAllowed === 'boolean' ? ws.remittanceAllowed : Boolean(ws.session?.exists))
      setFunded(BigInt(ws.vaultState?.usdc || '0') > 0n)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [existing?.id])

  async function eth() {
    if (!wallet) throw new Error('Connect the owner wallet first')
    return ensureAristotle(wallet)
  }

  async function onCreateVault() {
    setErr('')
    setBusy('Switching MetaMask to 0G Aristotle…')
    try {
      const provider = await eth()
      setBusy('Waiting for owner signature to create vault…')
      const out = await createVault(provider)
      setVault(out.vault)
      setStep(2)
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy('')
    }
  }

  async function onBind() {
    setErr('')
    setBusy('Sign to bind this workspace…')
    try {
      const issuedAt = Math.floor(Date.now() / 1000)
      const sig = await signBind(await eth(), vault, issuedAt)
      const created = await api.bindWorkspace({ vault, signature: sig.signature, issuedAt })
      saveWorkspace({
        id: created.id,
        owner: created.owner,
        vault: created.vault,
        sessionId: created.sessionId,
        agentAddress: created.agentAddress,
        agentToken: created.agentToken,
        demo: false,
      })
      setBound(created)
      setStep(3)
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy('')
    }
  }

  async function onSession() {
    if (!bound) return
    setErr('')
    setBusy('Authorize scoped agent…')
    try {
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30)
      await ownerWrite(await eth(), 'createSession', [bound.sessionId as `0x${string}`, bound.agentAddress as `0x${string}`, 200_000_000n, expiry])
      setSessionOk(true)
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy('')
    }
  }

  async function onVendor() {
    setErr('')
    setBusy('Allow remittance address…')
    try {
      await ownerWrite(await eth(), 'setVendor', [LIVE.remittance as `0x${string}`, true])
      setVendorOk(true)
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy('')
    }
  }

  async function onFund() {
    setErr('')
    setBusy('Transfer 0.002 USDC.e into the vault…')
    try {
      await fundVault(await eth(), 2000n)
      setFunded(true)
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy('')
    }
  }

  function onDemo() {
    enterDemo()
    nav('/app')
  }

  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <header className="flex h-16 items-center justify-between px-6">
        <Link to="/" className="font-display text-lg font-bold">BURSAR</Link>
        <WalletBar />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Connect the owner wallet. Create a vault the agent cannot own.
        </h1>
        <p className="mt-4 max-w-xl text-[#a1a1aa]">
          Each workspace is a separate BursarVault. The agent never receives the owner key, seed, or withdraw rights.
        </p>

        <ol className="mt-10 space-y-4">
          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Connect owner wallet</h2>
              <AuthorityBadge kind="owner" />
            </div>
            <p className="mt-2 font-mono text-xs text-[#a1a1aa]">{!ready ? 'wallet…' : authed ? addr : 'Not connected'}</p>
            {!authenticated && (
              <MagneticButton className="mt-4" onClick={() => login()}>Connect owner wallet</MagneticButton>
            )}
          </li>

          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Create vault</h2>
              <AuthorityBadge kind="owner" />
            </div>
            <p className="mt-2 text-sm text-[#a1a1aa]">
              Factory {LIVE.factory.slice(0, 10)}… deploys a BursarVault you own on Aristotle. Band 0 $200. Band 1 $10,000.
            </p>
            {vault ? (
              <p className="mt-2 break-all font-mono text-xs">
                <a className="text-[#93c5fd] hover:text-white" href={addrUrl(vault)}>{vault}</a>
              </p>
            ) : (
              <MagneticButton className="mt-4" disabled={!authed || Boolean(busy)} onClick={onCreateVault}>
                Create vault
              </MagneticButton>
            )}
          </li>

          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <h2 className="font-display text-lg font-bold">Bind workspace</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">Signs a bind message. Server stores a scoped agent key. Token is shown once.</p>
            {bound ? (
              <p className="mt-2 font-mono text-xs">Workspace {bound.id} · agent {bound.agentAddress.slice(0, 10)}…</p>
            ) : (
              <MagneticButton className="mt-4" disabled={!vault || Boolean(busy)} onClick={onBind}>
                Bind workspace
              </MagneticButton>
            )}
            {bound?.agentToken && step >= 3 && (
              <p className="mt-3 break-all font-mono text-[10px] text-[#a1a1aa]">MCP token stored in this browser. Copy it for SDK/MCP. It is not the owner key.</p>
            )}
          </li>

          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Authorize scoped agent</h2>
              <AuthorityBadge kind="owner" />
            </div>
            <p className="mt-2 text-sm text-[#a1a1aa]">createSession: agent can register and Band-0 pay only. Cap $200. 30 days.</p>
            <MagneticButton className="mt-4" disabled={!bound || sessionOk || Boolean(busy)} onClick={onSession}>
              {sessionOk ? 'Session authorized' : 'Authorize agent'}
            </MagneticButton>
          </li>

          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <h2 className="font-display text-lg font-bold">Allow a vendor</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">Test remittance {LIVE.remittance}. The agent cannot add vendors.</p>
            <MagneticButton className="mt-4" disabled={!sessionOk || vendorOk || Boolean(busy)} onClick={onVendor}>
              {vendorOk ? 'Vendor allowed' : 'Allow remittance'}
            </MagneticButton>
          </li>

          <li className="rounded-[4px] border border-white/10 bg-[#111113] p-5">
            <h2 className="font-display text-lg font-bold">Fund vault</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">Owner transfers USDC.e to the vault. This sends 0.002 USDC.e (2000 units) if you hold it.</p>
            <MagneticButton className="mt-4" disabled={!vendorOk || funded || Boolean(busy)} onClick={onFund}>
              {funded ? 'Funded' : 'Fund 0.002 USDC.e'}
            </MagneticButton>
            {(funded || bound) && (
              <MagneticButton className="mt-3" variant="ghost" href="/app/inbox">
                Open inbox
              </MagneticButton>
            )}
          </li>
        </ol>

        {busy && <p className="mt-6 font-mono text-xs text-[#93c5fd]">{busy}</p>}
        {err && <p className="mt-4 border-l-2 border-red-500 pl-3 text-sm text-red-300">{err}</p>}

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-sm text-[#a1a1aa]">Judges can open the labeled DEMO vault. It is not your workspace.</p>
          <button type="button" onClick={onDemo} className="mt-3 text-sm text-white underline">
            Open DEMO workspace
          </button>
        </div>
      </main>
    </div>
  )
}
