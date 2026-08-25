import test from 'node:test'
import assert from 'node:assert/strict'
import { screenInvoice } from '../src/screen.ts'
import { decide, explainWhy, attentionFromRows } from '../src/payable.ts'

test('screen still blocks bad remittance and unknown vendor', () => {
  const blocked = screenInvoice({
    invoiceHash: '0x1',
    alreadyPaid: false,
    alreadySeen: false,
    extracted: { remittance_usdc_e: '0x2222222222222222222222222222222222222222', total_usd: '1' },
    remittanceAllowed: false,
    amountUnits: 1000n,
    band0Max: 200_000000n,
  })
  assert.equal(blocked.status, 'blocked')
  assert.ok(blocked.flags.some((f) => f.code === 'vendor-not-allowlisted'))
})

test('decision: clean band0 is auto-pay, over band is owner-review, block stays blocked', () => {
  assert.equal(decide([], 1000n, 200_000000n), 'auto-pay')
  assert.equal(
    decide([{ code: 'over-band0', severity: 'review', detail: 'x' }], 300_000000n, 200_000000n),
    'owner-review'
  )
  assert.equal(
    decide([{ code: 'vendor-not-allowlisted', severity: 'block', detail: '0x2' }], 1000n, 200_000000n),
    'blocked'
  )
})

test('why text is specific, not just BLOCKED', () => {
  const why = explainWhy(
    [{ code: 'recipient-changed', severity: 'review', detail: 'last 0xa now 0xb' }],
    'owner-review'
  )
  assert.ok(why[0].includes('recipient changed'))
})

test('attention counts come from persisted rows, not decoration', () => {
  const a = attentionFromRows(
    [
      { status: 'clean', amount_units: '1000' },
      { status: 'flagged', amount_units: '5000', flags: [{ code: 'over-band0', severity: 'review' }] },
      { status: 'blocked', amount_units: '1', flags: [{ code: 'duplicate-seen', severity: 'block' }] },
      { status: 'paid', amount_units: '1000' },
    ],
    200_000000n
  )
  assert.equal(a.new, 3)
  assert.equal(a.autoPay, 1)
  assert.equal(a.ownerReview, 1)
  assert.equal(a.blocked, 1)
  assert.equal(a.duplicate, 1)
  assert.equal(a.totalUnits, '6001')
  assert.equal(a.autoApprovedUnits, '1000')
})
