import { randomBytes } from 'node:crypto'
import { ethers } from 'ethers'
import { config, FACTORY_ABI, VAULT_ABI } from './config.ts'
import { decryptSecret, encryptSecret, sha256Hex } from './crypto.ts'
import { getDb } from './db.ts'

export type Workspace = {
  id: string
  owner: string
  vault: string
  sessionId: string
  agentAddress: string
  sessionPk: string
  demo: boolean
  createdAt: string
}

const DEMO_ID = 'demo'

function rowToWorkspace(row: Record<string, unknown>, sessionPk: string): Workspace {
  return {
    id: String(row.id),
    owner: String(row.owner),
    vault: String(row.vault),
    sessionId: String(row.session_id),
    agentAddress: String(row.agent_address),
    sessionPk,
    demo: Boolean(row.demo),
    createdAt: String(row.created_at || ''),
  }
}

export async function ensureDemoWorkspace() {
  const db = await getDb()
  const existing = await db.query('SELECT id FROM workspaces WHERE id = $1', [DEMO_ID])
  if (existing.rows[0]) return
  const wallet = new ethers.Wallet(config.sessionPk)
  const token = config.apiToken || `demo-${randomBytes(16).toString('hex')}`
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`,
    [
      DEMO_ID,
      config.owner.toLowerCase(),
      config.vault.toLowerCase(),
      ethers.id('prod-allow'),
      wallet.address.toLowerCase(),
      encryptSecret(config.sessionPk),
      sha256Hex(token),
    ]
  )
  await db.query(`UPDATE invoices SET workspace_id = $1 WHERE workspace_id IS NULL`, [DEMO_ID])
}

export async function getWorkspaceByToken(bearer: string | undefined): Promise<Workspace | null> {
  if (!bearer) return null
  const token = bearer.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const db = await getDb()
  const hash = sha256Hex(token)
  const rows = await db.query('SELECT * FROM workspaces WHERE token_hash = $1', [hash])
  const row = rows.rows[0]
  if (!row) return null
  return rowToWorkspace(row, decryptSecret(String(row.agent_pk_enc)))
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const db = await getDb()
  const rows = await db.query('SELECT * FROM workspaces WHERE id = $1', [id])
  const row = rows.rows[0]
  if (!row) return null
  return rowToWorkspace(row, decryptSecret(String(row.agent_pk_enc)))
}

export function bindMessage(chainId: number, vault: string, issuedAt: number) {
  return `BURSAR bind\nchain ${chainId}\nvault ${vault.toLowerCase()}\ntime ${issuedAt}`
}

export function resumeMessage(chainId: number, issuedAt: number) {
  return `BURSAR resume\nchain ${chainId}\ntime ${issuedAt}`
}

function assertFreshTimestamp(issuedAt: number) {
  if (Date.now() / 1000 - issuedAt > 600 || issuedAt > Date.now() / 1000 + 60) {
    throw new Error('bind signature expired')
  }
}

export async function resumeWorkspace(args: { signature: string; issuedAt: number }) {
  assertFreshTimestamp(args.issuedAt)
  const message = resumeMessage(config.chainId, args.issuedAt)
  const recovered = ethers.verifyMessage(message, args.signature).toLowerCase()
  const db = await getDb()
  const demoVault = config.vault.toLowerCase()
  let found = await db.query(
    `SELECT * FROM workspaces
     WHERE lower(owner) = $1 AND lower(vault) <> $2
     ORDER BY created_at DESC LIMIT 1`,
    [recovered, demoVault]
  )
  if (!found.rows[0] && config.factory) {
    const rpc = new ethers.JsonRpcProvider(config.rpcUrl)
    const factory = new ethers.Contract(config.factory, FACTORY_ABI, rpc)
    const vaults = (await factory.vaultsOf(recovered)) as string[]
    const addrs = vaults.map((v) => String(v).toLowerCase()).filter((v) => v !== demoVault)
    if (addrs.length) {
      found = await db.query(
        `SELECT * FROM workspaces WHERE vault = ANY($1::text[]) ORDER BY created_at DESC LIMIT 1`,
        [addrs]
      )
    }
  }
  const row = found.rows[0]
  if (!row) {
    throw new Error('no isolated workspace for this owner — bind the factory vault instead of creating another')
  }
  const agentToken = ethers.hexlify(randomBytes(32))
  await db.query(`UPDATE workspaces SET token_hash = $1 WHERE id = $2`, [sha256Hex(agentToken), row.id])
  const ws = rowToWorkspace(row, decryptSecret(String(row.agent_pk_enc)))
  return {
    ...publicWorkspace(ws, agentToken),
    next: ['open-desk'],
  }
}

export async function bindWorkspace(args: { vault: string; signature: string; issuedAt: number }) {
  const vaultAddr = ethers.getAddress(args.vault)
  assertFreshTimestamp(args.issuedAt)
  const message = bindMessage(config.chainId, vaultAddr, args.issuedAt)
  const recovered = ethers.verifyMessage(message, args.signature)
  const rpc = new ethers.JsonRpcProvider(config.rpcUrl)
  const vault = new ethers.Contract(vaultAddr, VAULT_ABI, rpc)
  const owner = String(await vault.owner())
  const token = String(await vault.token())
  if (owner.toLowerCase() !== recovered.toLowerCase()) {
    throw new Error('signer is not the vault owner')
  }
  if (token.toLowerCase() !== config.usdc.toLowerCase()) {
    throw new Error('vault token is not USDC.e')
  }
  const isDemo = vaultAddr.toLowerCase() === config.vault.toLowerCase()
  if (!isDemo) {
    if (!config.factory) throw new Error('BURSAR_FACTORY is not configured')
    const factory = new ethers.Contract(config.factory, FACTORY_ABI, rpc)
    const ok = Boolean(await factory.isVault(vaultAddr))
    if (!ok) throw new Error('vault was not created by BursarFactory')
  }

  const db = await getDb()
  const already = await db.query('SELECT id FROM workspaces WHERE vault = $1', [vaultAddr.toLowerCase()])
  if (already.rows[0]) {
    throw new Error('vault already bound — resume this desk instead of creating another vault')
  }

  const agent = ethers.Wallet.createRandom()
  const id = ethers.hexlify(randomBytes(16)).slice(2)
  const sessionId = ethers.id(`bursar:${id}`)
  const agentToken = ethers.hexlify(randomBytes(32))
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)`,
    [
      id,
      owner.toLowerCase(),
      vaultAddr.toLowerCase(),
      sessionId,
      agent.address.toLowerCase(),
      encryptSecret(agent.privateKey),
      sha256Hex(agentToken),
    ]
  )
  const { ensureAgentGas } = await import('./vault.ts')
  await ensureAgentGas(agent.privateKey)
  return {
    id,
    owner: owner.toLowerCase(),
    vault: vaultAddr.toLowerCase(),
    sessionId,
    agentAddress: agent.address,
    agentToken,
    demo: false,
    next: ['createSession', 'setVendor', 'fund'],
  }
}

export async function workspaceStats(workspaceId: string) {
  const db = await getDb()
  const rows = await db.query(
    `SELECT
        count(*)::int AS processed,
        count(*) FILTER (WHERE status = 'paid')::int AS paid,
        count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        count(*) FILTER (WHERE status = 'flagged')::int AS escalated,
        count(*) FILTER (WHERE status = 'clean')::int AS auto_pay_ready,
        coalesce(sum(amount_units) FILTER (WHERE status = 'paid'), 0)::text AS routed
     FROM invoices WHERE workspace_id = $1`,
    [workspaceId]
  )
  const r = rows.rows[0] || {}
  return {
    processed: Number(r.processed || 0),
    paid: Number(r.paid || 0),
    blocked: Number(r.blocked || 0),
    escalated: Number(r.escalated || 0),
    autoPayReady: Number(r.auto_pay_ready || 0),
    routedUnits: String(r.routed || '0'),
    policyViolations: Number(r.blocked || 0),
  }
}

export async function rotateWorkspaceSession(ws: Workspace) {
  const db = await getDb()
  const sessionId = ethers.hexlify(randomBytes(32))
  await db.query(`UPDATE workspaces SET session_id = $2 WHERE id = $1`, [ws.id, sessionId])
  return {
    id: ws.id,
    owner: ws.owner,
    vault: ws.vault,
    sessionId,
    agentAddress: ws.agentAddress,
    demo: ws.demo,
    note: 'Owner must createSession on-chain with this new id. The previous session id stays revoked and cannot be reused.',
  }
}

export function publicWorkspace(ws: Workspace, agentToken?: string) {
  return {
    id: ws.id,
    owner: ws.owner,
    vault: ws.vault,
    sessionId: ws.sessionId,
    agentAddress: ws.agentAddress,
    demo: ws.demo,
    createdAt: ws.createdAt,
    ...(agentToken ? { agentToken } : {}),
  }
}
