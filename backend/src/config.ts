import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const BACKEND_ROOT = resolve(here, '..')
export const BURSAR_ROOT = resolve(BACKEND_ROOT, '..')

function loadDotEnv(path: string) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i)
    const v = t.slice(i + 1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadDotEnv(resolve(BURSAR_ROOT, '.env'))

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`missing env ${name}`)
  return v
}

function goClientPath() {
  const fromEnv = process.env.BURSAR_GO_STORAGE_CLIENT
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const win = resolve(BURSAR_ROOT, 'spikes/bin/0g-storage-client.exe')
  const nix = '/usr/local/bin/0g-storage-client'
  if (existsSync(win)) return win
  if (existsSync(nix)) return nix
  return fromEnv || win
}

export const config = {
  port: Number(process.env.PORT || process.env.BURSAR_API_PORT || 8787),
  chainId: Number(process.env.BURSAR_CHAIN_ID || 16661),
  rpcUrl: process.env.BURSAR_RPC_URL || 'https://evmrpc.0g.ai',
  explorer: process.env.BURSAR_EXPLORER_URL || 'https://chainscan.0g.ai',
  storageScan: process.env.BURSAR_STORAGESCAN_URL || 'https://storagescan.0g.ai',
  vault: req('BURSAR_VAULT'),
  factory: process.env.BURSAR_FACTORY || '',
  agentId: process.env.BURSAR_AGENT_ID || '',
  usdc: process.env.USDC_E_ADDRESS || '0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E',
  owner: req('BURSAR_OWNER_ADDRESS'),
  sessionPk: req('BURSAR_SESSION_PRIVATE_KEY'),
  computePk: req('BURSAR_DEPLOYER_PRIVATE_KEY'),
  storagePk: req('OG_STORAGE_PRIVATE_KEY'),
  eciesPk: req('BURSAR_OWNER_ECIES_PRIVATE_KEY'),
  indexer: process.env.OG_STORAGE_INDEXER || 'https://indexer-storage-turbo.0g.ai',
  inference: process.env.OG_INFERENCE_SERVING || '0x47340d900bdFec2BD393c626E12ea0656F938d84',
  visionProvider: process.env.OG_DIRECT_PROVIDER_ADDRESS || '0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9',
  visionModel: process.env.OG_DIRECT_MODEL || '0gm-1.0-35b-a3b',
  goClient: goClientPath(),
  apiToken: process.env.BURSAR_MCP_TOKEN_SECRET || '',
  databaseUrl: process.env.BURSAR_DATABASE_URL || '',
  pgliteDir: process.env.BURSAR_PGLITE_DIR || resolve(BACKEND_ROOT, 'data/pglite'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME || 'BURSARxbot').replace(/^@/, ''),
  emailInboundSecret: process.env.EMAIL_INBOUND_SECRET || '',
  emailInboundAddress: process.env.EMAIL_INBOUND_ADDRESS || '',
}

export const VAULT_ABI = [
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function token() view returns (address)',
  'function band0Max() view returns (uint256)',
  'function band1Max() view returns (uint256)',
  'function policyVersion() view returns (uint64)',
  'function vendorAllowed(address) view returns (bool)',
  'function invoices(bytes32) view returns (bool registered, bool paid, bytes32 storageRoot)',
  'function payments(bytes32) view returns (address vendor, uint256 amount, bytes32 storageRoot, bytes32 responseHash, address recoveredSigner, bytes32 sessionId, uint64 paidAt, uint64 policyVersion)',
  'function sessions(bytes32) view returns (address agent, uint256 cap, uint256 spent, uint64 expiry, bool revoked, bool exists)',
  'function createSession(bytes32 id, address agent, uint256 cap, uint64 expiry)',
  'function registerInvoice(bytes32 sessionId, bytes32 invoiceHash, bytes32 storageRoot)',
  'function pay(bytes32 sessionId, address vendor, uint256 amount, bytes32 invoiceHash, bytes32 storageRoot, bytes32 responseHash, address recoveredSigner)',
  'function ownerPay(address vendor, uint256 amount, bytes32 invoiceHash, bytes32 storageRoot, bytes32 responseHash, address recoveredSigner)',
  'function setPaused(bool v)',
  'function setVendor(address vendor, bool allowed)',
  'function setBands(uint256 band0Max, uint256 band1Max)',
  'function revokeSession(bytes32 id)',
  'function withdraw(address to, uint256 amount)',
  'event Paid(bytes32 indexed sessionId, address indexed vendor, bytes32 indexed invoiceHash, uint256 amount, bytes32 storageRoot, bytes32 responseHash, address recoveredSigner, uint64 policyVersion)',
]

export const FACTORY_ABI = [
  'function createVault(address token, uint256 band0Max, uint256 band1Max) returns (address)',
  'function isVault(address) view returns (bool)',
  'function vaultCount(address) view returns (uint256)',
  'function vaultAt(address,uint256) view returns (address)',
  'function vaultsOf(address) view returns (address[])',
  'event VaultCreated(address indexed owner, address indexed vault, address token, uint256 band0Max, uint256 band1Max)',
]

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address,uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

export const INFERENCE_ABI = [
  'function getService(address provider) view returns (tuple(address provider, string serviceType, string url, uint256 inputPrice, uint256 outputPrice, uint256 updatedAt, string model, string verifiability, string additionalInfo, address teeSignerAddress, bool teeSignerAcknowledged))',
]
