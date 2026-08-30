import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usd } from '@/lib/cn'
import { LIVE } from '@/lib/live'
import { loadWorkspace, saveWorkspace } from '@/lib/workspace'
import { useOwnerWallet } from '@/components/WalletBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MagneticButton } from '@/components/MagneticButton'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { ownerWrite, ensureAristotle, formatOwnerError } from '@/lib/owner'
import { useState } from 'react'

type IntentKind =
  | { kind: 'pause'; pause: boolean }
  | { kind: 'vendor'; vendor: `0x${string}` }
  | { kind: 'revoke' }
  | { kind: 'recreate' }

export function Policies() {
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const product = useQuery({ queryKey: ['product'], queryFn: api.product })
  const bounds = useQuery({ queryKey: ['agent-bounds'], queryFn: api.agentBounds, retry: false })
  const { isOwner, wallet } = useOwnerWallet()
  const qc = useQueryClient()
  const vs = wsQ.data?.vaultState
  const session = wsQ.data?.session
  const vault = wsQ.data?.workspace?.vault || loadWorkspace()?.vault || LIVE.vault
  const stored = loadWorkspace()
  const [intent, setIntent] = useState<IntentKind | null>(null)
  const [vendor, setVendor] = useState(stored?.owner || LIVE.owner)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const expiry = session?.expiry ? new Date(Number(session.expiry) * 1000).toISOString() : '-'

  async function confirm() {
    if (!intent || !wallet) return
    setBusy(true)
    setErr('')
    try {
      const eth = await ensureAristotle(wallet)
      if (intent.kind === 'pause') {
        await ownerWrite(eth, 'setPaused', [intent.pause])
      } else if (intent.kind === 'vendor') {
        await ownerWrite(eth, 'setVendor', [intent.vendor, true])
      } else if (intent.kind === 'revoke') {
        await ownerWrite(eth, 'revokeSession', [session?.id || stored?.sessionId])
      } else if (intent.kind === 'recreate') {
        const rotated = await api.rotateSession()
        const next = { ...(stored || loadWorkspace()) }
        if (!next?.agentToken) throw new Error('workspace token missing in this browser')
        saveWorkspace({
          id: next.id,
          owner: next.owner,
          vault: next.vault,
          sessionId: rotated.sessionId,
          agentAddress: rotated.agentAddress || next.agentAddress,
          agentToken: next.agentToken,
          demo: false,
        })
        const cap = 200_000_000n
        const until = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30)
        await ownerWrite(eth, 'createSession', [
          rotated.sessionId as `0x${string}`,
          (rotated.agentAddress || next.agentAddress) as `0x${string}`,
          cap,
          until,
        ])
      }
      setIntent(null)
      qc.invalidateQueries({ queryKey: ['workspace'] })
      qc.invalidateQueries({ queryKey: ['health'] })
      qc.invalidateQueries({ queryKey: ['agent-bounds'] })
    } catch (e) {
      setErr(formatOwnerError(e))
    } finally {
      setBusy(false)
    }
  }

  const dialogIntent = !intent
    ? null
    : intent.kind === 'pause'
      ? {
          what: intent.pause ? 'setPaused(true)' : 'setPaused(false)',
          why: intent.pause ? 'Stop all session and owner pays' : 'Resume payments',
          amount: '0. Pause does not transfer USDC.e',
          recipient: vault,
          contract: vault,
          network: '0G Aristotle 16661',
          after: 'Vault.paused updates. Session pay will revert while paused.',
        }
      : intent.kind === 'vendor'
        ? {
            what: 'setVendor(address, true)',
            why: 'Owner allowlists a remittance. The agent cannot do this.',
            amount: '0. Allowlist does not transfer USDC.e',
            recipient: intent.vendor,
            contract: vault,
            network: '0G Aristotle 16661',
            after: 'vendorAllowed[address] = true. Session still cannot raise bands.',
          }
        : intent.kind === 'revoke'
          ? {
              what: 'revokeSession(bytes32)',
              why: 'Kill this scoped agent session. Irreversible for this session id.',
              amount: '0. Revoke does not transfer USDC.e',
              recipient: session?.agent || stored?.agentAddress || '',
              contract: vault,
              network: '0G Aristotle 16661',
              after: 'session.pay reverts Revoked. Recreate immediately with a new session id.',
            }
          : {
              what: 'rotate session id + createSession',
              why: 'The previous session id cannot be reused after revoke. Owner signs a new session.',
              amount: 'Cap 200 USDC.e / 30 days',
              recipient: stored?.agentAddress || session?.agent || '',
              contract: vault,
              network: '0G Aristotle 16661',
              after: 'New session exists. Agent still cannot withdraw, setVendor, or setBands.',
            }

  return (
    <div>
      <PageHeader
        title="The vault is the law."
        body={`Agents can automatically pay trusted vendors up to ${usd(vs?.band0Max)}. Anything above that requires owner approval. The agent cannot rewrite these rules.`}
      />
      <div className="mt-6 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-lg font-bold">Why was a payment blocked?</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--fg-muted)]">
          <li>Unknown vendor: remittance is not on this vault allowlist.</li>
          <li>Changed recipient: this vendor's previous approved address is different.</li>
          <li>Over Band 0: amount exceeds the autonomous limit.</li>
          <li>Duplicate: this payable hash was already ingested or paid.</li>
          <li>Paused / revoked / expired: the owner stopped the session.</li>
        </ul>
        <p className="mt-3 text-xs text-[var(--fg-muted)]">Open the payable for technical details: contract, session, hash, tx.</p>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Band 0: autonomous</h2>
          <p className="mt-2 text-sm">The agent may pay allowlisted vendors up to {usd(vs?.band0Max)} without a wallet prompt.</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Band 1: owner only</h2>
          <p className="mt-2 text-sm">Above Band 0, up to {usd(vs?.band1Max)}, the owner must sign. The agent cannot ownerPay.</p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Session limits</h2>
          <p className="mt-2 text-sm">
            Cap {usd(session?.cap)}. Spent {usd(session?.spent)}. Remaining {usd(session?.remaining)}.
          </p>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Vendors</h2>
            <AuthorityBadge kind="owner" />
          </div>
          <p className="mt-2 text-sm">
            {wsQ.data?.workspace?.demo
              ? `${LIVE.remittance} is ${product.data?.remittanceAllowed ? 'allowlisted on the DEMO vault' : 'not allowlisted'}.`
              : 'Vendors are per vault. The agent cannot change this.'}
          </p>
          <input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            aria-label="Vendor remittance"
            className="mt-3 h-9 w-full rounded-[4px] border border-[var(--border)] bg-[#09090b] px-3 font-mono text-xs"
          />
          <MagneticButton
            className="mt-3"
            variant="ghost"
            disabled={!isOwner || !/^0x[a-fA-F0-9]{40}$/.test(vendor)}
            onClick={() => setIntent({ kind: 'vendor', vendor: vendor as `0x${string}` })}
          >
            {isOwner ? 'Allow this remittance' : 'Owner wallet required'}
          </MagneticButton>
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
            Revoke is owner-only and irreversible for this session id. Recreate issues a new id and createSession immediately after.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MagneticButton
              variant="ghost"
              disabled={!isOwner || Boolean(session?.revoked)}
              onClick={() => setIntent({ kind: 'revoke' })}
            >
              Revoke session
            </MagneticButton>
            <MagneticButton disabled={!isOwner} onClick={() => setIntent({ kind: 'recreate' })}>
              Recreate session
            </MagneticButton>
          </div>
        </div>
        <div className="md:col-span-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">Agent bounds (on-chain staticCall)</h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {bounds.data?.note || 'The scoped agent key must revert on owner-only writes.'}
          </p>
          {bounds.data?.calls?.length ? (
            <ul className="mt-3 space-y-1 font-mono text-xs">
              {bounds.data.calls.map((c) => (
                <li key={c.fn}>
                  {c.fn}: {c.reverted ? `reverted (${c.reason})` : 'UNEXPECTED SUCCESS'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--fg-muted)]">{bounds.isError ? 'Could not read agent bounds.' : 'Loading…'}</p>
          )}
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
