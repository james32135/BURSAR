import { getDb, recordEvent } from './db.ts'
import { rasterizePdf } from './rasterize.ts'
import { screenInvoice, type Flag } from './screen.ts'
import { downloadDecryptPdf, encryptUploadProve, type StoragePut } from './storage.ts'
import { extractInvoicePng } from './teeml.ts'
import { parseUsdToUnits, sha256Bytes32 } from './util.ts'
import { onchainInvoice, registerInvoice, vendorAllowed, vaultState } from './vault.ts'
import { decide, explainWhy, memoryFlags } from './payable.ts'
import type { Workspace } from './workspace.ts'

export async function ingestPayable(args: {
  ws: Workspace
  pdf: Buffer
  source: string
  kind: string
  analyze?: boolean
}) {
  const { ws, pdf, source, kind } = args
  const analyze = args.analyze !== false
  if (pdf.length < 20) throw Object.assign(new Error('empty payable'), { status: 400 })
  const invoiceHash = sha256Bytes32(pdf)
  const db = await getDb()
  const existing = await db.query(
    'SELECT invoice_hash, status, pipeline FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2',
    [ws.id, invoiceHash]
  )
  if (!existing.rows[0]) await recordEvent(ws.id, invoiceHash, 'received', { source, kind })
  if (existing.rows[0]) {
    const st = String(existing.rows[0].status)
    const pipeline = String(existing.rows[0].pipeline || '')
    if (st === 'stored' || pipeline === 'stored') {
      if (analyze) return analyzeStoredPayable(ws, invoiceHash)
      return { statusCode: 200 as const, body: { invoiceHash, status: 'stored', pipeline: 'stored', workspaceId: ws.id } }
    }
    if (st !== 'received' && st !== 'queued') {
      try {
        const { notifyWorkspacePayable } = await import('./telegram.ts')
        await notifyWorkspacePayable(ws.id, { invoiceHash, duplicate: true, status: st })
      } catch {
        /* alerts must not fail ingest */
      }
      return { statusCode: 409 as const, body: { duplicate: true, invoiceHash, status: st } }
    }
  } else {
    const chainPaid = await onchainInvoice(ws, invoiceHash)
    if (chainPaid.paid) {
      return { statusCode: 409 as const, body: { duplicate: true, invoiceHash, status: 'paid-on-chain' } }
    }
  }
  const chain = existing.rows[0] ? await onchainInvoice(ws, invoiceHash) : { paid: false }

  await recordEvent(ws.id, invoiceHash, 'encrypting', { source })
  const stored = await encryptUploadProve(pdf, invoiceHash.slice(2))
  const registerTx = await registerInvoice(ws, invoiceHash, stored.root)
  await db.query(
    `INSERT INTO invoices (workspace_id, invoice_hash, storage_root, flow_tx, tx_seq, go_proof_ok, go_proof_log, status, register_tx, source, kind, pipeline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'stored',$8,$9,$10,'stored')
     ON CONFLICT (workspace_id, invoice_hash) DO UPDATE SET
       storage_root = EXCLUDED.storage_root,
       flow_tx = EXCLUDED.flow_tx,
       tx_seq = EXCLUDED.tx_seq,
       go_proof_ok = EXCLUDED.go_proof_ok,
       go_proof_log = EXCLUDED.go_proof_log,
       status = 'stored',
       register_tx = EXCLUDED.register_tx,
       source = EXCLUDED.source,
       kind = EXCLUDED.kind,
       pipeline = 'stored',
       updated_at = NOW()`,
    [ws.id, invoiceHash, stored.root, stored.flowTx, stored.txSeq, stored.goProofOk, stored.goProofLog, registerTx, source, kind]
  )
  await recordEvent(ws.id, invoiceHash, 'stored', { root: stored.root, flowTx: stored.flowTx, registerTx })

  if (!analyze) {
    return {
      statusCode: 200 as const,
      body: { invoiceHash, storage: stored, registerTx, status: 'stored', workspaceId: ws.id, source, kind, pipeline: 'stored' },
    }
  }

  return finalizeAnalysis(ws, invoiceHash, pdf, source, kind, stored, registerTx, chain.paid)
}

export async function acceptPayable(args: {
  ws: Workspace
  pdf: Buffer
  source: string
  kind: string
  analyze?: boolean
}) {
  const { ws, pdf, source, kind } = args
  const analyze = args.analyze !== false
  if (pdf.length < 20) return { statusCode: 400 as const, body: { error: 'empty payable' } }
  const invoiceHash = sha256Bytes32(pdf)
  const db = await getDb()
  await recordEvent(ws.id, invoiceHash, 'received', { source, kind })
  const existing = await db.query(
    'SELECT invoice_hash, status, pipeline FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2',
    [ws.id, invoiceHash]
  )
  if (existing.rows[0]) {
    const st = String(existing.rows[0].status)
    if (st !== 'received' && st !== 'queued') {
      try {
        const { notifyWorkspacePayable } = await import('./telegram.ts')
        await notifyWorkspacePayable(ws.id, { invoiceHash, duplicate: true, status: st })
      } catch {
        /* alerts must not fail ingest */
      }
      return { statusCode: 409 as const, body: { duplicate: true, invoiceHash, status: st } }
    }
    const running = await db.query(
      `SELECT id FROM jobs WHERE workspace_id = $1 AND invoice_hash = $2 AND status IN ('queued','running') LIMIT 1`,
      [ws.id, invoiceHash]
    )
    if (!running.rows[0]) {
      const { enqueueIngestJob } = await import('./jobs.ts')
      await enqueueIngestJob({ workspaceId: ws.id, invoiceHash, pdf, source, kind, analyze })
    }
    return {
      statusCode: 202 as const,
      body: { invoiceHash, status: 'received', pipeline: 'queued', accepted: true, workspaceId: ws.id, source, kind },
    }
  }
  const chain = await onchainInvoice(ws, invoiceHash)
  if (chain.paid) {
    return { statusCode: 409 as const, body: { duplicate: true, invoiceHash, status: 'paid-on-chain' } }
  }
  await db.query(
    `INSERT INTO invoices (workspace_id, invoice_hash, status, source, kind, pipeline)
     VALUES ($1,$2,'received',$3,$4,'queued')`,
    [ws.id, invoiceHash, source, kind]
  )
  const { enqueueIngestJob } = await import('./jobs.ts')
  await enqueueIngestJob({ workspaceId: ws.id, invoiceHash, pdf, source, kind, analyze })
  try {
    const { notifyWorkspaceProcessing } = await import('./telegram.ts')
    await notifyWorkspaceProcessing(ws.id, invoiceHash)
  } catch {
    /* alerts must not fail intake */
  }
  return {
    statusCode: 202 as const,
    body: { invoiceHash, status: 'received', pipeline: 'queued', accepted: true, workspaceId: ws.id, source, kind },
  }
}

export async function analyzeStoredPayable(ws: Workspace, invoiceHash: string) {
  const db = await getDb()
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [ws.id, invoiceHash])
  const row = rows.rows[0]
  if (!row) return { statusCode: 404 as const, body: { error: 'not found' } }
  const status = String(row.status || '')
  const pipeline = String(row.pipeline || '')
  if (status !== 'stored' && pipeline !== 'stored') {
    return { statusCode: 409 as const, body: { error: 'already analyzed', status, pipeline } }
  }
  const root = String(row.storage_root || '')
  if (!root) return { statusCode: 400 as const, body: { error: 'missing storage_root' } }
  const pdf = await downloadDecryptPdf(root)
  const stored: StoragePut = {
    root,
    flowTx: String(row.flow_tx || ''),
    txSeq: row.tx_seq == null ? null : Number(row.tx_seq),
    recipientPubKey: '',
    originalHash: invoiceHash.replace(/^0x/, ''),
    goProofOk: Boolean(row.go_proof_ok),
    goProofLog: String(row.go_proof_log || ''),
    decryptMatch: true,
  }
  const chain = await onchainInvoice(ws, invoiceHash)
  return finalizeAnalysis(
    ws,
    invoiceHash,
    pdf,
    String(row.source || 'pdf'),
    String(row.kind || 'invoice'),
    stored,
    String(row.register_tx || ''),
    chain.paid
  )
}

async function finalizeAnalysis(
  ws: Workspace,
  invoiceHash: string,
  pdf: Buffer,
  source: string,
  kind: string,
  stored: StoragePut,
  registerTx: string,
  alreadyPaid: boolean
) {
  const db = await getDb()
  await recordEvent(ws.id, invoiceHash, 'analyzing', { model: '0gm-1.0-35b-a3b' })
  const png = await rasterizePdf(pdf)
  const tee = await extractInvoicePng(png, invoiceHash)
  let amountUnits: bigint | null = null
  try {
    if (tee.extracted?.total_usd) amountUnits = parseUsdToUnits(tee.extracted.total_usd)
  } catch {
    amountUnits = null
  }
  const remittance = tee.extracted?.remittance_usdc_e || ''
  await recordEvent(ws.id, invoiceHash, 'checking_vendor', { remittance })
  const allowed = /^0x[a-fA-F0-9]{40}$/.test(remittance) ? await vendorAllowed(ws, remittance) : false
  const vs = await vaultState(ws)
  await recordEvent(ws.id, invoiceHash, 'checking_policy', { band0: vs.band0Max })
  const screened = screenInvoice({
    invoiceHash,
    alreadyPaid,
    alreadySeen: false,
    extracted: tee.extracted,
    remittanceAllowed: allowed,
    amountUnits,
    band0Max: BigInt(vs.band0Max),
  })
  const extra = await memoryFlags({
    workspaceId: ws.id,
    invoiceHash,
    vendor: tee.extracted?.vendor_name || '',
    remittance,
    amountUnits,
    invoiceNumber: tee.extracted?.invoice_number || '',
  })
  const flags: Flag[] = [...screened.flags, ...extra]
  const status = flags.some((f) => f.severity === 'block')
    ? 'blocked'
    : flags.length
      ? 'flagged'
      : 'clean'
  const decision = decide(flags, amountUnits, BigInt(vs.band0Max))
  const why = explainWhy(flags, decision)
  const pipeline = decision === 'blocked' ? 'blocked' : 'ready'
  const att = tee.attestation
  await db.query(
    `UPDATE invoices SET status=$3, flags=$4::jsonb, extracted=$5::jsonb, vendor=$6, remittance=$7, amount_units=$8,
      chat_id=$9, signed_text=$10, request_half=$11, response_hash=$12, recovered_signer=$13, process_response=$14,
      attestation_ok=$15, source=$16, kind=$17, pipeline=$18, decision=$19, decision_why=$20::jsonb, updated_at=NOW()
     WHERE workspace_id=$1 AND invoice_hash=$2`,
    [
      ws.id,
      invoiceHash,
      status,
      JSON.stringify(flags),
      JSON.stringify(tee.extracted || {}),
      tee.extracted?.vendor_name || null,
      remittance || null,
      amountUnits == null ? null : amountUnits.toString(),
      tee.chatId,
      att.ok ? att.signedText : null,
      att.ok ? att.requestHalf : null,
      att.ok ? att.responseHash : null,
      att.ok ? att.recoveredSigner : null,
      String(tee.processResponse),
      att.ok,
      source,
      kind,
      pipeline,
      decision,
      JSON.stringify(why),
    ]
  )
  await recordEvent(ws.id, invoiceHash, pipeline === 'blocked' ? 'blocked' : 'ready', { status, flags, decision, why })
  const body = {
    invoiceHash,
    invoice_hash: invoiceHash,
    workspaceId: ws.id,
    source,
    kind,
    pipeline,
    decision,
    why,
    storage: stored,
    registerTx,
    extraction: tee.extracted,
    extracted: tee.extracted,
    vendor: tee.extracted?.vendor_name || null,
    remittance,
    amount_units: amountUnits == null ? null : amountUnits.toString(),
    attestation: att,
    processResponse: tee.processResponse,
    originalPostHash: tee.originalPostHash,
    requestHalfNote: 'broker rewrites request; original POST sha256 is not the signed request half',
    flags,
    status,
    providerUrl: tee.providerUrl,
    model: tee.model,
  }
  try {
    const { notifyWorkspacePayable } = await import('./telegram.ts')
    await notifyWorkspacePayable(ws.id, body)
  } catch {
    /* alerts must not fail ingest */
  }
  return {
    statusCode: 200 as const,
    body,
  }
}
