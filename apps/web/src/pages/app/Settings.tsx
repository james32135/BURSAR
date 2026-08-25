import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LIVE } from '@/lib/live'
import { addrUrl } from '@/lib/cn'
import { WalletBar } from '@/components/WalletBar'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { MagneticButton } from '@/components/MagneticButton'
import { api } from '@/lib/api'
import { loadWorkspace } from '@/lib/workspace'
import { useState } from 'react'

const SDK = `import { BursarClient } from '@bursar/sdk'

const bursar = new BursarClient({
  baseUrl: process.env.BURSAR_API_URL,
  token: process.env.BURSAR_WORKSPACE_TOKEN,
})

await bursar.health()
await bursar.attention()
await bursar.submitPayable({ vendor, remittance, amountUsd })
await bursar.vendorMemory()
await bursar.payAllowed()
await bursar.verify(txHash)`

const MCP = `node packages/mcp/src/server.mjs

attention
submit_payable
inspect_invoice
explain_decision
request_approval
execute_allowed_payment
pay_allowed_sequential
get_proof
verify_payment

# forbidden
setVendor withdraw setPaused setBands
createSession transferOwnership ownerPay`

export function Settings() {
  const qc = useQueryClient()
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const health = useQuery({ queryKey: ['health'], queryFn: api.health })
  const tg = useQuery({ queryKey: ['telegram'], queryFn: api.telegramStatus, retry: false })
  const stored = loadWorkspace()
  const owner = wsQ.data?.workspace?.owner || stored?.owner || LIVE.owner
  const vault = wsQ.data?.workspace?.vault || stored?.vault || LIVE.vault
  const session = wsQ.data?.workspace?.sessionId || stored?.sessionId || LIVE.sessionId
  const demo = stored?.demo ?? wsQ.data?.workspace?.demo ?? true
  const channels = health.data?.integrations
  const [bind, setBind] = useState<{ code: string; deepLink: string; expiresAt: string; bot: string } | null>(null)
  const [tgErr, setTgErr] = useState('')
  const issue = useMutation({
    mutationFn: api.telegramBindCode,
    onSuccess: (out) => {
      setTgErr('')
      setBind(out)
      qc.invalidateQueries({ queryKey: ['telegram'] })
    },
    onError: (e) => setTgErr(e instanceof Error ? e.message : String(e)),
  })
  const unbind = useMutation({
    mutationFn: api.telegramUnbind,
    onSuccess: () => {
      setBind(null)
      qc.invalidateQueries({ queryKey: ['telegram'] })
    },
    onError: (e) => setTgErr(e instanceof Error ? e.message : String(e)),
  })

  return (
    <div>
      <PageHeader
        title="Wallet, vault, integrations"
        body="Owner actions need a wallet. Autonomous Band-0 work uses the scoped session key on the API. MetaMask does not open for invoice analysis or allowed pay."
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <AuthorityBadge kind="owner" />
        <WalletBar />
        <Link to="/start" className="text-sm text-[#93c5fd] underline">Create a new workspace</Link>
      </div>
      <dl className="mt-8 grid grid-cols-[140px_1fr] gap-y-3 text-sm">
        <dt className="text-[var(--fg-muted)]">Mode</dt>
        <dd className="font-mono text-xs">{demo ? 'DEMO (shared judge vault)' : 'Your isolated workspace'}</dd>
        <dt className="text-[var(--fg-muted)]">Owner</dt>
        <dd className="break-all font-mono text-xs"><a className="underline" href={addrUrl(owner)}>{owner}</a></dd>
        <dt className="text-[var(--fg-muted)]">Vault</dt>
        <dd className="break-all font-mono text-xs"><a className="underline" href={addrUrl(vault)}>{vault}</a></dd>
        <dt className="text-[var(--fg-muted)]">Session</dt>
        <dd className="break-all font-mono text-xs">{session}</dd>
        <dt className="text-[var(--fg-muted)]">Intake</dt>
        <dd className="text-xs text-[var(--fg-muted)]">
          PDF {channels?.pdf ? 'on' : '—'} · API {channels?.api ? 'on' : '—'} · MCP {channels?.mcp ? 'on' : '—'} · SDK{' '}
          {channels?.sdk ? 'on' : '—'} · Telegram {channels?.telegram ? `live @${channels.telegramBot || 'BURSARxbot'}` : 'adapter only'} · Email{' '}
          {channels?.email ? `live ${channels.emailAddress || ''}` : 'coming later'} · Slack/Discord {channels?.slack || channels?.discord ? 'on' : 'rejected'}
        </dd>
        <dt className="text-[var(--fg-muted)]">Telegram</dt>
        <dd className="text-xs text-[var(--fg-muted)]">
          {channels?.telegram ? (
            <div className="space-y-3 text-[var(--fg)]">
              <p>
                Bot{' '}
                <a className="text-[#93c5fd] underline" href={`https://t.me/${channels.telegramBot || 'BURSARxbot'}`}>
                  t.me/{channels.telegramBot || 'BURSARxbot'}
                </a>
                . One-time bind code, not the MCP token. The bot never receives the owner key.
              </p>
              {tg.data?.bound ? (
                <p className="font-mono text-[11px]">
                  Bound @{tg.data.username || tg.data.telegramUserId} since {tg.data.boundAt}
                </p>
              ) : (
                <p>Not bound to this workspace.</p>
              )}
              {bind && (
                <p className="break-all font-mono text-[11px]">
                  Code {bind.code} · expires {bind.expiresAt}
                  <br />
                  <a className="text-[#93c5fd] underline" href={bind.deepLink}>
                    {bind.deepLink}
                  </a>
                </p>
              )}
              {tgErr && <p className="text-red-400">{tgErr}</p>}
              <div className="flex flex-wrap gap-2">
                <MagneticButton
                  disabled={demo || issue.isPending}
                  onClick={() => issue.mutate()}
                >
                  {issue.isPending ? 'Issuing…' : 'Generate bind code'}
                </MagneticButton>
                {tg.data?.bound && (
                  <MagneticButton variant="ghost" disabled={unbind.isPending} onClick={() => unbind.mutate()}>
                    Unbind Telegram
                  </MagneticButton>
                )}
              </div>
              {demo && <p>DEMO cannot bind Telegram. Create your own workspace.</p>}
            </div>
          ) : (
            'Adapter is in the API. Production has no TELEGRAM_BOT_TOKEN on Render, so the webhook returns 503.'
          )}
        </dd>
        <dt className="text-[var(--fg-muted)]">Email</dt>
        <dd className="text-xs text-[var(--fg-muted)]">
          {channels?.email
            ? `Inbound adapter live for ${channels.emailAddress}. Same TeeML + vault policy as PDF.`
            : 'Email intake coming later. No dedicated inbound mailbox is configured. The adapter exists; health stays false until a real mailbox is set.'}
        </dd>
        <dt className="text-[var(--fg-muted)]">RPC</dt>
        <dd className="font-mono text-xs">{LIVE.rpc}</dd>
        <dt className="text-[var(--fg-muted)]">Model</dt>
        <dd className="font-mono text-xs">{LIVE.model}</dd>
      </dl>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">MCP</h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">Give an existing agent BURSAR access without treasury ownership. Tools: attention, submit_payable, explain_decision, execute_allowed_payment.</p>
          <pre className="mt-4 overflow-auto font-mono text-[11px] text-[var(--fg-muted)]">{MCP}</pre>
        </div>
        <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-xl font-bold">SDK</h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            Auth, invoice, payment, proof, policy read. Package @bursar/sdk 0.1.0.
          </p>
          <pre className="mt-4 overflow-auto font-mono text-[11px] text-[var(--fg-muted)]">{SDK}</pre>
        </div>
      </div>
      <p className="mt-6 text-sm">
        <Link className="text-[#93c5fd] underline" to="/agent">Developer surface</Link>
      </p>
    </div>
  )
}
