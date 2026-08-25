import { getDb, recordEvent } from './db.ts'
import { sessionPay, sessionState, vaultState, vendorAllowed } from './vault.ts'
import type { Workspace } from './workspace.ts'

export type PayResult =
  | { ok: true; hash: string; explorer: string; preVault: string; postVault: string; preVendor: string; postVendor: string; moneyMoved: string }
  | { ok: false; error: string; status?: number; flags?: unknown; result?: unknown }

export async function executeAllowedPay(ws: Workspace, hash: string): Promise<PayResult> {
  const db = await getDb()
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [ws.id, hash])
  const inv = rows.rows[0]
  if (!inv) return { ok: false, error: 'not found', status: 404 }
  if (inv.status === 'paid') return { ok: false, error: 'already paid', status: 409 }
  if (inv.attestation_ok !== true && inv.attestation_ok !== 't') {
    return { ok: false, error: 'attestation missing', status: 400 }
  }
  const flags = typeof inv.flags === 'string' ? JSON.parse(String(inv.flags)) : inv.flags
  if (Array.isArray(flags) && flags.some((f: { severity: string }) => f.severity === 'block')) {
    return { ok: false, error: 'blocked', status: 400, flags }
  }
  const remittance = String(inv.remittance || '')
  const amount = BigInt(String(inv.amount_units || '0'))
  const vs = await vaultState(ws)
  const session = await sessionState(ws)
  if (vs.paused) return { ok: false, error: 'paused', status: 400 }
  if (session.revoked || !session.exists) return { ok: false, error: 'session-revoked', status: 400 }
  if (amount > BigInt(vs.band0Max)) return { ok: false, error: 'over-band0', status: 400 }
  if (amount > BigInt(session.remaining)) return { ok: false, error: 'over-session-cap', status: 400 }
  if (BigInt(vs.usdc) < amount) return { ok: false, error: 'insufficient-vault-balance', status: 400 }
  if (!(await vendorAllowed(ws, remittance))) return { ok: false, error: 'vendor-not-allowlisted', status: 400 }
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
