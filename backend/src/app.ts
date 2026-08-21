import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ethers } from 'ethers'
import { config } from './config.ts'
import { getDb, recordEvent } from './db.ts'
import { rasterizePdf } from './rasterize.ts'
import { screenInvoice } from './screen.ts'
import { encryptUploadProve } from './storage.ts'
import { extractInvoicePng } from './teeml.ts'
import { parseUsdToUnits, sha256Bytes32 } from './util.ts'
import { verifyPayment } from './verify.ts'
import {
  onchainInvoice,
  onchainPayment,
  registerInvoice,
  sessionPay,
  sessionState,
  vaultState,
  vendorAllowed,
} from './vault.ts'
import {
  bindWorkspace,
  ensureDemoWorkspace,
  getWorkspaceByToken,
  publicWorkspace,
  workspaceStats,
  type Workspace,
} from './workspace.ts'

type Env = { Variables: { ws: Workspace } }

export const app = new Hono<Env>()
app.use('/*', cors())

app.onError((err, c) => {
  return c.json({ error: err.message }, 500)
})

function presentInvoice(row: Record<string, unknown>) {
  const extracted = typeof row.extracted === 'string' ? JSON.parse(row.extracted) : row.extracted
  const flags = typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags
  return {
    ...row,
    invoiceHash: row.invoice_hash,
    extracted,
    flags,
  }
}

async function requireWorkspace(c: { req: { header: (n: string) => string | undefined }; json: (b: unknown, s: number) => Response; set: (k: 'ws', v: Workspace) => void }) {
  await ensureDemoWorkspace()
  const ws = await getWorkspaceByToken(c.req.header('authorization'))
  if (!ws) return c.json({ error: 'unauthorized' }, 401)
  c.set('ws', ws)
  return null
}

app.get('/health', async (c) => {
  await ensureDemoWorkspace()
  const rpc = new ethers.JsonRpcProvider(config.rpcUrl)
  const net = await rpc.getNetwork()
  const demo = await getWorkspaceByToken(config.apiToken ? `Bearer ${config.apiToken}` : undefined)
  const ctx = demo || {
    vault: config.vault,
    sessionId: ethers.id('prod-allow'),
    sessionPk: config.sessionPk,
    id: 'demo',
    owner: config.owner,
    agentAddress: '',
    demo: true,
    createdAt: '',
  }
  const code = await rpc.getCode(ctx.vault)
  const db = await getDb()
  const ping = await db.query('SELECT 1 AS ok')
  const vs = await vaultState(ctx)
  const session = await sessionState(ctx)
  return c.json({
    ok: Number(net.chainId) === config.chainId && code.length > 4 && ping.rows[0]?.ok === 1,
    chainId: Number(net.chainId),
    factory: config.factory || null,
    vault: ctx.vault,
    owner: ctx.owner,
    explorer: config.explorer,
    storageScan: config.storageScan,
    vaultCodeBytes: (code.length - 2) / 2,
    db: ping.rows[0],
    vaultState: vs,
    session,
    computeFunding: 'direct-ledger',
    bindingPath: 'direct-teeml',
    settlement: 'vault-usdc.e-transfer',
    visionModel: config.visionModel,
    visionProvider: config.visionProvider,
    teeSigner: '0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0',
    usdc: config.usdc,
    multiTenant: true,
    demoLabeled: true,
    privacy:
      'Sensitive invoice processing uses the Direct TeeML path. processResponse is EIP-191 recovery of the registered TEE signer, not a hardware quote. Direct TLS is public Let\'s Encrypt, not RA-TLS. Independent dstack quote verification is a separate manual path and is not on the payment hot path.',
  })
})

app.get('/product', async (c) => {
  await ensureDemoWorkspace()
  const demo = await getWorkspaceByToken(config.apiToken ? `Bearer ${config.apiToken}` : undefined)
  const ctx = demo || {
    vault: config.vault,
    sessionId: ethers.id('prod-allow'),
    sessionPk: config.sessionPk,
    id: 'demo',
    owner: config.owner,
    agentAddress: '',
    demo: true,
    createdAt: '',
  }
  const vs = await vaultState(ctx)
  const session = await sessionState(ctx)
  const remittance = '0x1111111111111111111111111111111111111111'
  const remittanceAllowed = await vendorAllowed(ctx, remittance)
  return c.json({
    name: 'BURSAR',
    promise: 'The autonomous finance desk for Web3 teams.',
    chainId: config.chainId,
    factory: config.factory || null,
    demo: {
      label: 'DEMO',
      vault: config.vault,
      owner: config.owner,
      note: 'Judge/demo vault. New users create their own workspace via BursarFactory.',
    },
    usdc: config.usdc,
    explorer: config.explorer,
    storageScan: config.storageScan,
    model: config.visionModel,
    provider: config.visionProvider,
    bindingPath: 'direct-teeml',
    settlement: 'vault-usdc.e-transfer',
    computeFunding: 'direct-ledger',
    vaultState: vs,
    session,
    remittance,
    remittanceAllowed,
    proofs: [
      {
        label: 'Production vault deploy',
        tx: '0x9cd27adb5b8ff8920048cb75649f82d199f59b9cd9cd3e707f29ad8cc613fa21',
        url: 'https://chainscan.0g.ai/tx/0x9cd27adb5b8ff8920048cb75649f82d199f59b9cd9cd3e707f29ad8cc613fa21',
      },
      {
        label: 'Chrome Band-0 USDC.e pay',
        tx: '0x817ff5010e0cb04293b2c0241e15e635cf5a2cc0e8e2511379c4ad0fef262e2b',
        url: 'https://chainscan.0g.ai/tx/0x817ff5010e0cb04293b2c0241e15e635cf5a2cc0e8e2511379c4ad0fef262e2b',
      },
      {
        label: 'API Band-0 USDC.e pay',
        tx: '0x6e3cff64939839eacf888ec92acef3a61825ed0ae624e09e77a9ca910d1de70b',
        url: 'https://chainscan.0g.ai/tx/0x6e3cff64939839eacf888ec92acef3a61825ed0ae624e09e77a9ca910d1de70b',
      },
    ],
    privacy:
      'Sensitive invoice processing uses the Direct TeeML path. We do not claim that 0G cannot see your data. The signed request half is the broker\'s rewritten body, not sha256 of the original client POST. Hardware TEE quotes are not verified on the payment path.',
  })
})

app.post('/workspaces', async (c) => {
  await ensureDemoWorkspace()
  const body = await c.req.json<{ vault?: string; signature?: string; issuedAt?: number }>()
  if (!body.vault || !body.signature || !body.issuedAt) {
    return c.json({ error: 'vault, signature, issuedAt required' }, 400)
  }
  try {
    const created = await bindWorkspace({
      vault: body.vault,
      signature: body.signature,
      issuedAt: Number(body.issuedAt),
    })
    return c.json(created)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 400)
  }
})

app.get('/workspace', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const remittance = '0x1111111111111111111111111111111111111111'
  const [vs, session, stats, remittanceAllowed] = await Promise.all([
    vaultState(ws),
    sessionState(ws),
    workspaceStats(ws.id),
    vendorAllowed(ws, remittance),
  ])
  return c.json({
    workspace: publicWorkspace(ws),
    vaultState: vs,
    session,
    remittanceAllowed,
    stats,
  })
})

app.get('/workspace/stats', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  return c.json(await workspaceStats(c.get('ws').id))
})

app.get('/policy', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const [vs, session] = await Promise.all([vaultState(ws), sessionState(ws)])
  return c.json({ vault: ws.vault, vaultState: vs, session })
})

app.get('/queue', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const db = await getDb()
  const rows = await db.query(
    `SELECT invoice_hash, status, flags, extracted, vendor, remittance, amount_units, pay_tx, storage_root, flow_tx, tx_seq, go_proof_ok, attestation_ok, recovered_signer, created_at, updated_at
     FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [ws.id]
  )
  return c.json({ invoices: rows.rows.map((row) => presentInvoice(row)), workspaceId: ws.id, demo: ws.demo })
})

app.get('/events', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const db = await getDb()
  const rows = await db.query(
    'SELECT id, invoice_hash, kind, detail, created_at FROM events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 30',
    [ws.id]
  )
  return c.json({ events: rows.rows })
})

app.get('/invoices/:hash', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const db = await getDb()
  const hash = c.req.param('hash')
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [ws.id, hash])
  if (!rows.rows[0]) return c.json({ error: 'not found' }, 404)
  return c.json(presentInvoice(rows.rows[0]))
})

app.post('/invoices', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const body = await c.req.parseBody()
  const file = body.file
  let pdf: Buffer
  if (file && typeof file === 'object' && 'arrayBuffer' in file) {
    pdf = Buffer.from(await (file as File).arrayBuffer())
  } else {
    const raw = await c.req.arrayBuffer()
    pdf = Buffer.from(raw)
  }
  if (pdf.length < 20) return c.json({ error: 'empty invoice' }, 400)
  const invoiceHash = sha256Bytes32(pdf)
  const db = await getDb()
  const existing = await db.query(
    'SELECT invoice_hash, status FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2',
    [ws.id, invoiceHash]
  )
  if (existing.rows[0]) {
    return c.json({ duplicate: true, invoiceHash, status: existing.rows[0].status }, 409)
  }
  const chain = await onchainInvoice(ws, invoiceHash)
  if (chain.paid) return c.json({ duplicate: true, invoiceHash, status: 'paid-on-chain' }, 409)

  const stored = await encryptUploadProve(pdf, invoiceHash.slice(2))
  const registerTx = await registerInvoice(ws, invoiceHash, stored.root)
  await db.query(
    `INSERT INTO invoices (workspace_id, invoice_hash, storage_root, flow_tx, tx_seq, go_proof_ok, go_proof_log, status, register_tx)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'stored',$8)`,
    [ws.id, invoiceHash, stored.root, stored.flowTx, stored.txSeq, stored.goProofOk, stored.goProofLog, registerTx]
  )
  await recordEvent(ws.id, invoiceHash, 'stored', { root: stored.root, flowTx: stored.flowTx, registerTx })

  const analyze = c.req.query('analyze') !== '0'
  if (!analyze) {
    return c.json({ invoiceHash, storage: stored, registerTx, status: 'stored', workspaceId: ws.id })
  }

  const png = await rasterizePdf(pdf)
  const tee = await extractInvoicePng(png, invoiceHash)
  let amountUnits: bigint | null = null
  try {
    if (tee.extracted?.total_usd) amountUnits = parseUsdToUnits(tee.extracted.total_usd)
  } catch {
    amountUnits = null
  }
  const remittance = tee.extracted?.remittance_usdc_e || ''
  const allowed = /^0x[a-fA-F0-9]{40}$/.test(remittance) ? await vendorAllowed(ws, remittance) : false
  const vs = await vaultState(ws)
  const screened = screenInvoice({
    invoiceHash,
    alreadyPaid: chain.paid,
    alreadySeen: false,
    extracted: tee.extracted,
    remittanceAllowed: allowed,
    amountUnits,
    band0Max: BigInt(vs.band0Max),
  })
  const att = tee.attestation
  await db.query(
    `UPDATE invoices SET status=$3, flags=$4::jsonb, extracted=$5::jsonb, vendor=$6, remittance=$7, amount_units=$8,
      chat_id=$9, signed_text=$10, request_half=$11, response_hash=$12, recovered_signer=$13, process_response=$14,
      attestation_ok=$15, updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2`,
    [
      ws.id,
      invoiceHash,
      screened.status,
      JSON.stringify(screened.flags),
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
    ]
