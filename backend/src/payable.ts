import type { Flag } from './screen.ts'
import { getDb } from './db.ts'

export type Decision = 'auto-pay' | 'owner-review' | 'blocked'

export type VendorMemory = {
  remittance: string
  name: string
  trusted: boolean
  paymentCount: number
  totalPaid: string
  lastAmount: string | null
  lastPaidAt: string | null
  typicalAmount: string | null
  typicalMin: string | null
  typicalMax: string | null
  firstSeen: string | null
  blockCount: number
  lastBlockReason: string | null
  recipients: string[]
  recipientChanged: boolean
  frequency: string | null
  lastPaidHashes: string[]
}

const MEMORY_CODES = new Set([
  'invoice-splice',
  'duplicate-invoice-number',
  'duplicate-paid',
  'duplicate-seen',
  'recipient-changed',
  'amount-anomaly',
  'obligation-out-of-range',
])

function parseJsonField(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value
}

export function memoryInfluence(flags: Flag[]): { next: 'PAY' | 'OPEN' | 'WHY'; lines: string[] } {
  const mem = flags.filter((f) => MEMORY_CODES.has(f.code))
  if (mem.some((f) => f.severity === 'block')) {
    return { next: 'WHY', lines: mem.map((f) => `${f.code}: ${f.detail}`) }
  }
  if (mem.some((f) => f.severity === 'review')) {
    return { next: 'OPEN', lines: mem.map((f) => `${f.code}: ${f.detail}`) }
  }
  return {
    next: 'PAY',
    lines: ['No memory flags. Allowlist, unique hash, and Band 0 still decide. Memory does not own the vault.'],
  }
}

/** Public proof-of-decision. No prompts, keys, or extracted invoice body. */
export function publicDecisionFromInvoiceRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return null
  const flags = (parseJsonField(row.flags) as Flag[] | null) || []
  const storedDecision = String(row.decision || '')
  const amountUnits = row.amount_units != null ? BigInt(String(row.amount_units)) : null
  const decision: Decision =
    storedDecision === 'auto-pay' || storedDecision === 'owner-review' || storedDecision === 'blocked'
      ? storedDecision
      : decide(flags, amountUnits, 200_000000n)
  const why = explainWhy(flags, decision)
  const nextAction = nextActionFor({
    status: String(row.status || ''),
    decision,
    pay_tx: row.pay_tx,
    flags,
  })
  return {
    received: {
      invoiceHash: String(row.invoice_hash || ''),
      source: String(row.source || 'pdf'),
      kind: String(row.kind || 'invoice'),
    },
    stored: {
      storageRoot: row.storage_root ? String(row.storage_root) : null,
      goProofOk: Boolean(row.go_proof_ok),
    },
    computed: {
      recoveredSigner: row.recovered_signer ? String(row.recovered_signer) : null,
      responseHash: row.response_hash ? String(row.response_hash) : null,
      attestation: 'EIP-191 processResponse signer recovery (not a hardware quote)',
    },
    memory: flags.filter((f) => MEMORY_CODES.has(f.code)).map((f) => ({ code: f.code, detail: f.detail })),
    policy: {
      decision: String(row.decision || decision),
      nextAction,
      rail: 'usdc.e-16661',
    },
    money: {
      moved: Boolean(row.pay_tx),
      payTx: row.pay_tx ? String(row.pay_tx) : null,
      amountUnits: amountUnits != null ? amountUnits.toString() : '0',
    },
    why,
  }
}

export function decide(flags: Flag[], amountUnits: bigint | null, band0Max: bigint): Decision {
  if (flags.some((f) => f.severity === 'block')) return 'blocked'
  if (flags.some((f) => f.severity === 'review')) return 'owner-review'
  if (amountUnits != null && amountUnits > band0Max) return 'owner-review'
  return 'auto-pay'
}

export function explainWhy(flags: Flag[], decision: Decision): string[] {
  if (!flags.length && decision === 'auto-pay') {
    return ['Trusted path: known or allowlisted remittance, unique hash, within Band 0, no anomaly.']
  }
  const ordered = [...flags].sort((a, b) => {
    const rank = (f: Flag) => {
      if (
        f.severity === 'block' ||
        f.code === 'invoice-splice' ||
        f.code.startsWith('duplicate') ||
        f.code === 'unsupported-rail' ||
        f.code === 'vendor-not-allowlisted' ||
        f.code === 'bad-remittance' ||
        f.code === 'bad-amount' ||
        f.code === 'extract-failed'
      ) {
        return 0
      }
      if (f.severity === 'review' || f.code === 'over-band0' || f.code === 'recipient-changed' || f.code === 'amount-anomaly' || f.code === 'obligation-out-of-range') {
        return 1
      }
      return 2
    }
    return rank(a) - rank(b)
  })
  return ordered.map((f) => {
    if (f.code === 'duplicate-paid' || f.code === 'duplicate-seen') return `Blocked: this payable hash was already ${f.code === 'duplicate-paid' ? 'paid' : 'ingested'}.`
    if (f.code === 'invoice-splice') return `Blocked: manipulated duplicate. Same invoice number, different amount. ${f.detail}`
    if (f.code === 'duplicate-invoice-number') return `Blocked: invoice number ${f.detail} was already seen for this vendor.`
    if (f.code === 'bad-remittance') return 'Blocked: remittance is missing or not a 20-byte address.'
    if (f.code === 'vendor-not-allowlisted') return `Blocked: ${f.detail} is not on this vault allowlist.`
    if (f.code === 'bad-amount') return 'Blocked: amount could not be parsed as USDC.e units.'
    if (f.code === 'extract-failed') return 'Blocked: Direct TeeML did not return a JSON object.'
    if (f.code === 'over-band0') return `Owner review: amount exceeds Band 0. Session cannot auto-pay. ${f.detail}`
    if (f.code === 'recipient-changed') return `Owner review: vendor recipient changed. ${f.detail}`
    if (f.code === 'amount-anomaly') return `Owner review: amount is far from this vendor typical. ${f.detail}`
    if (f.code === 'unsupported-rail') return f.detail
    if (f.code === 'obligation-out-of-range') return `Owner review: ${f.detail}`
    return `${f.severity === 'block' ? 'Blocked' : 'Owner review'}: ${f.code} ${f.detail}`
  })
}

function frequencyLabel(paidAt: string[]): string | null {
  if (paidAt.length < 2) return null
  const times = paidAt.map((s) => Date.parse(s)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (times.length < 2) return null
  const span = times[times.length - 1] - times[0]
  const avg = span / (times.length - 1)
  const days = avg / 86_400_000
  if (days >= 20 && days <= 40) return 'about monthly'
  if (days >= 5 && days <= 10) return 'about weekly'
  if (days >= 80 && days <= 100) return 'about quarterly'
  return `about every ${Math.max(1, Math.round(days))} days`
}

export async function vendorMemoryFor(workspaceId: string): Promise<VendorMemory[]> {
  const db = await getDb()
  const rows = await db.query(
    `SELECT invoice_hash, remittance, vendor, amount_units, status, flags, created_at, pay_tx, updated_at
     FROM invoices WHERE workspace_id = $1 AND remittance IS NOT NULL AND remittance <> ''
     ORDER BY created_at ASC`,
    [workspaceId]
  )
  const map = new Map<
    string,
    VendorMemory & { amounts: bigint[]; paidAt: string[]; remCounts: Map<string, number>; paidHashes: string[] }
  >()
  for (const row of rows.rows) {
    const rem = String(row.remittance).toLowerCase()
    const nameKey = String(row.vendor || rem).trim() || rem
    const key = nameKey.toLowerCase()
    const cur = map.get(key) || {
      remittance: rem,
      name: nameKey,
      trusted: false,
      paymentCount: 0,
      totalPaid: '0',
      lastAmount: null,
      lastPaidAt: null,
      typicalAmount: null,
      typicalMin: null,
      typicalMax: null,
      firstSeen: String(row.created_at || ''),
      blockCount: 0,
      lastBlockReason: null,
      recipients: [],
      recipientChanged: false,
      frequency: null,
      lastPaidHashes: [],
      amounts: [],
      paidAt: [],
      remCounts: new Map<string, number>(),
      paidHashes: [],
    }
    if (row.vendor) cur.name = String(row.vendor)
    if (!cur.firstSeen) cur.firstSeen = String(row.created_at || '')
    cur.remCounts.set(rem, (cur.remCounts.get(rem) || 0) + 1)
    if (!cur.recipients.includes(rem)) cur.recipients.push(rem)
    if (row.status === 'paid') {
      const amt = BigInt(String(row.amount_units || '0'))
      cur.paymentCount += 1
      cur.totalPaid = (BigInt(cur.totalPaid) + amt).toString()
      cur.lastAmount = amt.toString()
      cur.lastPaidAt = String(row.updated_at || row.created_at || '')
      cur.amounts.push(amt)
      cur.paidAt.push(String(row.updated_at || row.created_at || ''))
      if (row.invoice_hash) cur.paidHashes.push(String(row.invoice_hash))
    }
    if (row.status === 'blocked') {
      cur.blockCount += 1
      const flags = typeof row.flags === 'string' ? JSON.parse(String(row.flags)) : row.flags
      const code = Array.isArray(flags) && flags[0]?.code ? String(flags[0].code) : 'blocked'
      cur.lastBlockReason = code
    }
    map.set(key, cur)
  }
  return [...map.values()].map((v) => {
    const sorted = [...v.amounts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
    const primary = [...v.remCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || v.remittance
    return {
      remittance: primary,
      name: v.name,
      trusted: v.paymentCount > 0 && v.blockCount === 0 && v.recipients.length === 1,
      paymentCount: v.paymentCount,
      totalPaid: v.totalPaid,
      lastAmount: v.lastAmount,
      lastPaidAt: v.lastPaidAt,
      typicalAmount: mid == null ? null : mid.toString(),
      typicalMin: sorted.length ? sorted[0].toString() : null,
      typicalMax: sorted.length ? sorted[sorted.length - 1].toString() : null,
      firstSeen: v.firstSeen,
      blockCount: v.blockCount,
      lastBlockReason: v.lastBlockReason,
      recipients: v.recipients,
      recipientChanged: v.recipients.length > 1,
      frequency: frequencyLabel(v.paidAt),
      lastPaidHashes: v.paidHashes.slice(-5),
    }
  })
}

export function isInvoiceSplice(priorAmountUnits: string, nextAmountUnits: bigint | null): boolean {
  return nextAmountUnits != null && priorAmountUnits !== '' && priorAmountUnits !== nextAmountUnits.toString()
}

export async function memoryFlags(input: {
  workspaceId: string
  invoiceHash?: string
  vendor: string
  remittance: string
  amountUnits: bigint | null
  invoiceNumber: string
}): Promise<Flag[]> {
  const flags: Flag[] = []
  const db = await getDb()
  if (input.invoiceNumber) {
    const dup = await db.query(
      `SELECT invoice_hash, amount_units, status FROM invoices
       WHERE workspace_id = $1
         AND invoice_hash <> $3
         AND (
           extracted->>'invoice_number' = $2
           OR extracted::text ILIKE $4
         )
       ORDER BY CASE WHEN status = 'paid' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
      [
        input.workspaceId,
        input.invoiceNumber,
        input.invoiceHash || '',
        `%"invoice_number":"${input.invoiceNumber}"%`,
      ]
    )
    if (dup.rows[0]) {
      const priorHash = String(dup.rows[0].invoice_hash)
      const priorAmt = dup.rows[0].amount_units != null ? String(dup.rows[0].amount_units) : ''
      const spliced = isInvoiceSplice(priorAmt, input.amountUnits)
      flags.push({
        code: spliced ? 'invoice-splice' : 'duplicate-invoice-number',
        severity: 'block',
        detail: spliced
          ? `${input.invoiceNumber} was ${priorAmt} now ${input.amountUnits} (hash ${priorHash.slice(0, 10)}…)`
          : input.invoiceNumber,
      })
    }
  }
  if (!input.remittance) return flags
  const priorName = await db.query(
    `SELECT remittance FROM invoices
     WHERE workspace_id = $1 AND vendor = $2 AND status = 'paid' AND remittance IS NOT NULL
     ORDER BY updated_at DESC LIMIT 5`,
    [input.workspaceId, input.vendor]
  )
  const seen = priorName.rows.map((r) => String(r.remittance).toLowerCase())
  if (seen.length && !seen.includes(input.remittance.toLowerCase())) {
    flags.push({
      code: 'recipient-changed',
      severity: 'review',
      detail: `last ${seen[0]} now ${input.remittance.toLowerCase()}`,
    })
  }
  const paid = await db.query(
    `SELECT amount_units FROM invoices
     WHERE workspace_id = $1 AND remittance = $2 AND status = 'paid' AND amount_units IS NOT NULL
     ORDER BY updated_at DESC LIMIT 8`,
    [input.workspaceId, input.remittance.toLowerCase()]
  )
  const amounts = paid.rows.map((r) => BigInt(String(r.amount_units)))
  if (input.amountUnits != null && amounts.length >= 2) {
    const sorted = [...amounts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const typical = sorted[Math.floor(sorted.length / 2)]
    if (typical > 0n && input.amountUnits > (typical * 25n) / 10n) {
      flags.push({
        code: 'amount-anomaly',
        severity: 'review',
        detail: `${input.amountUnits} vs typical ${typical}`,
      })
    }
  }
  return flags
}

export function attentionFromRows(
  invoices: Array<{ status: string; amount_units?: unknown; flags?: unknown; pay_tx?: unknown }>,
  remaining: bigint
) {
  const flagsOf = (inv: { flags?: unknown }) => {
    const raw = inv.flags
    if (!raw) return [] as Flag[]
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Flag[]
      } catch {
        return []
      }
    }
    return Array.isArray(raw) ? (raw as Flag[]) : []
  }
  const open = invoices.filter((i) => i.status !== 'paid')
  const autoPay = invoices.filter(
    (i) => i.status === 'clean' && !i.pay_tx && BigInt(String(i.amount_units || '0')) <= remaining
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
  }
}

export function nextActionFor(inv: {
  status?: string
  decision?: string | null
  pay_tx?: unknown
  flags?: unknown
}): 'PAY' | 'OPEN' | 'WHY' | 'PROOF' | 'WAIT' {
  if (inv.pay_tx || inv.status === 'paid') return 'PROOF'
  const flags = Array.isArray(inv.flags) ? (inv.flags as Flag[]) : []
  if (inv.status === 'blocked' || flags.some((f) => f.severity === 'block')) return 'WHY'
  if (inv.status === 'flagged' || inv.decision === 'owner-review') return 'OPEN'
  if (inv.status === 'clean' || inv.decision === 'auto-pay') return 'PAY'
  return 'WAIT'
}
