import { isDemoMode, loadWorkspace } from '@/lib/workspace'

export type Flag = { code: string; severity: string; detail: string }
export type Invoice = {
  invoiceHash?: string
  invoice_hash?: string
  status: string
  flags?: Flag[] | string
  extracted?: Record<string, string> | string | null
  vendor?: string | null
  remittance?: string | null
  amount_units?: number | string | null
  pay_tx?: string | null
  storage_root?: string | null
  flow_tx?: string | null
  tx_seq?: number | null
  go_proof_ok?: boolean
  attestation_ok?: boolean
  recovered_signer?: string | null
  response_hash?: string | null
  created_at?: string
  source?: string
  kind?: string
  pipeline?: string
  decision?: string
  why?: string[]
}

export type Health = {
  ok: boolean
  chainId: number
  vault: string
  owner: string
  explorer: string
  vaultState: { usdc: string; paused: boolean; band0Max: string; band1Max: string; policyVersion: string; owner: string }
  session: {
    id: string
    agent: string
    cap: string
    spent: string
    remaining: string
    expiry: string
    revoked: boolean
    exists: boolean
  }
  bindingPath: string
  settlement: string
  visionModel: string
  teeSigner: string
  usdc: string
  privacy: string
}

async function req(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const ws = loadWorkspace()
  if (ws?.agentToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${ws.agentToken}`)
  } else if (!headers.has('authorization') && isDemoMode()) {
    headers.set('x-bursar-demo', '1')
  }
  const res = await fetch('/api' + path, { ...init, headers })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || res.statusText) as Error & { status: number; body: unknown }
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

export const api = {
  health: () => fetch('/api/health').then((r) => r.json() as Promise<Health>),
  product: () => fetch('/api/product').then((r) => r.json()),
  queue: () => req('/queue') as Promise<{ invoices: Invoice[] }>,
  attention: () =>
    req('/attention') as Promise<{
      new: number
      autoPay: number
      ownerReview: number
      blocked: number
      duplicate: number
      totalUnits: string
      autoApprovedUnits: string
      payables: Invoice[]
    }>,
  vendorMemory: () => req('/vendors/memory') as Promise<{
    vendors: Array<{
      remittance: string
      name: string
      paymentCount: number
      totalPaid: string
      lastAmount: string | null
      typicalAmount: string | null
      firstSeen: string | null
      blockCount: number
      lastBlockReason: string | null
    }>
  }>,
  invoice: (hash: string) => req('/invoices/' + hash) as Promise<Invoice>,
  submit: (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return req('/invoices?analyze=1', { method: 'POST', body: form })
  },
  submitPayable: (body: { vendor: string; remittance: string; amountUsd: string; invoiceNumber?: string; memo?: string; kind?: string }) =>
    req('/payables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  pay: (hash: string) => req('/invoices/' + hash + '/pay', { method: 'POST' }),
  payAllowed: () => req('/queue/pay-allowed', { method: 'POST' }),
  confirmPay: (hash: string, tx?: string) =>
    req('/invoices/' + hash + '/confirm-pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tx }),
    }),
  policy: () => req('/policy'),
  verify: (id: string) => fetch('/api/verify/' + id).then((r) => r.json()),
  events: () => req('/events') as Promise<{ events: { id: number; invoice_hash: string; kind: string; detail: unknown; created_at: string }[] }>,
  workspace: () => req('/workspace') as Promise<{
    workspace: { id: string; owner: string; vault: string; sessionId: string; agentAddress: string; demo: boolean }
    vaultState: Health['vaultState']
    session: Health['session']
    remittanceAllowed?: boolean
    stats: { processed: number; paid: number; blocked: number; escalated: number; autoPayReady: number; routedUnits: string; policyViolations: number }
  }>,
  bindWorkspace: (body: { vault: string; signature: string; issuedAt: number }) =>
    req('/workspaces', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as Promise<{
      id: string
      owner: string
      vault: string
      sessionId: string
      agentAddress: string
      agentToken: string
      demo: boolean
    }>,
}

export function flagsOf(inv: Invoice): Flag[] {
  const raw = inv.flags
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }
  return Array.isArray(raw) ? raw : []
}

export function extractedOf(inv: Invoice): Record<string, string> {
  const raw = inv.extracted
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return raw
}

export function hashOf(inv: Invoice) {
  return inv.invoiceHash || inv.invoice_hash || ''
}
