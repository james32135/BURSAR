import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ethers } from 'ethers'
import { Indexer, ZgFile, tryDecrypt } from '@0gfoundation/0g-storage-ts-sdk'
import { config } from './config.ts'
import { sha256Hex } from './util.ts'

function run(cmd: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolveP, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => resolveP({ code: code ?? 1, stdout, stderr }))
  })
}

export type StoragePut = {
  root: string
  flowTx: string
  txSeq: number | null
  recipientPubKey: string
  originalHash: string
  goProofOk: boolean
  goProofLog: string
  decryptMatch: boolean
}

export async function encryptUploadProve(pdf: Buffer, originalHash: string): Promise<StoragePut> {
  if (!existsSync(config.goClient)) throw new Error(`go storage client missing: ${config.goClient}`)
  const dir = mkdtempSync(join(tmpdir(), 'bursar-store-'))
  const pdfPath = join(dir, 'invoice.pdf')
  writeFileSync(pdfPath, pdf)

  const rpc = new ethers.JsonRpcProvider(config.rpcUrl)
  const storageWallet = new ethers.Wallet(config.storagePk, rpc)
  const owner = new ethers.Wallet(config.eciesPk)
  const recipientPubKey = ethers.SigningKey.computePublicKey(owner.privateKey, true)
  const indexer = new Indexer(config.indexer)
  const file = await ZgFile.fromFilePath(pdfPath)
  let upload: { txHash?: string; rootHash?: string; txSeq?: number; txHashes?: string[]; rootHashes?: string[]; txSeqs?: number[] } | null =
    null
  let err: unknown = null
  try {
    const [result, e] = await indexer.upload(file, config.rpcUrl, storageWallet, {
      encryption: { type: 'ecies', recipientPubKey },
      finalityRequired: true,
      expectedReplica: 1,
    })
    upload = result
    err = e
  } finally {
    await file.close()
  }
  if (err) throw new Error(String(err))
  const root = upload?.rootHash || upload?.rootHashes?.[0]
  const flowTx = upload?.txHash || upload?.txHashes?.[0]
  const txSeq = upload?.txSeq ?? upload?.txSeqs?.[0] ?? null
  if (!root || !flowTx) throw new Error('storage upload missing root/flow tx')

  const encPath = join(dir, 'downloaded.enc')
  const proof = await run(config.goClient, [
    'download',
    '--indexer',
    config.indexer,
    '--root',
    root,
    '--file',
    encPath,
    '--proof',
  ])
  const goProofOk = proof.code === 0 && proof.stderr.includes('Succeeded to validate the downloaded file')
  if (!goProofOk) throw new Error(`go proof failed: ${proof.stderr.slice(-500)}`)

  const encBytes = readFileSync(encPath)
  const out = tryDecrypt(encBytes, { privateKey: config.eciesPk })
  const decryptMatch = out.decrypted && sha256Hex(out.bytes) === originalHash
  if (!decryptMatch) throw new Error('decrypt/hash mismatch')

  return {
    root,
    flowTx,
    txSeq: txSeq == null ? null : Number(txSeq),
    recipientPubKey,
    originalHash,
    goProofOk,
    goProofLog: proof.stderr.slice(-2000),
    decryptMatch,
  }
}

export async function goProofDownload(root: string): Promise<{ ok: boolean; log: string }> {
  if (!existsSync(config.goClient)) return { ok: false, log: 'missing-go-client' }
  const dir = mkdtempSync(join(tmpdir(), 'bursar-proof-'))
  const out = join(dir, 'file.bin')
  const proof = await run(config.goClient, ['download', '--indexer', config.indexer, '--root', root, '--file', out, '--proof'])
  return {
    ok: proof.code === 0 && proof.stderr.includes('Succeeded to validate the downloaded file'),
    log: proof.stderr.slice(-2000),
  }
}
