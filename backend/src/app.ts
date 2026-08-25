import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ethers } from 'ethers'
import { config } from './config.ts'
import { getDb, recordEvent } from './db.ts'
import { payablePdf } from './artifact.ts'
import { ingestPayable } from './ingest.ts'
import { attentionFromRows, vendorMemoryFor } from './payable.ts'
import { handleTelegramUpdate, issueTelegramBindCode, telegramStatus, unbindTelegram } from './telegram.ts'
import { executeAllowedPay } from './pay.ts'
import { verifyPayment } from './verify.ts'
import {
  onchainInvoice,
  onchainPayment,
  sessionPay,
  sessionState,
  vaultState,
  vendorAllowed,
} from './vault.ts'
import {
  bindWorkspace,
  resumeWorkspace,
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
  const why = typeof row.decision_why === 'string' ? JSON.parse(row.decision_why) : row.decision_why
  return {
    ...row,
    invoiceHash: row.invoice_hash,
    extracted,
    flags,
    why: why || [],
    decision: row.decision,
    source: row.source || 'pdf',
    kind: row.kind || 'invoice',
    pipeline: row.pipeline || row.status,
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
    integrations: {
      pdf: true,
      api: true,
      mcp: true,
      sdk: true,
      telegram: Boolean(config.telegramBotToken),
      telegramBot: config.telegramBotToken ? config.telegramBotUsername : null,
      email: false,
      emailReason: 'No dedicated inbound mailbox or MX. Email intake is not live.',
      slack: false,
      discord: false,
    },
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
    integrations: {
      pdf: true,
      api: true,
      mcp: true,
      sdk: true,
      telegram: Boolean(config.telegramBotToken),
      telegramBot: config.telegramBotToken ? config.telegramBotUsername : null,
      email: false,
      emailReason: 'No dedicated inbound mailbox or MX. Email intake is not live.',
      slack: false,
      discord: false,
    },
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

app.post('/workspaces/resume', async (c) => {
  await ensureDemoWorkspace()
  const body = await c.req.json<{ signature?: string; issuedAt?: number }>()
  if (!body.signature || !body.issuedAt) {
    return c.json({ error: 'signature and issuedAt required' }, 400)
  }
  try {
    const resumed = await resumeWorkspace({
      signature: body.signature,
      issuedAt: Number(body.issuedAt),
    })
    return c.json(resumed)
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
    `SELECT invoice_hash, status, flags, extracted, vendor, remittance, amount_units, pay_tx, storage_root, flow_tx, tx_seq, go_proof_ok, attestation_ok, recovered_signer, created_at, updated_at, source, kind, pipeline, decision, decision_why
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

app.get('/attention', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const db = await getDb()
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 ORDER BY created_at DESC', [ws.id])
  const session = await sessionState(ws)
  const remaining = BigInt(session.remaining)
  return c.json({
    ...attentionFromRows(rows.rows, remaining),
    payables: rows.rows.map(presentInvoice),
  })
})

app.get('/vendors/memory', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  return c.json({ vendors: await vendorMemoryFor(ws.id) })
})

app.post('/payables', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const body = await c.req.json<{
    vendor?: string
    remittance?: string
    amountUsd?: string
    invoiceNumber?: string
    memo?: string
    kind?: string
    source?: string
  }>()
  if (!body.vendor || !body.remittance || !body.amountUsd) {
    return c.json({ error: 'vendor, remittance, and amountUsd required' }, 400)
  }
  const pdf = payablePdf({
    vendor: body.vendor,
    remittance: body.remittance,
    amountUsd: body.amountUsd,
    invoiceNumber: body.invoiceNumber || `API-${Date.now()}`,
    memo: body.memo,
    kind: body.kind || 'request',
  })
  const out = await ingestPayable({
    ws,
    pdf,
    source: body.source || 'api',
    kind: body.kind || 'request',
    analyze: true,
  })
  return c.json(out.body, out.statusCode)
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
  const out = await ingestPayable({
    ws,
    pdf,
    source: 'pdf',
    kind: 'invoice',
    analyze: c.req.query('analyze') !== '0',
  })
  return c.json(out.body, out.statusCode)
})

app.post('/invoices/:hash/pay', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const hash = c.req.param('hash')
  const result = await executeAllowedPay(ws, hash)
  if (result.ok === false) {
    return c.json({ error: result.error, flags: result.flags, result: result.result }, result.status || 400)
  }
  return c.json({ ok: true, ...result })
})

app.post('/queue/pay-allowed', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const db = await getDb()
  const vs = await vaultState(ws)
  const session = await sessionState(ws)
  const remaining = BigInt(session.remaining)
  const rows = await db.query(
    `SELECT * FROM invoices WHERE workspace_id = $1 AND status = 'clean' AND pay_tx IS NULL ORDER BY created_at ASC`,
    [ws.id]
  )
  const paid: unknown[] = []
  const failed: unknown[] = []
  let left = remaining
  for (const inv of rows.rows) {
    const amount = BigInt(String(inv.amount_units || '0'))
    if (amount > left || amount > BigInt(vs.band0Max)) continue
    const hash = String(inv.invoice_hash)
    const flags = typeof inv.flags === 'string' ? JSON.parse(String(inv.flags)) : inv.flags
    if (Array.isArray(flags) && flags.some((f: { severity: string }) => f.severity === 'block')) {
      failed.push({ hash, error: 'blocked' })
      continue
    }
    try {
      await db.query("UPDATE invoices SET pipeline='paying', updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2", [ws.id, hash])
      const result = await sessionPay(ws, {
        vendor: String(inv.remittance),
        amount,
        invoiceHash: hash,
        storageRoot: String(inv.storage_root),
        responseHash: '0x' + String(inv.response_hash).replace(/^0x/, ''),
        recoveredSigner: String(inv.recovered_signer),
      })
      if (!result.didMoneyMove) {
        failed.push({ hash, error: 'money-did-not-move', result })
        continue
      }
      left -= amount
      await db.query(
        "UPDATE invoices SET status='paid', pipeline='confirmed', pay_tx=$3, pay_session=$4, updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2",
        [ws.id, hash, result.hash, ws.sessionId]
      )
      await recordEvent(ws.id, hash, 'confirmed', result)
      paid.push({ invoiceHash: hash, tx: result.hash, explorer: result.explorer, didMoneyMove: result.didMoneyMove })
    } catch (e) {
      failed.push({ hash, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return c.json({
    paid,
    failed,
    note: 'BursarVault has no batch opcode. Each success is one session.pay then one USDC.e.transfer.',
  })
})

app.post('/invoices/:hash/confirm-pay', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  const hash = c.req.param('hash')
  const body = await c.req.json<{ tx?: string }>().catch(() => ({ tx: undefined }))
  const db = await getDb()
  const rows = await db.query('SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [ws.id, hash])
  if (!rows.rows[0]) return c.json({ error: 'not found' }, 404)
  const chain = await onchainInvoice(ws, hash)
  if (!chain.paid) return c.json({ error: 'not paid on this vault', vault: ws.vault }, 400)
  const payment = await onchainPayment(ws, hash)
  await db.query(
    "UPDATE invoices SET status='paid', pay_tx=COALESCE($3, pay_tx), updated_at=NOW() WHERE workspace_id=$1 AND invoice_hash=$2",
    [ws.id, hash, body.tx || null]
  )
  await recordEvent(ws.id, hash, 'paid', { source: 'confirm-pay', tx: body.tx || null, vendor: payment.vendor })
  return c.json({ ok: true, invoiceHash: hash, vault: ws.vault, paid: true, tx: body.tx || null, vendor: payment.vendor })
})

app.get('/integrations/telegram', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  return c.json(await telegramStatus(ws.id))
})

app.post('/integrations/telegram/bind-code', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  if (ws.demo) return c.json({ error: 'DEMO workspace cannot bind Telegram. Create your own workspace.' }, 400)
  if (!config.telegramBotToken) return c.json({ error: 'telegram disabled' }, 503)
  const issued = await issueTelegramBindCode(ws.id)
  return c.json(issued)
})

app.post('/integrations/telegram/unbind', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  const ws = c.get('ws')
  await unbindTelegram(ws.id)
  return c.json({ ok: true })
})

app.post('/integrations/telegram', async (c) => {
  const denied = await requireWorkspace(c)
  if (denied) return denied
  return c.json({ error: 'Use /integrations/telegram/bind-code. Do not bind by chat id or MCP token.' }, 400)
})

app.post('/integrations/telegram/webhook', async (c) => {
  if (!config.telegramBotToken) return c.json({ error: 'telegram disabled' }, 503)
  if (config.telegramWebhookSecret) {
    const hdr = c.req.header('x-telegram-bot-api-secret-token')
    if (hdr !== config.telegramWebhookSecret) return c.json({ error: 'bad webhook secret' }, 401)
  }
  const update = await c.req.json()
  const out = await handleTelegramUpdate(update)
  return c.json(out)
})

app.get('/verify/:id', async (c) => {
  const id = c.req.param('id')
  const out = await verifyPayment(id)
  return c.json(JSON.parse(JSON.stringify(out, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))))
})
