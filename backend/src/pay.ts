import { getDb, recordEvent } from './db.ts'
import { onchainInvoice, sessionPay, sessionState, vaultState, vendorAllowed } from './vault.ts'
import type { Workspace } from './workspace.ts'

export const EXPECTED_TEE_SIGNER = '0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0'

export type PayResult =
  | { ok: true; hash: string; explorer: string; preVault: string; postVault: string; preVendor: string; postVendor: string; moneyMoved: string }
  | { ok: false; error: string; status?: number; flags?: unknown; result?: unknown }

export function payGateReason(input: {
  status: string
  decision?: string | null
  flags: { code?: string; severity?: string }[]
  attestationOk: boolean
  paused: boolean
  revoked: boolean
  exists: boolean
  expiry: number
  now: number
  amount: bigint
  band0: bigint
  remaining: bigint
  vaultUsdc: bigint
  vendorAllowed: boolean
  recoveredSigner: string
  pipeline?: string | null
  updatedAt?: string | null
}): { error: string; status: number } | null {
  if (input.status === 'paid') return { error: 'already paid', status: 409 }
  if (!input.attestationOk) return { error: 'attestation missing', status: 400 }
  if (input.status === 'flagged' || input.decision === 'owner-review') return { error: 'owner-review', status: 400 }
  if (input.flags.some((f) => f.severity === 'block')) return { error: 'blocked', status: 400 }
  if (input.flags.some((f) => f.severity === 'review')) return { error: 'owner-review', status: 400 }
  if (input.paused) return { error: 'paused', status: 400 }
  if (input.revoked || !input.exists) return { error: 'session-revoked', status: 400 }
  if (input.expiry > 0 && input.now >= input.expiry) return { error: 'session-expired', status: 400 }
  if (input.amount > input.band0) return { error: 'over-band0', status: 400 }
  if (input.amount > input.remaining) return { error: 'over-session-cap', status: 400 }
  if (input.vaultUsdc < input.amount) return { error: 'insufficient-vault-balance', status: 400 }
  if (!input.vendorAllowed) return { error: 'vendor-not-allowlisted', status: 400 }
  if (input.recoveredSigner && input.recoveredSigner.toLowerCase() !== EXPECTED_TEE_SIGNER.toLowerCase()) {
    return { error: 'invalid-signer', status: 400 }
  }
  if (input.pipeline === 'paying' && input.updatedAt) {
    const t = Date.parse(input.updatedAt)
    if (Number.isFinite(t) && Date.now() - t < 120_000) return { error: 'pay-in-flight', status: 409 }
  }
  return null
}

export async function executeAllowedPay(ws: Workspace, hash: string): Promise<PayResult> {
  const db = await getDb()
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [ws.id, hash])
  const inv = rows.rows[0]
  if (!inv) return { ok: false, error: 'not found', status: 404 }
  const chain = await onchainInvoice(ws, hash)
  if (chain.paid) return { ok: false, error: 'already paid', status: 409 }
  const flags = typeof inv.flags === 'string' ? JSON.parse(String(inv.flags)) : inv.flags || []
  const remittance = String(inv.remittance || '')
  const amount = BigInt(String(inv.amount_units || '0'))
  const vs = await vaultState(ws)
  const session = await sessionState(ws)
  const gate = payGateReason({
    status: String(inv.status),
    decision: inv.decision == null ? null : String(inv.decision),
    flags: Array.isArray(flags) ? flags : [],
    attestationOk: inv.attestation_ok === true || inv.attestation_ok === 't',
    paused: vs.paused,
    revoked: session.revoked,
    exists: session.exists,
    expiry: Number(session.expiry || 0),
    now: Math.floor(Date.now() / 1000),
    amount,
    band0: BigInt(vs.band0Max),
    remaining: BigInt(session.remaining),
    vaultUsdc: BigInt(vs.usdc),
    vendorAllowed: /^0x[a-fA-F0-9]{40}$/.test(remittance) ? await vendorAllowed(ws, remittance) : false,
    recoveredSigner: String(inv.recovered_signer || ''),
    pipeline: inv.pipeline == null ? null : String(inv.pipeline),
    updatedAt: inv.updated_at == null ? null : String(inv.updated_at),
  })
  if (gate) return { ok: false, error: gate.error, status: gate.status, flags }
  await db.query("UPDATE invoices SET pipeline='paying', updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2", [
    ws.id,
    hash,
  ])
  await recordEvent(ws.id, hash, 'paying', { amount: amount.toString(), remittance })
  const result = await sessionPay(ws, {
    vendor: remittance,
    amount,
    invoiceHash: hash,
    storageRoot: String(inv.storage_root),
    responseHash: '0x' + String(inv.response_hash).replace(/^0x/, ''),
    recoveredSigner: String(inv.recovered_signer),
  })
  if (!result.didMoneyMove) {
    await recordEvent(ws.id, hash, 'pay-failed', result)
    await db.query("UPDATE invoices SET pipeline='ready', updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2", [
      ws.id,
      hash,
    ])
    return { ok: false, error: 'money-did-not-move', status: 500, result }
  }
  await db.query(
    "UPDATE invoices SET status='paid', pipeline='confirmed', pay_tx=$3, pay_session=$4, updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2",
    [ws.id, hash, result.hash, ws.sessionId]
  )
  await recordEvent(ws.id, hash, 'confirmed', result)
  return {
    ok: true,
    hash: result.hash,
    explorer: result.explorer,
    preVault: result.preVault,
    postVault: result.postVault,
    preVendor: result.preVendor,
    postVendor: result.postVendor,
    moneyMoved: result.moneyMoved,
  }
}
