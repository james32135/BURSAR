import assert from 'node:assert/strict'
import test from 'node:test'
import { attestResponse } from '../src/attestor.ts'
import { screenInvoice } from '../src/screen.ts'
import { extractJsonObject, parseUsdToUnits, recoverSigner, sha256Hex } from '../src/util.ts'
import { ethers } from 'ethers'

test('attestor binds response hash and recovered signer', () => {
  const wallet = new ethers.Wallet('0x' + '11'.repeat(32))
  const response = Buffer.from('{"ok":true}', 'utf8')
  const respHash = sha256Hex(response)
  const reqHalf = 'aa'.repeat(32)
  const text = `${reqHalf}:${respHash}`
  const sig = wallet.signingKey.sign(ethers.hashMessage(text)).serialized
  const ok = attestResponse({
    responseBytes: response,
    signedText: text,
    signature: sig,
    expectedSigner: wallet.address,
    invoiceHash: '0x' + 'ab'.repeat(32),
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.recoveredSigner.toLowerCase(), wallet.address.toLowerCase())
    assert.equal(ok.responseHash, respHash)
    assert.equal(ok.requestHalf, reqHalf)
  }
})

test('attestor fail-closed on response tamper', () => {
  const wallet = new ethers.Wallet('0x' + '11'.repeat(32))
  const response = Buffer.from('{"ok":true}', 'utf8')
  const text = `${'bb'.repeat(32)}:${sha256Hex(response)}`
  const sig = wallet.signingKey.sign(ethers.hashMessage(text)).serialized
  const bad = attestResponse({
    responseBytes: Buffer.from('{"ok":false}', 'utf8'),
    signedText: text,
    signature: sig,
    expectedSigner: wallet.address,
    invoiceHash: '0x' + 'ab'.repeat(32),
  })
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.reason, 'response-hash-mismatch')
})

test('attestor fail-closed on wrong signer', () => {
  const wallet = new ethers.Wallet('0x' + '11'.repeat(32))
  const other = new ethers.Wallet('0x' + '22'.repeat(32))
  const response = Buffer.from('x', 'utf8')
  const text = `${'cc'.repeat(32)}:${sha256Hex(response)}`
  const sig = wallet.signingKey.sign(ethers.hashMessage(text)).serialized
  const bad = attestResponse({
    responseBytes: response,
    signedText: text,
    signature: sig,
    expectedSigner: other.address,
    invoiceHash: '0x' + 'ab'.repeat(32),
  })
  assert.equal(bad.ok, false)
  if (!bad.ok) assert.equal(bad.reason, 'signer-mismatch')
})

test('attestor does not require original POST hash to match request half', () => {
  const wallet = new ethers.Wallet('0x' + '11'.repeat(32))
  const response = Buffer.from('resp', 'utf8')
  const originalPost = sha256Hex('client-post')
  const brokerHalf = sha256Hex('rewritten-body')
  assert.notEqual(originalPost, brokerHalf)
  const text = `${brokerHalf}:${sha256Hex(response)}`
  const sig = wallet.signingKey.sign(ethers.hashMessage(text)).serialized
  const ok = attestResponse({
    responseBytes: response,
    signedText: text,
    signature: sig,
    expectedSigner: wallet.address,
    invoiceHash: '0x' + '11'.repeat(32),
  })
  assert.equal(ok.ok, true)
})

test('screen blocks unpaid duplicate, unlisted vendor, and flags over-band', () => {
  const blocked = screenInvoice({
    invoiceHash: '0x1',
    alreadyPaid: true,
    alreadySeen: false,
    extracted: { remittance_usdc_e: '0x' + '11'.repeat(20), total_usd: '1' },
    remittanceAllowed: true,
    amountUnits: 1n,
    band0Max: 100n,
  })
  assert.equal(blocked.status, 'blocked')
  const vendor = screenInvoice({
    invoiceHash: '0x1',
    alreadyPaid: false,
    alreadySeen: false,
    extracted: { remittance_usdc_e: '0x' + '11'.repeat(20), total_usd: '1' },
    remittanceAllowed: false,
    amountUnits: 1n,
    band0Max: 100n,
  })
  assert.equal(vendor.status, 'blocked')
  const over = screenInvoice({
    invoiceHash: '0x1',
    alreadyPaid: false,
    alreadySeen: false,
    extracted: { remittance_usdc_e: '0x1111111111111111111111111111111111111111', total_usd: '19000' },
    remittanceAllowed: true,
    amountUnits: 19000n * 10n ** 6n,
    band0Max: 200n * 10n ** 6n,
  })
  assert.equal(over.status, 'flagged')
  assert.equal(over.flags.some((f) => f.code === 'over-band0'), true)
})

test('usd parse and json extract', () => {
  assert.equal(parseUsdToUnits('19000.00'), 19000000000n)
  assert.equal(recoverSigner.length > 0, true)
  const j = extractJsonObject('\n```json\n{"invoice_number":"A","total_usd":"1.00"}\n```')
  assert.equal(j?.invoice_number, 'A')
})
