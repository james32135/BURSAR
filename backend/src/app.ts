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

