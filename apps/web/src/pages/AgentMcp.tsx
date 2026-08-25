import { Link } from 'react-router-dom'
import { MagneticButton } from '@/components/MagneticButton'

const SDK = `npm install @bursar/sdk

import { BursarClient } from '@bursar/sdk'

const bursar = new BursarClient({
  baseUrl: process.env.BURSAR_API_URL,
  token: process.env.BURSAR_WORKSPACE_TOKEN,
})

const health = await bursar.health()
const policy = await bursar.policy()
const submitted = await bursar.submitInvoice(pdfBytes, true)
const attention = await bursar.attention()
const memory = await bursar.vendorMemory()
const queue = await bursar.queue()
const invoice = await bursar.getInvoice(submitted.invoiceHash)
const paid = await bursar.pay(submitted.invoiceHash)
const status = await bursar.getPaymentStatus(submitted.invoiceHash)
const proof = await bursar.verify(paid.hash)
const ready = await bursar.waitForDecision(submitted.invoiceHash)`

const MCP = `# stdio MCP. Same HTTP surface as the console.
node packages/mcp/src/server.mjs

submit_invoice
submit_payable
attention
vendor_memory
explain_decision
execute_allowed_payment
pay_allowed_sequential`

export function AgentMcp() {
  return (
    <div className="min-h-[100dvh] bg-[#09090b] text-[#fafafa]">
      <div className="grain" aria-hidden />
      <header className="flex h-16 items-center justify-between px-6 md:px-10">
        <Link to="/" className="font-display text-lg font-bold">BURSAR</Link>
        <div className="flex gap-2">
          <MagneticButton href="/start" variant="ghost" className="border-white/15 text-white">Get started</MagneticButton>
          <MagneticButton href="/app" className="bg-white text-[#09090b]">Open console</MagneticButton>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="font-display max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
          Give your existing agent access to BURSAR without giving it treasury ownership.
        </h1>
        <p className="mt-4 max-w-xl text-[#a1a1aa]">
          MCP and @bursar/sdk call the same scoped API. setVendor, withdraw, setPaused, and ownerPay return forbidden.
        </p>
        <h2 className="font-display mt-12 text-xl font-bold">MCP</h2>
        <pre className="mt-3 overflow-auto rounded-[4px] border border-white/10 bg-[#111113] p-4 font-mono text-xs text-[#a1a1aa]">{MCP}</pre>
        <h2 className="font-display mt-10 text-xl font-bold">SDK</h2>
        <p className="mt-2 text-sm text-[#a1a1aa]">
          Auth, invoice, payment, proof, policy read. Methods that do not exist are not shown.
        </p>
        <pre className="mt-3 overflow-auto rounded-[4px] border border-white/10 bg-[#111113] p-4 font-mono text-xs text-[#a1a1aa]">{SDK}</pre>
      </main>
    </div>
  )
}
