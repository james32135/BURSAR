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

test('HTTP: unsupported payment rail is 400 and does not ingest', async () => {
  await getDb()
  const db = await getDb()
  const token = ethers.hexlify(ethers.randomBytes(16))
  const id = 'http-rail-' + Date.now()
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)`,
    [
      id,
      '0x' + '33'.repeat(20),
      ethers.hexlify(ethers.randomBytes(20)),
      ethers.id(id),
      '0x' + 'cc'.repeat(20),
      encryptSecret(ethers.Wallet.createRandom().privateKey),
      sha256Hex(token),
    ]
  )
  const res = await app.request('/payables', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      vendor: 'Wire Corp',
      remittance: '0x1111111111111111111111111111111111111111',
      amountUsd: '10',
      rail: 'wire',
    }),
  })
  assert.equal(res.status, 400)
  const body = (await res.json()) as { error?: string; detail?: string }
  assert.equal(body.error, 'unsupported-payment-rail')
  assert.match(String(body.detail), /UNSUPPORTED PAYMENT RAIL/)
  const rows = await db.query(`SELECT invoice_hash FROM invoices WHERE workspace_id = $1`, [id])
  assert.equal(rows.rows.length, 0)
})

test('HTTP: agent cannot write obligation bounds', async () => {
  await getDb()
  const db = await getDb()
  const token = ethers.hexlify(ethers.randomBytes(16))
  const id = 'http-ob-' + Date.now()
  await db.query(
    `INSERT INTO workspaces (id, owner, vault, session_id, agent_address, agent_pk_enc, token_hash, demo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE)`,
    [
      id,
      '0x' + '44'.repeat(20),
      ethers.hexlify(ethers.randomBytes(20)),
      ethers.id(id),
      '0x' + 'dd'.repeat(20),
      encryptSecret(ethers.Wallet.createRandom().privateKey),
      sha256Hex(token),
    ]
  )
  const res = await app.request('/obligations', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      vendor: 'Contoso',
      remittance: '0x1111111111111111111111111111111111111111',
      expectedMinUsd: '0',
      expectedMaxUsd: '999999',
    }),
  })
  assert.equal(res.status, 403)
  const listed = await app.request('/obligations', { headers: { authorization: `Bearer ${token}` } })
  assert.equal(listed.status, 200)
  const body = (await listed.json()) as { obligations: unknown[] }
  assert.equal(body.obligations.length, 0)
})
