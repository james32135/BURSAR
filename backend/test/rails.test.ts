import test from 'node:test'
import assert from 'node:assert/strict'
import { detectUnsupportedRail, normalizeKind, SUPPORTED_RAIL } from '../src/rails.ts'
import { bandAroundUsd } from '../src/obligations.ts'

test('only USDC.e on Aristotle 16661 is a supported rail', () => {
  assert.equal(SUPPORTED_RAIL, 'usdc.e-16661')
  assert.equal(detectUnsupportedRail({ rail: 'usdc.e-16661' }), null)
  assert.equal(detectUnsupportedRail({ currency: 'USDC.e' }), null)
})

test('wire ACH SEPA BTC ETH fail closed as unsupported rails', () => {
  for (const text of ['please send a bank wire', 'ACH debit', 'SEPA transfer', 'pay in BTC', 'pay 1 ETH to vendor']) {
    const flag = detectUnsupportedRail({ text })
    assert.ok(flag, text)
    assert.equal(flag?.code, 'unsupported-rail')
    assert.match(flag?.detail || '', /UNSUPPORTED PAYMENT RAIL/)
  }
})

test('named rail bitcoin is blocked before ingest', () => {
  const flag = detectUnsupportedRail({ rail: 'bitcoin' })
  assert.equal(flag?.code, 'unsupported-rail')
})

test('payable kinds collapse to one engine', () => {
  assert.equal(normalizeKind('telegram-request'), 'request')
  assert.equal(normalizeKind('API Bill'), 'api-bill')
  assert.equal(normalizeKind('subscription'), 'subscription')
  assert.equal(normalizeKind('mystery'), 'invoice')
})

test('remembered obligation band is a range, not a blind transfer', () => {
  const band = bandAroundUsd('120')
  assert.equal(Number(band.min), 96)
  assert.equal(Number(band.max), 150)
})
