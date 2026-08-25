import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/mcp/src/server.mjs'), 'utf8')

test('MCP exposes the production payable tools', () => {
  for (const name of [
    'attention',
    'submit_payable',
    'inspect_payable',
    'explain_decision',
    'request_approval',
    'execute_allowed_payment',
    'pay_allowed_sequential',
    'verify_payment',
    'payments',
    'vendors',
    'policy',
  ]) {
    assert.ok(src.includes(`name: '${name}'`), name)
  }
})

test('MCP forbids owner-only money and policy writes', () => {
  for (const name of ['setVendor', 'withdraw', 'setPaused', 'setBands', 'createSession', 'transferOwnership', 'ownerPay', 'pause', 'revoke', 'addVendor']) {
    assert.ok(src.includes(`'${name}'`), name)
  }
  assert.match(src, /FORBIDDEN/)
  assert.doesNotMatch(src, /name: 'withdraw'/)
  assert.doesNotMatch(src, /name: 'ownerPay'/)
  assert.doesNotMatch(src, /name: 'setVendor'/)
  assert.doesNotMatch(src, /POST \/obligations/)
})
