import { ethers } from 'ethers'
import { config, ERC20_ABI, VAULT_ABI } from './config.ts'
import type { Workspace } from './workspace.ts'

export type VaultCtx = Pick<Workspace, 'vault' | 'sessionId' | 'sessionPk'>

export function getProvider() {
  return new ethers.JsonRpcProvider(config.rpcUrl)
}

export function demoCtx(): VaultCtx {
  return { vault: config.vault, sessionId: ethers.id('prod-allow'), sessionPk: config.sessionPk }
}

export function getVault(ctx: VaultCtx, signer?: ethers.Signer) {
  const rpc = getProvider()
  return new ethers.Contract(ctx.vault, VAULT_ABI, signer || rpc)
}

export async function waitTx(tx: ethers.TransactionResponse) {
  for (let i = 0; i < 32; i++) {
    try {
      return await tx.wait()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('no matching receipts') && !msg.includes('UNKNOWN_ERROR')) throw e
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  const rec = await tx.provider.getTransactionReceipt(tx.hash)
  if (!rec) throw new Error('receipt missing ' + tx.hash)
  return rec
}

export async function vendorAllowed(ctx: VaultCtx, addr: string) {
  return Boolean(await getVault(ctx).vendorAllowed(addr))
}

export async function ensureAgentGas(sessionPk: string) {
  const rpc = getProvider()
  const agent = new ethers.Wallet(sessionPk, rpc)
  const bal = await rpc.getBalance(agent.address)
  const min = ethers.parseEther('0.008')
  if (bal >= min) return { funded: false, agent: agent.address, balance: bal.toString() }
  const sponsor = new ethers.Wallet(config.computePk, rpc)
  const tx = await sponsor.sendTransaction({ to: agent.address, value: ethers.parseEther('0.02') })
  await waitTx(tx)
  return { funded: true, agent: agent.address, tx: tx.hash, balance: (await rpc.getBalance(agent.address)).toString() }
}

export async function registerInvoice(ctx: VaultCtx, invoiceHash: string, storageRoot: string) {
  await ensureAgentGas(ctx.sessionPk)
  const wallet = new ethers.Wallet(ctx.sessionPk, getProvider())
  const vault = getVault(ctx, wallet)
  const tx = await vault.registerInvoice(ctx.sessionId, invoiceHash, storageRoot)
  const rec = await waitTx(tx)
  return rec.hash
}

export async function sessionPay(
  ctx: VaultCtx,
  args: {
    vendor: string
    amount: bigint
    invoiceHash: string
    storageRoot: string
    responseHash: string
    recoveredSigner: string
  }
) {
  await ensureAgentGas(ctx.sessionPk)
  const wallet = new ethers.Wallet(ctx.sessionPk, getProvider())
  const vault = getVault(ctx, wallet)
  const usdc = new ethers.Contract(config.usdc, ERC20_ABI, getProvider())
  const preVault = await usdc.balanceOf(ctx.vault)
  const preVendor = await usdc.balanceOf(args.vendor)
  const tx = await vault.pay(
    ctx.sessionId,
    args.vendor,
    args.amount,
    args.invoiceHash,
    args.storageRoot,
    args.responseHash,
    args.recoveredSigner
  )
