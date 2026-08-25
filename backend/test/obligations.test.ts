import test from 'node:test'
import assert from 'node:assert/strict'
import { amountInObligationRange, bandAroundUsd } from '../src/obligations.ts'

test('band around a typical bill is ±20% / +25%', () => {
  const b = bandAroundUsd('0.001')
  assert.equal(b.min, '0.000800')
  assert.equal(b.max, '0.001250')
})

test('in-range amounts stay in the remembered band', () => {
  assert.equal(amountInObligationRange(1000n, '800', '1250'), true)
  assert.equal(amountInObligationRange(800n, '800', '1250'), true)
  assert.equal(amountInObligationRange(1250n, '800', '1250'), true)
})

test('out-of-range amounts do not count as last matched bills', () => {
  assert.equal(amountInObligationRange(2000n, '800', '1250'), false)
  assert.equal(amountInObligationRange(100n, '800', '1250'), false)
})

test('null amount does not fail closed on range', () => {
  assert.equal(amountInObligationRange(null, '800', '1250'), true)
})
