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
  const rec = await waitTx(tx)
  const postVault = await usdc.balanceOf(ctx.vault)
  const postVendor = await usdc.balanceOf(args.vendor)
  const moved = BigInt(postVendor) - BigInt(preVendor)
  return {
    hash: rec.hash,
    explorer: `${config.explorer}/tx/${rec.hash}`,
    vault: ctx.vault,
    preVault: preVault.toString(),
    postVault: postVault.toString(),
    preVendor: preVendor.toString(),
    postVendor: postVendor.toString(),
    moneyMoved: moved.toString(),
    didMoneyMove: moved === args.amount,
    status: rec.status,
  }
}

export async function onchainInvoice(ctx: VaultCtx, invoiceHash: string) {
  const row = await getVault(ctx).invoices(invoiceHash)
  return { registered: Boolean(row.registered), paid: Boolean(row.paid), storageRoot: row.storageRoot }
}

export async function onchainPayment(ctx: VaultCtx, invoiceHash: string) {
  return getVault(ctx).payments(invoiceHash)
}

export async function sessionState(ctx: VaultCtx) {
  const row = await getVault(ctx).sessions(ctx.sessionId)
  return {
    id: ctx.sessionId,
    agent: row.agent,
    cap: row.cap.toString(),
    spent: row.spent.toString(),
    remaining: (BigInt(row.cap) - BigInt(row.spent)).toString(),
    expiry: row.expiry.toString(),
    revoked: Boolean(row.revoked),
    exists: Boolean(row.exists),
  }
}

export async function vaultState(ctx: VaultCtx) {
  const v = getVault(ctx)
  const usdc = new ethers.Contract(config.usdc, ERC20_ABI, getProvider())
  return {
    vault: ctx.vault,
    owner: await v.owner(),
    paused: await v.paused(),
    band0Max: (await v.band0Max()).toString(),
    band1Max: (await v.band1Max()).toString(),
    policyVersion: (await v.policyVersion()).toString(),
    usdc: (await usdc.balanceOf(ctx.vault)).toString(),
  }
}

async function agentCallReverts(
  ctx: VaultCtx,
  fn: 'withdraw' | 'setVendor' | 'setPaused' | 'setBands' | 'revokeSession',
  args: unknown[]
): Promise<{ fn: string; reverted: boolean; reason: string }> {
  const wallet = new ethers.Wallet(ctx.sessionPk, getProvider())
  const vault = getVault(ctx, wallet)
  try {
    if (fn === 'withdraw') await vault.withdraw.staticCall(args[0], args[1])
    else if (fn === 'setVendor') await vault.setVendor.staticCall(args[0], args[1])
    else if (fn === 'setPaused') await vault.setPaused.staticCall(args[0])
    else if (fn === 'setBands') await vault.setBands.staticCall(args[0], args[1])
    else await vault.revokeSession.staticCall(args[0])
    return { fn, reverted: false, reason: 'call-succeeded' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const selector = msg.match(/data="(0x[0-9a-f]{8})/i)?.[1]
    const reason = selector === '0x30cd7471'
      ? 'NotOwner'
      : msg.includes('NotOwner')
      ? 'NotOwner'
      : msg.includes('NotAgent')
        ? 'NotAgent'
        : msg.split('\n')[0].slice(0, 180)
    return { fn, reverted: true, reason }
  }
}

export async function agentForbiddenCalls(ctx: VaultCtx & { owner?: string; agentAddress?: string }) {
  const owner = ctx.owner || (await getVault(ctx).owner())
  const one = 1n
  const [withdraw, setVendor, setPaused, setBands, revokeSession] = await Promise.all([
    agentCallReverts(ctx, 'withdraw', [owner, one]),
    agentCallReverts(ctx, 'setVendor', [owner, true]),
    agentCallReverts(ctx, 'setPaused', [true]),
    agentCallReverts(ctx, 'setBands', [one, one]),
    agentCallReverts(ctx, 'revokeSession', [ctx.sessionId]),
  ])
  const calls = [withdraw, setVendor, setPaused, setBands, revokeSession]
  return {
    agent: new ethers.Wallet(ctx.sessionPk).address,
    expectedAgent: ctx.agentAddress || null,
    allReverted: calls.every((c) => c.reverted),
    calls,
    note: 'The scoped agent key is not the owner. These owner-only writes must revert. This is a security property, not a missing feature.',
  }
}
