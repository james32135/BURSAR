import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, extractedOf, flagsOf, hashOf } from '@/lib/api'
import { addrUrl, txUrl, usd } from '@/lib/cn'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MagneticButton } from '@/components/MagneticButton'
import { InvoicePaper } from '@/components/InvoicePaper'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge } from '@/components/Product'
import { invoiceTrail, ProofTrail } from '@/components/ProofTrail'
import { useState } from 'react'
import { LIVE } from '@/lib/live'
import { loadWorkspace } from '@/lib/workspace'
import { ownerPayInvoice, ensureAristotle } from '@/lib/owner'
import { useOwnerWallet } from '@/components/WalletBar'
import { motion, AnimatePresence } from 'motion/react'

export function InvoiceDetail() {
  const { hash = '' } = useParams()
  const qc = useQueryClient()
  const invQ = useQuery({ queryKey: ['invoice', hash], queryFn: () => api.invoice(hash) })
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const { isOwner, wallet } = useOwnerWallet()
  const [open, setOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [proof, setProof] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')

  const inv = invQ.data
  const flags = inv ? flagsOf(inv) : []
  const ex = inv ? extractedOf(inv) : {}
  const blocked = flags.some((f) => f.severity === 'block')
  const over = flags.some((f) => f.code === 'over-band0')
  const duplicate = flags.some((f) => f.code.startsWith('duplicate'))
  const vendorBad = flags.some((f) => f.code === 'vendor-not-allowlisted')
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const paused = vs?.paused
  const band0 = vs?.band0Max
  const remaining = BigInt(session?.remaining || '0')
  const amountBn = BigInt(String(inv?.amount_units || '0'))
  const overSession = amountBn > remaining
  const canPay = Boolean(inv && inv.status === 'clean' && !inv.pay_tx && !blocked && !paused && !over && !overSession)
  const canOwnerPay = Boolean(inv && over && !inv.pay_tx && !blocked && !paused && !vendorBad && !duplicate && isOwner && inv.storage_root && inv.recovered_signer)
  const vault = wsQ.data?.workspace?.vault || loadWorkspace()?.vault || LIVE.vault

  const pay = useMutation({
    mutationFn: () => api.pay(hash),
    onSuccess: async (res) => {
      setOpen(false)
      const v = await api.verify(res.hash)
      setProof(v)
      qc.invalidateQueries()
    },
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  const ownerPay = useMutation({
    mutationFn: async () => {
      if (!wallet || !inv) throw new Error('owner wallet required')
      const eth = await ensureAristotle(wallet)
      const tx = await ownerPayInvoice(eth, {
        vendor: String(inv.remittance) as `0x${string}`,
        amount: amountBn,
        invoiceHash: hash as `0x${string}`,
        storageRoot: String(inv.storage_root) as `0x${string}`,
        responseHash: (`0x${String(inv.response_hash || '').replace(/^0x/, '')}`) as `0x${string}`,
        recoveredSigner: String(inv.recovered_signer) as `0x${string}`,
      })
      await api.confirmPay(hash, tx)
      return tx
    },
    onSuccess: async (tx) => {
      setOwnerOpen(false)
      const v = await api.verify(tx)
      setProof(v)
      qc.invalidateQueries()
    },
    onError: (e) => setErr(e instanceof Error ? e.message : String(e)),
  })

  if (invQ.isLoading) return <p className="font-mono text-sm text-[var(--fg-muted)]">Loading invoice</p>
  if (!inv) return <p>Invoice not found.</p>
  const id = hashOf(inv)
  const amountLabel = usd(inv.amount_units)

  let cta = 'BLOCKED'
  let why = flags.map((f) => f.detail).join(' ') || 'Policy denied. 0 USDC.e moved.'
  if (inv.pay_tx) {
    cta = 'PAID'
    why = 'USDC.e already moved for this invoice hash.'
  } else if (canPay) {
    cta = 'PAY'
    why = `Band 0 (${usd(band0)}). Vendor allowed. Session authorized. No owner signature.`
  } else if (over) {
    cta = 'REQUEST APPROVAL'
    why = `${amountLabel} exceeds Band 0 (${usd(band0)}). The agent cannot auto-pay. Owner can pay from this screen.`
  } else if (overSession) {
    why = `${amountLabel} exceeds session remaining (${usd(session?.remaining)}). OverCap. 0 USDC.e moved.`
  } else if (duplicate) {
    why = 'Duplicate invoice hash on this vault. 0 USDC.e moved.'
  } else if (vendorBad) {
    why = 'Remittance is not on this vault allowlist. The agent cannot add vendors. 0 USDC.e moved.'
  } else if (paused) {
    why = 'Vault is paused. Session pay will revert. 0 USDC.e moved.'
  }

  return (
    <div>
      <Link to="/app/inbox" className="text-xs text-[var(--fg-muted)] hover:text-white">Inbox</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={inv.status} />
            {canPay ? <AuthorityBadge kind="agent" /> : over ? <AuthorityBadge kind="owner" /> : null}
          </div>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">{ex.vendor_name || inv.vendor || 'Invoice'}</h1>
        </div>
        {canPay ? (
          <MagneticButton variant="seal" onClick={() => setOpen(true)}>PAY</MagneticButton>
        ) : over && !inv.pay_tx ? (
          <MagneticButton variant="ghost" disabled={!canOwnerPay} onClick={() => setOwnerOpen(true)}>
            REQUEST APPROVAL
          </MagneticButton>
        ) : (
          <MagneticButton variant="ghost" disabled>{cta}</MagneticButton>
        )}
      </div>
      <p className="mt-3 max-w-2xl text-sm text-[var(--fg-muted)]">{why}</p>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

