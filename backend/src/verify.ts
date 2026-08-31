import { ethers } from 'ethers'
import { config, ERC20_ABI, VAULT_ABI } from './config.ts'
import { getDb } from './db.ts'
import { goProofDownload } from './storage.ts'
import { publicDecisionFromInvoiceRow } from './payable.ts'
import { demoCtx, getProvider, onchainInvoice, onchainPayment, type VaultCtx } from './vault.ts'
import { getWorkspaceById } from './workspace.ts'

export type VerifyStatus = 'VERIFIED' | 'BLOCKED' | 'INVALID' | 'MISSING_EVIDENCE'

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

function ctxAt(vault: string): VaultCtx {
  return { vault, sessionId: ethers.ZeroHash, sessionPk: config.sessionPk }
}

async function invoiceRecord(hash: string, vault?: string): Promise<Record<string, unknown> | null> {
  const db = await getDb()
  const cols = `i.invoice_hash, i.source, i.kind, i.storage_root, i.go_proof_ok, i.recovered_signer, i.response_hash,
       i.flags, i.decision, i.decision_why, i.status, i.pay_tx, i.amount_units, i.remittance, i.workspace_id`
  if (vault) {
    const scoped = await db.query(
      `SELECT ${cols} FROM invoices i
       JOIN workspaces w ON w.id = i.workspace_id
       WHERE i.invoice_hash = $1 AND lower(w.vault) = $2 LIMIT 1`,
      [hash, vault.toLowerCase()]
    )
    if (scoped.rows[0]) return scoped.rows[0] as Record<string, unknown>
  }
  const row = await db.query(
    `SELECT invoice_hash, source, kind, storage_root, go_proof_ok, recovered_signer, response_hash,
            flags, decision, decision_why, status, pay_tx, amount_units, remittance, workspace_id
     FROM invoices WHERE invoice_hash = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
    [hash]
  )
  return (row.rows[0] as Record<string, unknown>) || null
}

async function optionalGoProof(root?: string | null) {
  if (!root || root === ethers.ZeroHash) return null
  try {
    return await goProofDownload(root)
  } catch (e) {
    return { ok: false as const, log: e instanceof Error ? e.message : String(e) }
  }
}

async function ctxForInvoiceHash(id: string): Promise<VaultCtx> {
  const db = await getDb()
  const rows = await db.query('SELECT DISTINCT workspace_id FROM invoices WHERE invoice_hash = $1', [id])
  for (const row of rows.rows) {
    const ws = await getWorkspaceById(String(row.workspace_id))
    if (!ws) continue
    const p = await onchainPayment(ws, id)
    if (p && p.vendor !== ethers.ZeroAddress) return ws
  }
  for (const row of rows.rows) {
    const ws = await getWorkspaceById(String(row.workspace_id))
    if (ws) return ws
  }
  return demoCtx()
}

function attachDecision(
  row: Record<string, unknown> | null,
  extra: {
    goProofOk?: boolean
    recoveredSigner?: string
    responseHash?: string
    storageRoot?: string
    payTx?: string | null
    amountUnits?: string
    moved?: boolean
  }
) {
  const decision = publicDecisionFromInvoiceRow(row)
  if (!decision) return null
  if (extra.goProofOk != null) decision.stored.goProofOk = extra.goProofOk
  if (extra.storageRoot && !decision.stored.storageRoot) decision.stored.storageRoot = extra.storageRoot
  if (extra.recoveredSigner && !decision.computed.recoveredSigner) decision.computed.recoveredSigner = extra.recoveredSigner
  if (extra.responseHash && !decision.computed.responseHash) decision.computed.responseHash = extra.responseHash
  if (extra.payTx !== undefined) decision.money.payTx = extra.payTx
  if (extra.moved != null) decision.money.moved = extra.moved
  if (extra.amountUnits != null) decision.money.amountUnits = extra.amountUnits
  return decision
}

export async function verifyPayment(id: string) {
  const rpc = getProvider()
  const vaultIf = new ethers.Interface(VAULT_ABI)
  const ercIf = new ethers.Interface(ERC20_ABI)
  let txHash = id
  let invoiceHash: string | null = null
  let ctx = demoCtx()

  if (/^0x[0-9a-fA-F]{64}$/.test(id) && !(await rpc.getTransaction(id))) {
    invoiceHash = id
    ctx = await ctxForInvoiceHash(id)
    const p = await onchainPayment(ctx, id)
    if (!p || p.vendor === ethers.ZeroAddress) {
      const inv = await onchainInvoice(ctx, id)
      const row = await invoiceRecord(id, ctx.vault)
      const storageRoot = String(row?.storage_root || inv.storageRoot || '')
      const goProof = await optionalGoProof(storageRoot)
      const decision = attachDecision(row, {
        goProofOk: Boolean(goProof && 'ok' in goProof && goProof.ok),
        storageRoot: storageRoot && storageRoot !== ethers.ZeroHash ? storageRoot : undefined,
        recoveredSigner: row?.recovered_signer ? String(row.recovered_signer) : undefined,
        responseHash: row?.response_hash ? String(row.response_hash) : undefined,
        moved: false,
        payTx: null,
        amountUnits: '0',
      })
      const blockedOnChain = inv.registered && !inv.paid
      const blockedInDb = Boolean(row && (String(row.status) === 'blocked' || String(row.decision) === 'blocked'))
      if (blockedOnChain || blockedInDb) {
        return {
          status: 'BLOCKED' as VerifyStatus,
          reason: decision?.why[0] || 'invoice registered but not paid',
          invoiceHash: id,
          invoice: inv,
          vault: ctx.vault,
          storageRoot: storageRoot && storageRoot !== ethers.ZeroHash ? storageRoot : undefined,
          storageScan:
            storageRoot && storageRoot !== ethers.ZeroHash ? `${config.storageScan}/?root=${storageRoot}` : undefined,
          vendor: (row?.remittance as string) || ethers.ZeroAddress,
          amount: '0',
          didMoneyMove: false,
          goProof,
          decision,
          flags: decision?.memory,
          why: decision?.why,
          nextAction: decision?.policy.nextAction || 'WHY',
          recoveredSigner: decision?.computed.recoveredSigner || undefined,
          responseHash: decision?.computed.responseHash || undefined,
          attestation: 'EIP-191 processResponse signer recovery (not a hardware quote)',
        }
      }
      return { status: 'MISSING_EVIDENCE' as VerifyStatus, reason: 'no payment and no tx', invoiceHash: id, decision }
    }
    const paidTopic = vaultIf.getEvent('Paid').topicHash
    const latest = await rpc.getBlockNumber()
    const logs = await rpc.getLogs({
      address: ctx.vault,
      fromBlock: Math.max(0, latest - 250000),
      toBlock: latest,
      topics: [paidTopic, null, null, ethers.zeroPadValue(id, 32)],
    })
    if (!logs[0]) {
      return {
        status: 'MISSING_EVIDENCE' as VerifyStatus,
        reason: 'on-chain payment exists but Paid log locator not found in recent blocks',
        invoiceHash: id,
        vault: ctx.vault,
      }
    }
    txHash = logs[0].transactionHash
  }

  const rec = await rpc.getTransactionReceipt(txHash)
  if (!rec) {
    return { status: 'MISSING_EVIDENCE' as VerifyStatus, reason: 'tx not found', id }
  }
  if (rec.status !== 1) return { status: 'INVALID' as VerifyStatus, reason: 'tx failed', txHash, explorer: `${config.explorer}/tx/${txHash}` }

  let paid: ethers.LogDescription | null = null
  let paidVault = ''
  let transfer: ethers.LogDescription | null = null
  for (const log of rec.logs) {
    try {
      const parsed = vaultIf.parseLog({ topics: log.topics as string[], data: log.data })
      if (parsed?.name === 'Paid') {
        paid = parsed
        paidVault = log.address
      }
    } catch {
      /* not vault */
    }
    try {
      if (log.address.toLowerCase() === config.usdc.toLowerCase()) {
        const parsed = ercIf.parseLog({ topics: log.topics as string[], data: log.data })
        if (parsed?.name === 'Transfer') transfer = parsed
      }
    } catch {
      /* not usdc */
    }
  }
  if (!paid || !paidVault) return { status: 'INVALID' as VerifyStatus, reason: 'no Paid event', txHash }
  ctx = ctxAt(paidVault)
  invoiceHash = paid.args.invoiceHash as string
  const chainPay = await onchainPayment(ctx, invoiceHash)
  const inv = await onchainInvoice(ctx, invoiceHash)

  const amount = paid.args.amount as bigint
  const vendor = paid.args.vendor as string
  const transferOk =
    transfer &&
    String(transfer.args.to).toLowerCase() === vendor.toLowerCase() &&
    String(transfer.args.from).toLowerCase() === paidVault.toLowerCase() &&
    BigInt(transfer.args.value) === amount

  if (!transferOk) {
    return {
      status: 'INVALID' as VerifyStatus,
      reason: 'Paid event does not match USDC.e Transfer',
      txHash,
      invoiceHash,
      vault: paidVault,
      paid: jsonSafe(paid.args),
    }
  }

  const signer = paid.args.recoveredSigner as string
  const responseHash = paid.args.responseHash as string
  const storageRoot = paid.args.storageRoot as string
  if (!signer || signer === ethers.ZeroAddress || responseHash === ethers.ZeroHash || storageRoot === ethers.ZeroHash) {
    return { status: 'MISSING_EVIDENCE' as VerifyStatus, reason: 'empty attestation/storage commitments', txHash, invoiceHash }
  }

  let storageProof: { ok: boolean; log: string } | { skipped: string } | null = null
  try {
    if (inv.storageRoot && inv.storageRoot !== ethers.ZeroHash) {
      storageProof = await goProofDownload(inv.storageRoot)
    }
  } catch (e) {
    storageProof = { ok: false, log: e instanceof Error ? e.message : String(e) }
  }

  const goOk = Boolean(storageProof && 'ok' in storageProof && storageProof.ok)
  const verified =
    Boolean(inv.paid) &&
    chainPay.vendor.toLowerCase() === vendor.toLowerCase() &&
    BigInt(chainPay.amount) === amount &&
    goOk

  const row = invoiceHash ? await invoiceRecord(invoiceHash, paidVault) : null
  const decision =
    attachDecision(row, {
      goProofOk: goOk,
      recoveredSigner: signer,
      responseHash,
      storageRoot,
      payTx: txHash,
      amountUnits: amount.toString(),
      moved: true,
    }) || {
      received: { invoiceHash, source: 'chain', kind: 'invoice' },
      stored: { storageRoot, goProofOk: goOk },
      computed: {
        recoveredSigner: signer,
        responseHash,
        attestation: 'EIP-191 processResponse signer recovery (not a hardware quote)',
      },
      memory: [],
      policy: { decision: 'auto-pay', nextAction: 'PROOF' as const, rail: 'usdc.e-16661' },
      money: { moved: true, payTx: txHash, amountUnits: amount.toString() },
      why: [
        'Paid event, USDC.e Transfer, and Go merkle proof agree. Memory flags are only attached when this invoice exists in the clerk database.',
      ],
    }

  if (!goOk) {
    return {
      status: 'INVALID' as VerifyStatus,
      reason: 'chain payment exists but Go storage proof did not succeed',
      txHash,
      explorer: `${config.explorer}/tx/${txHash}`,
      invoiceHash,
      vault: paidVault,
      vendor,
      amount: amount.toString(),
      storageRoot,
      goProof: storageProof,
      didMoneyMove: true,
      source: 'chain+storagescan+go-proof',
      decision,
    }
  }

  return {
    status: (verified ? 'VERIFIED' : 'INVALID') as VerifyStatus,
    txHash,
    explorer: `${config.explorer}/tx/${txHash}`,
    invoiceHash,
    vault: paidVault,
    vendor,
    amount: amount.toString(),
    storageRoot,
    storageScan: `${config.storageScan}/?root=${storageRoot}`,
    responseHash,
    recoveredSigner: signer,
    policyVersion: (paid.args.policyVersion as bigint).toString(),
    sessionId: paid.args.sessionId,
    chainPayment: {
      vendor: chainPay.vendor,
      amount: chainPay.amount.toString(),
      storageRoot: chainPay.storageRoot,
      responseHash: chainPay.responseHash,
      recoveredSigner: chainPay.recoveredSigner,
      policyVersion: chainPay.policyVersion.toString(),
    },
    usdcTransfer: transfer
      ? { from: transfer.args.from, to: transfer.args.to, value: transfer.args.value.toString() }
      : null,
    goProof: storageProof,
    didMoneyMove: true,
    source: 'chain+storagescan+go-proof',
    attestation: 'EIP-191 processResponse signer recovery (not a hardware quote)',
    notFrom: ['render-disk', 'ts-proof-true', 'processResponse-boolean-alone', 'hardware-tee-quote'],
    decision,
    flags: decision.memory,
    why: decision.why,
    nextAction: 'PROOF' as const,
  }
}
