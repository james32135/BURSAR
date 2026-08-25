import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LIVE } from '@/lib/live'
import { addrUrl } from '@/lib/cn'
import { WalletBar } from '@/components/WalletBar'
import { AuthorityBadge, PageHeader } from '@/components/Product'
import { api } from '@/lib/api'
import { loadWorkspace } from '@/lib/workspace'

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
  const wsQ = useQuery({ queryKey: ['workspace'], queryFn: api.workspace, retry: false })
  const health = useQuery({ queryKey: ['health'], queryFn: api.health })
  const stored = loadWorkspace()
  const owner = wsQ.data?.workspace?.owner || stored?.owner || LIVE.owner
  const vault = wsQ.data?.workspace?.vault || stored?.vault || LIVE.vault
  const session = wsQ.data?.workspace?.sessionId || stored?.sessionId || LIVE.sessionId
  const demo = stored?.demo ?? wsQ.data?.workspace?.demo ?? true
  const channels = health.data?.integrations

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
          {channels?.sdk ? 'on' : '—'} · Telegram {channels?.telegram ? 'live' : 'adapter only (no bot token)'} · Email{' '}
          {channels?.email ? 'on' : 'not shipped'} · Slack/Discord {channels?.slack || channels?.discord ? 'on' : 'rejected'}
        </dd>
        <dt className="text-[var(--fg-muted)]">Telegram</dt>
        <dd className="text-xs text-[var(--fg-muted)]">
          {channels?.telegram
            ? 'Bot is live. Send /bind with this workspace token, then a payment request with vendor, amount, and 0x remittance. The bot never receives the owner key.'
            : 'Adapter is in the API. Production has no TELEGRAM_BOT_TOKEN, so the webhook returns 503. Do not treat Telegram as a live intake channel until a bot token is set on Render.'}
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
