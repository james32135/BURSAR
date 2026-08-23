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

