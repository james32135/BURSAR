import test from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTION_7857 } from '../src/identity.ts'
import { explainWhy } from '../src/payable.ts'

test('production ERC-7857 IDs are the Foundation set, not Knole custom', () => {
  assert.equal(PRODUCTION_7857.IERC165, '0x01ffc9a7')
  assert.equal(PRODUCTION_7857.IERC721, '0x80ac58cd')
  assert.equal(PRODUCTION_7857.IERC7857, '0x2afbede9')
  assert.equal(PRODUCTION_7857.IERC7857Authorize, '0xdf597d99')
  assert.equal(PRODUCTION_7857.IERC7857Cloneable, '0x74f8628b')
  assert.notEqual(PRODUCTION_7857.IERC7857, '0x4b396f04')
})

test('splice of a paid invoice number is blocked in copy', () => {
  const why = explainWhy(
    [{ code: 'invoice-splice', severity: 'block', detail: 'CT-1 was paid 1000 now 19000000000' }],
    'blocked'
  )
  assert.ok(why[0].toLowerCase().includes('splice') || why[0].toLowerCase().includes('manipulated'))
})
