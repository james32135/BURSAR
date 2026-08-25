import { createPublicClient, createWalletClient, custom, http, decodeEventLog } from 'viem'
import { aristotle, factoryAbi, vaultAbi, usdcAbi } from '@/lib/chain'
import { LIVE } from '@/lib/live'
import { loadWorkspace } from '@/lib/workspace'

const ARISTOTLE_HEX = '0x4115'

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export type OwnerWallet = {
  switchChain?: (chainId: number) => Promise<void>
  getEthereumProvider: () => Promise<Eip1193>
}

function ownerOf() {
  return (loadWorkspace()?.owner || LIVE.owner).toLowerCase()
}

function vaultOf() {
  return (loadWorkspace()?.vault || LIVE.vault) as `0x${string}`
}

function nestedCode(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const e = err as { code?: number; data?: { originalError?: { code?: number } } }
  return e.data?.originalError?.code ?? e.code
}

async function readChainId(ethereum: Eip1193) {
  const raw = await ethereum.request({ method: 'eth_chainId' })
  return Number(raw)
}

async function addAristotle(ethereum: Eip1193) {
  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId: ARISTOTLE_HEX,
        chainName: '0G Aristotle',
        nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
        rpcUrls: [LIVE.rpc],
        blockExplorerUrls: ['https://chainscan.0g.ai'],
      },
    ],
  })
}

export async function ensureAristotle(wallet: OwnerWallet): Promise<Eip1193> {
  if (wallet.switchChain) {
    try {
      await wallet.switchChain(LIVE.chainId)
    } catch {
      /* MetaMask may still need EIP-1193 add/switch */
    }
  }
  const ethereum = await wallet.getEthereumProvider()
  if ((await readChainId(ethereum)) === LIVE.chainId) return ethereum

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARISTOTLE_HEX }],
    })
  } catch (err) {
    const code = nestedCode(err)
    if (code === 4902 || code === -32603) {
      await addAristotle(ethereum)
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARISTOTLE_HEX }],
      })
    } else if (code === 4001) {
      throw new Error('Approve the network switch to 0G Aristotle (16661) in MetaMask.')
    } else {
      try {
        await addAristotle(ethereum)
      } catch (addErr) {
        if (nestedCode(addErr) === 4001) {
          throw new Error('Approve adding 0G Aristotle (16661) in MetaMask.')
        }
        throw addErr
      }
    }
  }

  for (let i = 0; i < 20; i++) {
    if ((await readChainId(ethereum)) === LIVE.chainId) return ethereum
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('MetaMask is not on 0G Aristotle (16661). Open MetaMask, select 0G Aristotle, then retry.')
}

export function formatOwnerError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('does not match the target chain') || msg.includes('Current Chain ID: 1')) {
    return 'MetaMask is still on Ethereum. Approve the switch to 0G Aristotle (16661), then retry.'
  }
  if (msg.includes('User rejected') || msg.includes('user rejected')) {
    return 'Signature rejected in MetaMask.'
  }
  const first = msg.split('\n')[0]
  return first.length > 220 ? first.slice(0, 220) + '…' : first
}

async function connectedClient(ethereum: Eip1193) {
  if ((await readChainId(ethereum)) !== LIVE.chainId) {
    throw new Error('MetaMask is not on 0G Aristotle (16661). Approve the switch, then retry.')
  }
  const walletClient = createWalletClient({
    chain: aristotle,
    transport: custom(ethereum as never),
  })
  const [account] = await walletClient.getAddresses()
  return { walletClient, account, publicClient: createPublicClient({ chain: aristotle, transport: http(LIVE.rpc) }) }
}

export async function ownerWrite(
  ethereum: Eip1193,
  functionName: 'setPaused' | 'setVendor' | 'revokeSession' | 'withdraw' | 'createSession',
  args: readonly unknown[]
) {
  const { walletClient, account } = await connectedClient(ethereum)
  if (account.toLowerCase() !== ownerOf()) {
    throw new Error('connected wallet is not this workspace owner')
  }
  return walletClient.writeContract({
    address: vaultOf(),
    abi: vaultAbi,
    functionName,
    args: args as never,
    account,
    chain: aristotle,
  })
}

export async function createVault(ethereum: Eip1193) {
  const { walletClient, account, publicClient } = await connectedClient(ethereum)
  const hash = await walletClient.writeContract({
    address: LIVE.factory as `0x${string}`,
    abi: factoryAbi,
    functionName: 'createVault',
    args: [LIVE.usdc as `0x${string}`, 200_000_000n, 10_000_000_000n],
    account,
    chain: aristotle,
  })
  const rec = await publicClient.waitForTransactionReceipt({ hash })
  let vault = ''
  for (const log of rec.logs) {
    try {
      const parsed = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics })
      if (parsed.eventName === 'VaultCreated') vault = String(parsed.args.vault)
    } catch {
      /* skip */
    }
  }
  if (!vault) throw new Error('VaultCreated event missing')
  return { hash, vault }
}

export async function fundVault(ethereum: Eip1193, amount: bigint) {
  const { walletClient, account } = await connectedClient(ethereum)
  return walletClient.writeContract({
    address: LIVE.usdc as `0x${string}`,
    abi: usdcAbi,
    functionName: 'transfer',
    args: [vaultOf(), amount],
    account,
    chain: aristotle,
  })
}

export async function ownerPayInvoice(
  ethereum: Eip1193,
  args: {
    vendor: `0x${string}`
    amount: bigint
    invoiceHash: `0x${string}`
    storageRoot: `0x${string}`
    responseHash: `0x${string}`
    recoveredSigner: `0x${string}`
  }
) {
  const { walletClient, account, publicClient } = await connectedClient(ethereum)
  if (account.toLowerCase() !== ownerOf()) {
    throw new Error('connected wallet is not this workspace owner')
  }
  const hash = await walletClient.writeContract({
    address: vaultOf(),
    abi: vaultAbi,
    functionName: 'ownerPay',
    args: [args.vendor, args.amount, args.invoiceHash, args.storageRoot, args.responseHash, args.recoveredSigner],
    account,
    chain: aristotle,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function signBind(ethereum: Eip1193, vault: string, issuedAt: number) {
  const { walletClient, account } = await connectedClient(ethereum)
  const message = `BURSAR bind\nchain ${LIVE.chainId}\nvault ${vault.toLowerCase()}\ntime ${issuedAt}`
  const signature = await walletClient.signMessage({ account, message })
  return { account, message, signature, issuedAt }
}

/** Personal sign only. Does not switch MetaMask to Aristotle. */
export async function signResume(ethereum: Eip1193, issuedAt: number) {
  const walletClient = createWalletClient({
    transport: custom(ethereum as never),
  })
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('Connect the owner wallet first')
  const message = `BURSAR resume\nchain ${LIVE.chainId}\ntime ${issuedAt}`
  const signature = await walletClient.signMessage({ account, message })
  return { account, message, signature, issuedAt }
}

export async function listFactoryVaults(owner: string) {
  const publicClient = createPublicClient({ chain: aristotle, transport: http(LIVE.rpc) })
  return publicClient.readContract({
    address: LIVE.factory as `0x${string}`,
    abi: factoryAbi,
    functionName: 'vaultsOf',
    args: [owner as `0x${string}`],
  })
}
