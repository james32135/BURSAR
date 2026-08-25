import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/app.ts'), 'utf8')

test('pay-allowed uses the same gated executeAllowedPay path as a single pay', () => {
  const start = app.indexOf("app.post('/queue/pay-allowed'")
  assert.ok(start > 0)
  const chunk = app.slice(start, start + 900)
  assert.match(chunk, /executeAllowedPay/)
  assert.doesNotMatch(chunk, /sessionPay\(/)
})
