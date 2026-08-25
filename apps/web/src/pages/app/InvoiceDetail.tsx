import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { api, extractedOf, flagsOf, hashOf } from '@/lib/api'
import { addrUrl, txUrl, usd } from '@/lib/cn'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MagneticButton } from '@/components/MagneticButton'
import { InvoicePaper } from '@/components/InvoicePaper'
import { StatusChip } from '@/components/StatusChip'
import { AuthorityBadge } from '@/components/Product'
import { PipelineStrip } from '@/components/PipelineStrip'
import { ProofTrail, invoiceTrail } from '@/components/ProofTrail'
import { useState } from 'react'
import { LIVE } from '@/lib/live'
import { loadWorkspace } from '@/lib/workspace'
import { ownerPayInvoice, ensureAristotle } from '@/lib/owner'
import { useOwnerWallet } from '@/components/WalletBar'
import { motion, AnimatePresence } from 'motion/react'

export function InvoiceDetail() {
  const { hash = '' } = useParams()
  const qc = useQueryClient()
  const invQ = useQuery({ queryKey: ['invoice', hash], queryFn: () => api.invoice(hash), refetchInterval: 4000 })
  const eventsQ = useQuery({ queryKey: ['events'], queryFn: api.events, refetchInterval: 4000 })
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
  const recipientChanged = flags.some((f) => f.code === 'recipient-changed')
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const paused = vs?.paused
  const band0 = vs?.band0Max
  const remaining = BigInt(session?.remaining || '0')
  const amountBn = BigInt(String(inv?.amount_units || '0'))
  const overSession = amountBn > remaining
  const canPay = Boolean(
    inv &&
      !inv.pay_tx &&
      !blocked &&
      !paused &&
      !over &&
      !overSession &&
      (inv.status === 'clean' || inv.decision === 'auto-pay')
  )
  const needsOwner = Boolean(inv && !inv.pay_tx && !blocked && (over || recipientChanged || inv.decision === 'owner-review'))
  const canOwnerPay = Boolean(
    inv &&
      (over || recipientChanged || inv.decision === 'owner-review') &&
      !inv.pay_tx &&
      !blocked &&
      !paused &&
      !vendorBad &&
      !duplicate &&
      isOwner &&
      inv.storage_root &&
      inv.recovered_signer
  )
  const canAnalyze = Boolean(inv && (inv.status === 'stored' || inv.pipeline === 'stored') && !inv.pay_tx)
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

  const analyze = useMutation({
    mutationFn: () => api.analyzeInvoice(hash),
    onSuccess: () => {
      setErr('')
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

  if (invQ.isLoading) return <p className="font-mono text-sm text-[var(--fg-muted)]">Loading payable</p>
  if (!inv) return <p>Payable not found.</p>
  const id = hashOf(inv)
  const amountLabel = usd(inv.amount_units)

  let cta = 'BLOCKED'
  let whyText = flags.map((f) => f.detail).join(' ') || 'Policy denied. 0 USDC.e moved.'
  if (inv.pay_tx) {
    cta = 'PAID'
    whyText = 'USDC.e already moved for this payable hash.'
  } else if (blocked) {
    cta = 'BLOCKED'
    whyText = flags.map((f) => `${f.code}: ${f.detail}`).join(' ') || 'Policy denied. 0 USDC.e moved.'
  } else if (canPay) {
    cta = 'PAY'
    whyText = `Band 0 (${usd(band0)}). Vendor allowed. Session authorized. No owner signature.`
  } else if (over) {
    cta = 'REQUEST APPROVAL'
    whyText = `${amountLabel} exceeds Band 0 (${usd(band0)}). The agent cannot auto-pay. Owner can pay from this screen.`
  } else if (overSession) {
    whyText = `${amountLabel} exceeds session remaining (${usd(session?.remaining)}). OverCap. 0 USDC.e moved.`
  } else if (duplicate) {
    whyText = 'Duplicate invoice hash on this vault. 0 USDC.e moved.'
  } else if (vendorBad) {
    whyText = 'Remittance is not on this vault allowlist. The agent cannot add vendors. 0 USDC.e moved.'
  } else if (paused) {
    whyText = 'Vault is paused. Session pay will revert. 0 USDC.e moved.'
  }
  const decisionLines = Array.isArray(inv.why) && inv.why.length ? inv.why : [whyText]
  const mine = (eventsQ.data?.events || []).filter((e) => String(e.invoice_hash) === hash)

  return (
    <div>
      <Link to="/app/inbox" className="text-xs text-[var(--fg-muted)] hover:text-white">Inbox</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={inv.status} />
            {canPay ? <AuthorityBadge kind="agent" /> : needsOwner ? <AuthorityBadge kind="owner" /> : null}
          </div>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight">{ex.vendor_name || inv.vendor || 'Payable'}</h1>
          <p className="mt-1 font-mono text-[10px] uppercase text-[var(--fg-muted)]">
            {inv.source || 'pdf'} · {inv.kind || 'invoice'} · {inv.rail || 'usdc.e-16661'} · due {inv.dueDate || '—'} · {inv.decision || inv.status} · next {inv.nextAction || '—'}
          </p>
        </div>
        {canAnalyze ? (
          <MagneticButton variant="ghost" disabled={analyze.isPending} onClick={() => analyze.mutate()}>
            {analyze.isPending ? 'Analyzing leftover…' : 'Analyze leftover'}
          </MagneticButton>
        ) : canPay ? (
          <MagneticButton variant="seal" onClick={() => setOpen(true)}>PAY</MagneticButton>
        ) : needsOwner ? (
          <MagneticButton variant="ghost" disabled={!canOwnerPay} onClick={() => setOwnerOpen(true)}>
            APPROVE
          </MagneticButton>
        ) : (
          <MagneticButton variant="ghost" disabled>{cta}</MagneticButton>
        )}
      </div>
      <div className="mt-3 max-w-2xl space-y-1">
        {decisionLines.map((line) => (
          <p key={line} className="text-sm text-[var(--fg-muted)]">{line}</p>
        ))}
      </div>
      <PipelineStrip pipeline={inv.pipeline || inv.status} events={mine} />
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}

      {needsOwner && (
        <section className="mt-8 rounded-[4px] border border-amber-400/40 bg-amber-500/5 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">Owner approval required</p>
          <h2 className="font-display mt-2 text-2xl font-bold">The agent cannot pay this.</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Why</dt>
              <dd className="mt-1">{over ? 'Over autonomous Band 0 limit' : recipientChanged ? 'Recipient is different from this vendor’s previous approved address.' : decisionLines[0]}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Amount</dt>
              <dd className="mt-1">{amountLabel}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Recipient</dt>
              <dd className="mt-1 break-all font-mono text-xs">{inv.remittance || '-'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Last recipient</dt>
              <dd className="mt-1 break-all font-mono text-xs">{flags.find((f) => f.code === 'recipient-changed')?.detail || 'Same allowlisted remittance, or none paid yet.'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Policy</dt>
              <dd className="mt-1">{over ? 'Band 1 / owner-only' : 'Vendor memory + owner review'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase text-[var(--fg-muted)]">Evidence</dt>
              <dd className="mt-1">Storage {inv.go_proof_ok ? 'verified' : 'pending'} · AI {inv.attestation_ok ? 'EIP-191 signer recovered' : 'missing'} · duplicate {duplicate ? 'yes' : 'no'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-[var(--fg-muted)]">
            APPROVE opens the owner wallet. The agent still cannot withdraw, change policy, or add vendors.
          </p>
          <MagneticButton className="mt-4" variant="ghost" disabled={!canOwnerPay} onClick={() => setOwnerOpen(true)}>
            APPROVE
          </MagneticButton>
        </section>
      )}

      <div className="mt-8">
        <InvoicePaper inv={inv} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Evidence</h2>
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-[var(--fg-muted)]">Payable ID</dt><dd className="font-mono text-xs">{ex.invoice_number || '-'}</dd>
            <dt className="text-[var(--fg-muted)]">Hash</dt><dd className="break-all font-mono text-xs">{id}</dd>
            <dt className="text-[var(--fg-muted)]">Storage</dt><dd className="break-all font-mono text-xs">{inv.storage_root}</dd>
            <dt className="text-[var(--fg-muted)]">Flow tx</dt>
            <dd className="break-all font-mono text-xs">
              {inv.flow_tx ? <a className="text-[#93c5fd] underline" href={txUrl(inv.flow_tx)}>{inv.flow_tx}</a> : '-'}
            </dd>
            <dt className="text-[var(--fg-muted)]">Go proof</dt><dd>{inv.go_proof_ok ? 'Succeeded to validate the downloaded file' : '-'}</dd>
            <dt className="text-[var(--fg-muted)]">AI signer</dt>
            <dd className="break-all font-mono text-xs">
              <a className="text-[#93c5fd] underline" href={addrUrl(inv.recovered_signer || LIVE.teeSigner)}>{inv.recovered_signer || LIVE.teeSigner}</a>
            </dd>
            <dt className="text-[var(--fg-muted)]">Attestation</dt><dd>{inv.attestation_ok ? 'EIP-191 signer recovered (not a hardware quote)' : 'missing'}</dd>
            <dt className="text-[var(--fg-muted)]">Session</dt><dd>{session?.revoked ? 'revoked' : 'scoped Band 0'}</dd>
            <dt className="text-[var(--fg-muted)]">Vault</dt><dd className="break-all font-mono text-xs">{vault}</dd>
          </dl>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Audit trail</h2>
          <div className="mt-4">
            <ProofTrail steps={invoiceTrail(inv)} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-xl font-bold">Policy decision</h2>
        {flags.length ? flags.map((f) => (
          <p key={f.code} className="mt-3 border-l-2 border-red-500 pl-3 text-sm"><strong>{f.code}</strong> {f.detail}</p>
        )) : inv.pay_tx ? (
          <p className="mt-3 text-sm text-emerald-300">Paid. USDC.e moved. This vault will not pay this hash again.</p>
        ) : (
          <p className="mt-3 text-sm text-[var(--fg-muted)]">No blocking flags. Band 0 session may pay if the vault is open.</p>
        )}
        {inv.pay_tx && (
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <a className="text-[#93c5fd] underline" href={txUrl(inv.pay_tx)}>Open ChainScan</a>
            <Link className="text-[#93c5fd] underline" to={'/app/proof/' + inv.pay_tx}>Verify on 0G</Link>
          </p>
        )}
      </div>

      <AnimatePresence>
        {proof && (
          <motion.pre
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 overflow-auto rounded-[4px] border border-emerald-500/30 bg-[var(--surface)] p-4 font-mono text-[11px] text-[var(--fg-muted)]"
          >
            {JSON.stringify(proof, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={open}
        busy={pay.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => pay.mutate()}
        confirmLabel="Execute session pay"
        title="Autonomous session action. No wallet prompt after this confirm."
        intent={{
          what: 'USDC.e.transfer from this workspace BursarVault (session pay)',
          why: 'Band 0 allowlisted vendor, unique invoice hash, recovered TEE signer',
          amount: amountLabel,
          recipient: String(inv.remittance || ''),
          contract: vault,
          network: '0G Aristotle 16661',
          after: 'On-chain transfer, then /verify from Paid + USDC.e Transfer + Go proof',
        }}
      />
      <ConfirmDialog
        open={ownerOpen}
        busy={ownerPay.isPending}
        onCancel={() => setOwnerOpen(false)}
        onConfirm={() => ownerPay.mutate()}
        confirmLabel="Owner pay"
        title="Owner signature required. MetaMask will open."
        intent={{
          what: 'BursarVault.ownerPay (owner wallet, not the agent)',
          why: 'Amount is above Band 0. Agent cannot auto-pay.',
          amount: amountLabel,
          recipient: String(inv.remittance || ''),
          contract: vault,
          network: '0G Aristotle 16661',
          after: 'Paid event on this vault only. Agent still cannot withdraw.',
        }}
      />
    </div>
  )
}
