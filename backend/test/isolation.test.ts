import test from 'node:test'
import assert from 'node:assert/strict'
import { ethers } from 'ethers'
import { encryptSecret, decryptSecret, sha256Hex } from '../src/crypto.ts'
import { getDb } from '../src/db.ts'
import { ensureDemoWorkspace, getWorkspaceByToken } from '../src/workspace.ts'
import { config } from '../src/config.ts'

test('secret round-trip', () => {
  const enc = encryptSecret('0xabc')
  assert.notEqual(enc, '0xabc')
  assert.equal(decryptSecret(enc), '0xabc')
})

test('demo token cannot be confused with a random token', async () => {
  await getDb()
  await ensureDemoWorkspace()
  const demo = await getWorkspaceByToken(`Bearer ${config.apiToken}`)
  assert.ok(demo)
  assert.equal(demo!.demo, true)
  const other = await getWorkspaceByToken('Bearer ' + sha256Hex('nope'))
  assert.equal(other, null)
})

test('workspace A cannot read workspace B invoices', async () => {
  await getDb()
  await ensureDemoWorkspace()
  const db = await getDb()
  const tokenA = ethers.hexlify(ethers.randomBytes(16))
  const tokenB = ethers.hexlify(ethers.randomBytes(16))
  const idA = 'iso-a-' + Date.now()
  const idB = 'iso-b-' + Date.now()
  const hash = ethers.hexlify(ethers.randomBytes(32))
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
  await db.query(
    `INSERT INTO invoices (workspace_id, invoice_hash, status) VALUES ($1,$2,'clean')`,
    [idA, hash]
  )
  await db.query(
    `INSERT INTO invoices (workspace_id, invoice_hash, status) VALUES ($1,$2,'clean')`,
    [idB, hash]
  )

  const wsA = await getWorkspaceByToken(`Bearer ${tokenA}`)
  const wsB = await getWorkspaceByToken(`Bearer ${tokenB}`)
  assert.equal(wsA?.id, idA)
  assert.equal(wsB?.id, idB)

  const aSeesB = await db.query('SELECT invoice_hash FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [wsA!.id, hash])
  const bSeesA = await db.query('SELECT invoice_hash FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [wsB!.id, hash])
  assert.equal(aSeesB.rows.length, 1)
  assert.equal(bSeesA.rows.length, 1)
  const cross = await db.query('SELECT invoice_hash FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2', [wsA!.id, 'nope'])
  assert.equal(cross.rows.length, 0)
})
