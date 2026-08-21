import test from 'node:test'
import assert from 'node:assert/strict'
import { ethers } from 'ethers'
import { app } from '../src/app.ts'
import { encryptSecret, sha256Hex } from '../src/crypto.ts'
import { getDb } from '../src/db.ts'
import { ensureDemoWorkspace } from '../src/workspace.ts'

test('HTTP: workspace A cannot read or pay workspace B invoices', async () => {
  await getDb()
  await ensureDemoWorkspace()
  const db = await getDb()
  const tokenA = ethers.hexlify(ethers.randomBytes(16))
  const tokenB = ethers.hexlify(ethers.randomBytes(16))
  const idA = 'http-a-' + Date.now()
  const idB = 'http-b-' + Date.now()
  const hashA = '0x' + '11'.repeat(32)
  const hashB = '0x' + '22'.repeat(32)
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)`,
    [idA, '0x' + '11'.repeat(20), ethers.hexlify(ethers.randomBytes(20)), ethers.id(idA), '0x' + 'aa'.repeat(20), encryptSecret(ethers.Wallet.createRandom().privateKey), sha256Hex(tokenA)]
  )
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)`,
    [idB, '0x' + '22'.repeat(20), ethers.hexlify(ethers.randomBytes(20)), ethers.id(idB), '0x' + 'bb'.repeat(20), encryptSecret(ethers.Wallet.createRandom().privateKey), sha256Hex(tokenB)]
  )
  await db.query(`INSERT INTO invoices (workspace_id, invoice_hash, status) VALUES ($1,$2,'clean')`, [idA, hashA])
  await db.query(`INSERT INTO invoices (workspace_id, invoice_hash, status) VALUES ($1,$2,'clean')`, [idB, hashB])

  const queueA = await app.request('/queue', { headers: { authorization: `Bearer ${tokenA}` } })
  const queueB = await app.request('/queue', { headers: { authorization: `Bearer ${tokenB}` } })
  assert.equal(queueA.status, 200)
  assert.equal(queueB.status, 200)
  const jsonA = await queueA.json() as { invoices: { invoiceHash: string }[] }
  const jsonB = await queueB.json() as { invoices: { invoiceHash: string }[] }
  assert.equal(jsonA.invoices.some((i) => i.invoiceHash === hashB), false)
  assert.equal(jsonB.invoices.some((i) => i.invoiceHash === hashA), false)
  assert.equal(jsonA.invoices.some((i) => i.invoiceHash === hashA), true)
  assert.equal(jsonB.invoices.some((i) => i.invoiceHash === hashB), true)

  const steal = await app.request('/invoices/' + hashB, { headers: { authorization: `Bearer ${tokenA}` } })
  assert.equal(steal.status, 404)

  const paySteal = await app.request('/invoices/' + hashB + '/pay', {
    method: 'POST',
    headers: { authorization: `Bearer ${tokenA}` },
  })
  assert.equal(paySteal.status, 404)

  const noAuth = await app.request('/queue')
  assert.equal(noAuth.status, 401)
})
