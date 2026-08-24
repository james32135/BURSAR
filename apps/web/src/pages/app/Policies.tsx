import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { loadWorkspace } from '@/lib/workspace'
import { useOwnerWallet } from '@/components/WalletBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MagneticButton } from '@/components/MagneticButton'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { ownerWrite, ensureAristotle, formatOwnerError } from '@/lib/owner'
import { useState } from 'react'

type IntentKind = { kind: 'pause'; pause: boolean }

export function Policies() {
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const product = useQuery({ queryKey: ['product'], queryFn: api.product })
  const { isOwner, wallet } = useOwnerWallet()
  const qc = useQueryClient()
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const vault = wsQ.data?.workspace?.vault || loadWorkspace()?.vault || LIVE.vault
  const [intent, setIntent] = useState<IntentKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const expiry = session?.expiry ? new Date(Number(session.expiry) * 1000).toISOString() : '-'

  async function confirm() {
    if (!intent || !wallet) return
    setBusy(true)
    setErr('')
    try {
      const eth = await ensureAristotle(wallet)
      await ownerWrite(eth, 'setPaused', [intent.pause])
      setIntent(null)
      qc.invalidateQueries({ queryKey: ['workspace'] })
      qc.invalidateQueries({ queryKey: ['health'] })
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy(false)
    }
  }

  const dialogIntent = intent
    ? {
        what: intent.pause ? 'setPaused(true)' : 'setPaused(false)',
        why: intent.pause ? 'Stop all session and owner pays' : 'Resume payments',
        amount: '0. Pause does not transfer USDC.e',
        recipient: vault,
        contract: vault,
        network: '0G Aristotle 16661',
        after: 'Vault.paused updates. Session pay will revert while paused.',
      }
    : null

  return (
    <div>
      <PageHeader
        title="The vault is the law."
        body={`Agents can automatically pay trusted vendors up to ${usd(vs?.band0Max)}. Anything above that requires owner approval.`}
      />
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Band 0</h2>
          <p className="mt-2 text-sm">Autonomous pay to allowlisted vendors up to {usd(vs?.band0Max)}.</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Band 1</h2>
          <p className="mt-2 text-sm">Owner approval required up to {usd(vs?.band1Max)}. Session cannot ownerPay.</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Session limits</h2>
          <p className="mt-2 text-sm">
            Cap {usd(session?.cap)}. Spent {usd(session?.spent)}. Remaining {usd(session?.remaining)}.
          </p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Vendors</h2>
          <p className="mt-2 text-sm">
            {wsQ.data?.workspace?.demo
              ? `${LIVE.remittance} is ${product.data?.remittanceAllowed ? 'allowlisted on the DEMO vault' : 'not allowlisted'}.`
              : 'Vendors are per vault. The agent cannot change this.'}
          </p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Pause</h2>
            <AuthorityBadge kind="owner" />
          </div>
          <p className="mt-2 text-sm">{vs?.paused ? 'Payments are blocked.' : 'Vault is open.'}</p>
          <MagneticButton
            className="mt-4"
            variant="ghost"
            disabled={!isOwner}
            onClick={() => setIntent({ kind: 'pause', pause: !vs?.paused })}
          >
            {isOwner ? (vs?.paused ? 'Resume vault' : 'Pause vault') : 'Owner wallet required'}
          </MagneticButton>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Expiry and revocation</h2>
            <AuthorityBadge kind="owner" />
          </div>
          <p className="mt-2 text-sm">Expires {expiry}. Revoked: {String(session?.revoked)}.</p>
          <p className="mt-3 text-xs text-[var(--fg-muted)]">
            Revoke is owner-only and irreversible for this session id. Do not revoke unless you will recreate the session immediately.
          </p>
        </div>
      </div>
      {err && <p className="mt-4 text-sm text-red-400">{err}</p>}
      <ConfirmDialog
        open={!!intent}
        busy={busy}
        onCancel={() => setIntent(null)}
        onConfirm={confirm}
        title="Owner signature required. MetaMask will open."
        intent={dialogIntent}
      />
    </div>
  )
}
