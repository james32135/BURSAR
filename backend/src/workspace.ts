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

export async function bindWorkspace(args: { vault: string; signature: string; issuedAt: number }) {
  const vaultAddr = ethers.getAddress(args.vault)
  if (Date.now() / 1000 - args.issuedAt > 600 || args.issuedAt > Date.now() / 1000 + 60) {
    throw new Error('bind signature expired')
  }
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
