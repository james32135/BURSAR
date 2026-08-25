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
  dueDate?: string | null
  rail?: string | null
  nextAction?: 'PAY' | 'OPEN' | 'WHY' | 'PROOF' | 'WAIT'
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
  integrations?: {
    pdf: boolean
    api: boolean
    mcp: boolean
    sdk: boolean
    telegram: boolean
    telegramBot?: string | null
    email: boolean
    emailReason?: string
    emailAddress?: string | null
    slack: boolean
    discord: boolean
  }
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
      paidRecently?: number
      totalUnits: string
      autoApprovedUnits: string
      waitingForYouUnits?: string
      blockedUnits?: string
      paidRecentUnits?: string
      payables: Invoice[]
    }>,
  vendorMemory: () => req('/vendors/memory') as Promise<{
    vendors: Array<{
      remittance: string
      name: string
      trusted?: boolean
      paymentCount: number
      totalPaid: string
      lastAmount: string | null
      lastPaidAt?: string | null
      typicalAmount: string | null
      typicalMin?: string | null
      typicalMax?: string | null
      firstSeen: string | null
      blockCount: number
      lastBlockReason: string | null
      recipients?: string[]
      recipientChanged?: boolean
      frequency?: string | null
    }>
  }>,
  obligations: () =>
    req('/obligations') as Promise<{
      obligations: Array<{
        id: string
        vendor: string
        remittance: string
        cadence: string
        expectedMin: string | null
        expectedMax: string | null
        lastMatchedHash: string | null
      }>
    }>,
  invoice: (hash: string) => req('/invoices/' + hash) as Promise<Invoice>,
  submit: (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return req('/invoices?analyze=1', { method: 'POST', body: form })
  },
  submitPayable: (body: {
    vendor: string
    remittance: string
    amountUsd: string
    invoiceNumber?: string
    memo?: string
    kind?: string
    cadence?: string
    rail?: string
  }) => req('/payables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  pay: (hash: string) => req('/invoices/' + hash + '/pay', { method: 'POST' }),
  analyzeInvoice: (hash: string) => req('/invoices/' + hash + '/analyze', { method: 'POST' }),
  agentBounds: () =>
    req('/workspace/agent-bounds') as Promise<{
      agent: string
      allReverted: boolean
      calls: { fn: string; reverted: boolean; reason: string }[]
      note: string
    }>,
  rotateSession: () =>
    req('/workspace/rotate-session', { method: 'POST' }) as Promise<{
      sessionId: string
      agentAddress: string
      vault: string
      note: string
    }>,
  payAllowed: () =>
    req('/queue/pay-allowed', { method: 'POST' }) as Promise<{
      paid: { invoiceHash?: string; hash?: string; tx?: string; explorer?: string }[]
      failed: { hash?: string; error?: string }[]
      note?: string
    }>,
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
  resumeWorkspace: (body: { signature: string; issuedAt: number }) =>
    fetch('/api/workspaces/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || res.statusText)
      return json as {
        id: string
        owner: string
        vault: string
        sessionId: string
        agentAddress: string
        agentToken: string
        demo: boolean
      }
    }),
  telegramStatus: () =>
    req('/integrations/telegram') as Promise<{
      live: boolean
      bot: string | null
      bound: boolean
      telegramUserId: string | null
      username: string | null
      boundAt: string | null
    }>,
  telegramBindCode: () =>
    req('/integrations/telegram/bind-code', { method: 'POST' }) as Promise<{
      code: string
      expiresAt: string
      bot: string
      deepLink: string
    }>,
  telegramUnbind: () => req('/integrations/telegram/unbind', { method: 'POST' }) as Promise<{ ok: boolean }>,
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

export function attentionFromInvoices(invoices: Invoice[], remaining: bigint | string | number) {
  const cap = BigInt(String(remaining || '0'))
  const open = invoices.filter((i) => i.status !== 'paid')
  const autoPay = invoices.filter(
    (i) => i.status === 'clean' && !i.pay_tx && BigInt(String(i.amount_units || '0')) <= cap
  )
  const ownerReview = invoices.filter((i) => i.status === 'flagged')
  const blocked = invoices.filter((i) => i.status === 'blocked')
  const duplicate = invoices.filter((i) => flagsOf(i).some((f) => f.code.startsWith('duplicate')))
  const paid = invoices.filter((i) => i.status === 'paid' || Boolean(i.pay_tx))
  const totalUnits = open.reduce((n, i) => n + BigInt(String(i.amount_units || '0')), 0n)
  const autoUnits = autoPay.reduce((n, i) => n + BigInt(String(i.amount_units || '0')), 0n)
  const reviewUnits = ownerReview.reduce((n, i) => n + BigInt(String(i.amount_units || '0')), 0n)
  const blockedUnits = blocked.reduce((n, i) => n + BigInt(String(i.amount_units || '0')), 0n)
  const paidUnits = paid.reduce((n, i) => n + BigInt(String(i.amount_units || '0')), 0n)
  return {
    new: open.length,
    autoPay: autoPay.length,
    ownerReview: ownerReview.length,
    blocked: blocked.length,
    duplicate: duplicate.length,
    paidRecently: paid.length,
    totalUnits: totalUnits.toString(),
    autoApprovedUnits: autoUnits.toString(),
    waitingForYouUnits: reviewUnits.toString(),
    blockedUnits: blockedUnits.toString(),
    paidRecentUnits: paidUnits.toString(),
    payables: invoices,
  }
}
