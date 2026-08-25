import { randomBytes } from 'node:crypto'
import { getDb } from './db.ts'
import { parseUsdToUnits } from './util.ts'

export type Obligation = {
  id: string
  workspaceId: string
  vendor: string
  remittance: string
  cadence: string
  expectedMin: string | null
  expectedMax: string | null
  lastMatchedHash: string | null
  lastMatchedAt: string | null
}

/** Remembered range around a typical bill. Matching is not a pay bypass. */
export function bandAroundUsd(amountUsd: string): { min: string; max: string } {
  const n = Number(String(amountUsd).replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return { min: amountUsd, max: amountUsd }
  return { min: (n * 0.8).toFixed(6), max: (n * 1.25).toFixed(6) }
}

export type ObligationMatch = {
  obligation: Obligation
  inRange: boolean
  why: string
}

function rowOf(r: Record<string, unknown>): Obligation {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    vendor: String(r.vendor),
    remittance: String(r.remittance),
    cadence: String(r.cadence || 'monthly'),
    expectedMin: r.expected_min == null ? null : String(r.expected_min),
    expectedMax: r.expected_max == null ? null : String(r.expected_max),
    lastMatchedHash: r.last_matched_hash ? String(r.last_matched_hash) : null,
    lastMatchedAt: r.last_matched_at ? String(r.last_matched_at) : null,
  }
}

export async function listObligations(workspaceId: string): Promise<Obligation[]> {
  const db = await getDb()
  const q = await db.query(
    `SELECT * FROM obligations WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 40`,
    [workspaceId]
  )
  return q.rows.map(rowOf)
}

export async function upsertObligation(args: {
  workspaceId: string
  vendor: string
  remittance: string
  cadence?: string
  expectedMinUsd?: string
  expectedMaxUsd?: string
}): Promise<Obligation> {
  const rem = args.remittance.toLowerCase()
  const cadence = String(args.cadence || 'monthly').toLowerCase()
  const min = args.expectedMinUsd ? parseUsdToUnits(args.expectedMinUsd).toString() : null
  const max = args.expectedMaxUsd ? parseUsdToUnits(args.expectedMaxUsd).toString() : null
  const db = await getDb()
  const existing = await db.query(
    `SELECT * FROM obligations WHERE workspace_id = $1 AND lower(remittance) = $2 AND lower(vendor) = $3 LIMIT 1`,
    [args.workspaceId, rem, args.vendor.toLowerCase()]
  )
  if (existing.rows[0]) {
    const oldMin = existing.rows[0].expected_min == null ? null : String(existing.rows[0].expected_min)
    const oldMax = existing.rows[0].expected_max == null ? null : String(existing.rows[0].expected_max)
    const nextMin =
      min == null
        ? oldMin
        : oldMin == null
          ? min
          : BigInt(min) < BigInt(oldMin)
            ? min
            : oldMin
    const nextMax =
      max == null
        ? oldMax
        : oldMax == null
          ? max
          : BigInt(max) > BigInt(oldMax)
            ? max
            : oldMax
    await db.query(`UPDATE obligations SET cadence=$2, expected_min=$3, expected_max=$4 WHERE id=$1`, [
      existing.rows[0].id,
      cadence,
      nextMin,
      nextMax,
    ])
    return rowOf({ ...existing.rows[0], cadence, expected_min: nextMin, expected_max: nextMax })
  }
  const id = randomBytes(12).toString('hex')
  await db.query(
    `INSERT INTO obligations (id, workspace_id, vendor, remittance, cadence, expected_min, expected_max)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, args.workspaceId, args.vendor, rem, cadence, min, max]
  )
  return {
    id,
    workspaceId: args.workspaceId,
    vendor: args.vendor,
    remittance: rem,
    cadence,
    expectedMin: min,
    expectedMax: max,
    lastMatchedHash: null,
    lastMatchedAt: null,
  }
}

export async function matchObligation(args: {
  workspaceId: string
  vendor: string
  remittance: string
  amountUnits: bigint | null
  invoiceHash: string
}): Promise<ObligationMatch | null> {
  const db = await getDb()
  const rem = args.remittance.toLowerCase()
  const q = await db.query(
    `SELECT * FROM obligations
     WHERE workspace_id = $1 AND (lower(remittance) = $2 OR lower(vendor) = $3)
     ORDER BY created_at DESC LIMIT 1`,
    [args.workspaceId, rem, args.vendor.toLowerCase()]
  )
  if (!q.rows[0]) return null
  const obligation = rowOf(q.rows[0])
  let inRange = true
  if (args.amountUnits != null) {
    if (obligation.expectedMin != null && args.amountUnits < BigInt(obligation.expectedMin)) inRange = false
    if (obligation.expectedMax != null && args.amountUnits > BigInt(obligation.expectedMax)) inRange = false
  }
  await db.query(`UPDATE obligations SET last_matched_hash=$2, last_matched_at=NOW() WHERE id=$1`, [
    obligation.id,
    args.invoiceHash,
  ])
  return {
    obligation,
    inRange,
    why: inRange
      ? `Matched to prior obligation (${obligation.cadence}). Policy still applies.`
      : `Matched to prior obligation (${obligation.cadence}) but amount is outside the remembered range.`,
  }
}
