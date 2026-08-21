import { ethers } from 'ethers'
import { config, ERC20_ABI, VAULT_ABI } from './config.ts'
import { getDb } from './db.ts'
import { goProofDownload } from './storage.ts'
import { demoCtx, getProvider, onchainInvoice, onchainPayment, type VaultCtx } from './vault.ts'
import { getWorkspaceById } from './workspace.ts'

export type VerifyStatus = 'VERIFIED' | 'BLOCKED' | 'INVALID' | 'MISSING_EVIDENCE'

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)))
}

function ctxAt(vault: string): VaultCtx {
  return { vault, sessionId: ethers.ZeroHash, sessionPk: config.sessionPk }
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
      if (inv.registered && !inv.paid) {
        return { status: 'BLOCKED' as VerifyStatus, reason: 'invoice registered but not paid', invoiceHash: id, invoice: inv, vault: ctx.vault }
      }
      return { status: 'MISSING_EVIDENCE' as VerifyStatus, reason: 'no payment and no tx', invoiceHash: id }
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

