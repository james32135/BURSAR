import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXPECTED_TEE_SIGNER, payGateReason, payRevertReason } from '../src/pay.ts'

const base = {
  status: 'clean',
  decision: 'auto-pay' as string | null,
  flags: [] as { code?: string; severity?: string }[],
  attestationOk: true,
  paused: false,
  revoked: false,
  exists: true,
  expiry: Math.floor(Date.now() / 1000) + 3600,
  now: Math.floor(Date.now() / 1000),
  amount: 1000n,
  band0: 200_000000n,
  remaining: 200_000000n,
  vaultUsdc: 1000n,
  vendorAllowed: true,
  recoveredSigner: EXPECTED_TEE_SIGNER,
  pipeline: 'ready' as string | null,
  updatedAt: new Date().toISOString(),
}

test('pay gate allows a clean Band 0 payable', () => {
  assert.equal(payGateReason(base), null)
})

test('pay gate blocks already paid, owner review, and severity block', () => {
  assert.equal(payGateReason({ ...base, status: 'paid' })?.error, 'already paid')
  assert.equal(payGateReason({ ...base, status: 'flagged', decision: 'owner-review' })?.error, 'owner-review')
  assert.equal(
    payGateReason({ ...base, flags: [{ code: 'vendor-not-allowlisted', severity: 'block' }] })?.error,
    'blocked'
  )
})

test('pay gate blocks paused, revoked, expired, over-band, over-cap, empty vault, unknown vendor', () => {
  assert.equal(payGateReason({ ...base, paused: true })?.error, 'paused')
  assert.equal(payGateReason({ ...base, revoked: true })?.error, 'session-revoked')
  assert.equal(payGateReason({ ...base, exists: false })?.error, 'session-revoked')
  assert.equal(payGateReason({ ...base, expiry: base.now - 1 })?.error, 'session-expired')
  assert.equal(payGateReason({ ...base, amount: 201_000000n })?.error, 'over-band0')
  assert.equal(payGateReason({ ...base, remaining: 500n })?.error, 'over-session-cap')
  assert.equal(payGateReason({ ...base, vaultUsdc: 0n })?.error, 'insufficient-vault-balance')
  assert.equal(payGateReason({ ...base, vendorAllowed: false })?.error, 'vendor-not-allowlisted')
})

test('pay gate rejects invalid TeeML signer and in-flight pay', () => {
  assert.equal(payGateReason({ ...base, recoveredSigner: '0x' + '11'.repeat(20) })?.error, 'invalid-signer')
  assert.equal(payGateReason({ ...base, attestationOk: false })?.error, 'attestation missing')
  assert.equal(payGateReason({ ...base, pipeline: 'paying' })?.error, 'pay-in-flight')
})

test('on-chain TransferFailed maps to insufficient-vault-balance, not a raw ethers dump', () => {
  const raw =
    'execution reverted (unknown custom error) (action="estimateGas", data="0x90b8ec18", reason=null, transaction={ "data": "0x15af0caa" }, code=CALL_EXCEPTION, version=6.13.1)'
  assert.equal(payRevertReason(raw), 'insufficient-vault-balance')
  assert.equal(payRevertReason('execution reverted (unknown custom error) (action="estimateGas", data="0xf0d97246"'), 'paused')
  assert.equal(payRevertReason('something else\nmore'), 'something else')
})

test('stale paying rows are cleared when the gate fails for a reason other than in-flight', () => {
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pay.ts'), 'utf8')
  assert.match(src, /gate.error !== 'pay-in-flight'/)
  assert.match(src, /pipeline='ready'/)
})
