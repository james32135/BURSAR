import { MarketingHeader } from '@/components/MarketingHeader'

const SDK = `npm install @bursar/sdk

import { BursarClient } from '@bursar/sdk'

const bursar = new BursarClient({
  baseUrl: process.env.BURSAR_API_URL,
  token: process.env.BURSAR_WORKSPACE_TOKEN,
})

await bursar.health()
await bursar.policy()
await bursar.attention()
await bursar.createPayable({ vendor, remittance, amountUsd, kind: 'request' })
const payable = await bursar.getPayable(hash)
await bursar.review()
await bursar.explainDecision(hash)
await bursar.vendors()
await bursar.payments()
await bursar.payAllowed()
await bursar.verifyPayment(txHash)`

const MCP = `# stdio MCP. Same HTTP surface as the console.
node packages/mcp/src/server.mjs

attention
submit_payable
inspect_payable
explain_decision
request_approval
execute_allowed_payment
verify_payment
payments
vendors
policy

# forbidden - never treasury ownership
setVendor withdraw setPaused setBands
createSession transferOwnership ownerPay pause revoke addVendor`

export function AgentMcp() {
  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-24">
        <h1 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
          The same clerk, without giving it the treasury.
        </h1>
        <p className="mt-4 max-w-xl text-[#a1a1aa]">
          MCP and @bursar/sdk are clients of the Web and Telegram desk. Same payable engine. Same financial memory. setVendor, withdraw, setPaused, and ownerPay return forbidden.
        </p>
        <h2 className="font-display mt-12 text-xl font-bold">MCP</h2>
        <pre className="mt-3 overflow-auto rounded-[4px] border border-white/10 bg-[#111113] p-4 font-mono text-xs text-[#a1a1aa]">{MCP}</pre>
        <h2 className="font-display mt-10 text-xl font-bold">SDK</h2>
        <p className="mt-2 text-sm text-[#a1a1aa]">
          Auth, payable, attention, payment, proof, policy read. Methods that do not exist are not shown.
        </p>
        <pre className="mt-3 overflow-auto rounded-[4px] border border-white/10 bg-[#111113] p-4 font-mono text-xs text-[#a1a1aa]">{SDK}</pre>
      </main>
    </div>
  )
}
