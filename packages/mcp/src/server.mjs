#!/usr/bin/env node
/**
 * Scoped BURSAR MCP. No owner key. No arbitrary calls. No setVendor.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
function loadEnv() {
  const p = resolve(root, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0 && process.env[t.slice(0, i)] === undefined) process.env[t.slice(0, i)] = t.slice(i + 1)
  }
}
loadEnv()

// Production Render API: set BURSAR_API_URL=https://bursar-api.onrender.com
const BASE = (process.env.BURSAR_API_URL || 'http://127.0.0.1:8787').replace(/\/$/, '')
const TOKEN = process.env.BURSAR_MCP_TOKEN_SECRET || ''

async function api(path, init = {}) {
  const headers = { authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) }
  const res = await fetch(BASE + path, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(`http ${res.status}`), { status: res.status, body: json })
  return json
}

const TOOLS = [
  { name: 'submit_invoice', description: 'Upload invoice PDF from a local path. Direct TeeML binding.' },
  { name: 'submit_payable', description: 'Create a payable from vendor, remittance, and amount. Same engine as PDF.' },
  { name: 'inspect_invoice', description: 'Fetch payable metadata by sha256 hash.' },
  { name: 'get_queue', description: 'List payables in this workspace only.' },
  { name: 'attention', description: 'What needs attention: auto-pay, owner review, blocked.' },
  { name: 'vendor_memory', description: 'Persisted vendor history for this workspace.' },
  { name: 'get_payment_queue', description: 'Alias of get_queue.' },
  { name: 'explain_flags', description: 'Explain screening flags.' },
  { name: 'explain_decision', description: 'Why auto-pay, owner-review, or blocked.' },
  { name: 'propose_payment', description: 'Show WHAT/WHO/HOW MUCH without moving money.' },
  { name: 'request_approval', description: 'Same as propose_payment. Does not move money. Human must confirm.' },
  { name: 'execute_allowed_payment', description: 'Band-0 vault USDC.e pay if policy allows.' },
  { name: 'pay_allowed_sequential', description: 'Pay every Band-0 clean payable one session.pay each. No batch opcode.' },
  { name: 'get_payment_status', description: 'Pay tx, status, and amount for a payable in this workspace.' },
  { name: 'get_proof', description: 'Stored proof fields for a payable.' },
  { name: 'verify_payment', description: 'Chain-derived verification of pay tx or invoice hash.' },
]
const FORBIDDEN = new Set(['setVendor', 'withdraw', 'setPaused', 'setBands', 'createSession', 'transferOwnership', 'ownerPay'])

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

async function callTool(name, args) {
  if (FORBIDDEN.has(name)) return { error: 'forbidden' }
  if (name === 'get_payment_queue' || name === 'get_queue') return api('/queue')
  if (name === 'attention') return api('/attention')
  if (name === 'vendor_memory') return api('/vendors/memory')
  if (name === 'pay_allowed_sequential') return api('/queue/pay-allowed', { method: 'POST' })
  if (name === 'inspect_invoice' || name === 'get_proof' || name === 'get_payment_status' || name === 'explain_decision') {
    const inv = await api('/invoices/' + args.hash)
    if (name === 'get_payment_status') {
      return { hash: args.hash, status: inv.status, pay_tx: inv.pay_tx, amount_units: inv.amount_units, remittance: inv.remittance }
    }
    if (name === 'explain_decision') {
      return { hash: args.hash, status: inv.status, decision: inv.decision, why: inv.why, flags: inv.flags }
    }
    return inv
  }
  if (name === 'explain_flags') {
    const inv = await api('/invoices/' + args.hash)
    return { flags: inv.flags, status: inv.status }
  }
  if (name === 'propose_payment' || name === 'request_approval') {
    const inv = await api('/invoices/' + args.hash)
    return {
      what: 'USDC.e transfer from BursarVault to vendor',
      who: inv.remittance,
      howMuch: inv.amount_units,
      why: inv.extracted,
      whichPolicy: 'band0 session cap + vendor allowlist + unique invoice hash',
      sign: false,
      next: 'execute_allowed_payment only if status=clean and amount<=band0',
    }
  }
  if (name === 'execute_allowed_payment') return api('/invoices/' + args.hash + '/pay', { method: 'POST' })
  if (name === 'verify_payment') return fetch(BASE + '/verify/' + (args.tx || args.hash)).then((r) => r.json())
  if (name === 'submit_invoice') {
    const pdf = readFileSync(args.path)
    const form = new FormData()
    form.set('file', new Blob([pdf]), 'invoice.pdf')
    return api('/invoices?analyze=1', { method: 'POST', body: form })
  }
  if (name === 'submit_payable') {
    return api('/payables', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vendor: args.vendor,
        remittance: args.remittance,
        amountUsd: args.amountUsd || args.amount,
        invoiceNumber: args.invoiceNumber,
        memo: args.memo,
        kind: args.kind || 'request',
        source: 'mcp',
      }),
    })
  }
  return { error: 'unknown tool' }
}

async function handle(req) {
  if (req.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: { protocolVersion: '2024-11-05', serverInfo: { name: 'bursar', version: '0.1.0' }, capabilities: { tools: {} } },
    }
  }
  if (req.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: { type: 'object' } })) },
    }
  }
  if (req.method === 'tools/call') {
    const name = req.params?.name
    try {
      const out = await callTool(name, req.params?.arguments || {})
      return { jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: Boolean(out?.error) } }
    } catch (e) {
      return { jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify({ error: e.message, body: e.body }) }], isError: true } }
    }
  }
  return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'method not found' } }
}

let buf = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', async (chunk) => {
  buf += chunk
  const lines = buf.split('\n')
  buf = lines.pop() || ''
  for (const line of lines) {
    if (!line.trim()) continue
    send(await handle(JSON.parse(line)))
  }
})
