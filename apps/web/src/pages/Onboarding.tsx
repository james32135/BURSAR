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
