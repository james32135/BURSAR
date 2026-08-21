import { BursarClient } from '../../packages/sdk/src/index.ts'
import { config } from '../src/config.ts'
import test from 'node:test'
import assert from 'node:assert/strict'

const client = new BursarClient({
  baseUrl: process.env.BURSAR_API_URL || 'http://127.0.0.1:8787',
  token: config.apiToken,
})

test('sdk health', async () => {
  const h = await client.health()
  assert.equal(h.ok, true)
  assert.equal(h.chainId, 16661)
  assert.equal(h.settlement, 'vault-usdc.e-transfer')
})

test('sdk invalid auth', async () => {
  const bad = new BursarClient({ baseUrl: process.env.BURSAR_API_URL || 'http://127.0.0.1:8787', token: 'nope' })
  await assert.rejects(() => bad.queue(), /401/)
})

test('sdk missing invoice is 404', async () => {
  await assert.rejects(
    () => client.getInvoice('0x' + 'ab'.repeat(32)),
    (e: Error & { status?: number }) => e.status === 404
  )
})

test('sdk unauthorized missing pay is 404', async () => {
  await assert.rejects(
    () => client.pay('0x' + 'cd'.repeat(32)),
    (e: Error & { status?: number }) => e.status === 404
  )
})

test('sdk chain-derived verify of production Band-0 pay', async () => {
  const v = await client.verify('0x6e3cff64939839eacf888ec92acef3a61825ed0ae624e09e77a9ca910d1de70b')
  assert.equal(v.status, 'VERIFIED')
  assert.equal(v.didMoneyMove, true)
  assert.equal(v.goProof?.ok, true)
})
