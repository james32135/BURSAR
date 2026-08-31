import test from 'node:test'
import assert from 'node:assert/strict'
import { screenInvoice } from '../src/screen.ts'
import { decide, explainWhy, attentionFromRows, nextActionFor, isInvoiceSplice, publicDecisionFromInvoiceRow, memoryInfluence } from '../src/payable.ts'
import { invoiceNumberFromPdf, payablePdf } from '../src/artifact.ts'

test('screen blocks extracted BTC rail', () => {
  const blocked = screenInvoice({
    invoiceHash: '0x1',
    alreadyPaid: false,
    alreadySeen: false,
    extracted: { remittance_usdc_e: '0x1111111111111111111111111111111111111111', total_usd: '1', currency: 'BTC' },
    remittanceAllowed: true,
    amountUnits: 1000n,
    band0Max: 200_000000n,
  })
  assert.equal(blocked.status, 'blocked')
  assert.ok(blocked.flags.some((f) => f.code === 'unsupported-rail'))
})

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
  assert.equal(a.paidRecently, 1)
  assert.equal(a.totalUnits, '6001')
  assert.equal(a.autoApprovedUnits, '1000')
  assert.equal(a.waitingForYouUnits, '5000')
  assert.equal(a.blockedUnits, '1')
})

test('structured PDF keeps the invoice number in the stream', () => {
  const pdf = payablePdf({
    vendor: 'Contoso Labs',
    remittance: '0x1111111111111111111111111111111111111111',
    amountUsd: '0.001',
    invoiceNumber: 'CT-WAVE3-1',
  })
  assert.equal(invoiceNumberFromPdf(pdf), 'CT-WAVE3-1')
  assert.equal(isInvoiceSplice('1000', 19_000_000000n), true)
  assert.equal(isInvoiceSplice('1000', 1000n), false)
})

test('next action is PAY OPEN WHY or PROOF, never AI says safe', () => {
  assert.equal(nextActionFor({ status: 'clean', decision: 'auto-pay' }), 'PAY')
  assert.equal(nextActionFor({ status: 'flagged', decision: 'owner-review' }), 'OPEN')
  assert.equal(nextActionFor({ status: 'blocked', flags: [{ code: 'vendor-not-allowlisted', severity: 'block', detail: 'x' }] }), 'WHY')
  assert.equal(nextActionFor({ status: 'paid', pay_tx: '0xabc' }), 'PROOF')
})

test('invoice splice is a block, not owner-review', () => {
  assert.equal(
    decide([{ code: 'invoice-splice', severity: 'block', detail: 'CT-1 was 1000 now 19000000000' }], 19_000_000000n, 200_000000n),
    'blocked'
  )
  const why = explainWhy(
    [{ code: 'invoice-splice', severity: 'block', detail: 'CT-1 was 1000 now 19000000000' }],
    'blocked'
  )
  assert.match(why[0], /manipulated duplicate/i)
  const mixed = explainWhy(
    [
      { code: 'over-band0', severity: 'review', detail: 'x' },
      { code: 'invoice-splice', severity: 'block', detail: 'CT-1 was 1000 now 18000000000' },
    ],
    'blocked'
  )
  assert.match(mixed[0], /manipulated duplicate/i)
})

test('unsupported rail why is explicit', () => {
  const why = explainWhy(
    [{ code: 'unsupported-rail', severity: 'block', detail: 'UNSUPPORTED PAYMENT RAIL: BTC. BURSAR settles USDC.e on 0G Aristotle 16661 only.' }],
    'blocked'
  )
  assert.match(why[0], /UNSUPPORTED PAYMENT RAIL/)
})

test('proof of decision never includes extracted body or prompts', () => {
  const d = publicDecisionFromInvoiceRow({
    invoice_hash: '0xabc',
    source: 'telegram',
    kind: 'invoice',
    storage_root: '0x' + '11'.repeat(32),
    go_proof_ok: true,
    recovered_signer: '0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0',
    response_hash: '0x' + '22'.repeat(32),
    status: 'blocked',
    decision: 'blocked',
    amount_units: '19000000000',
    flags: [{ code: 'invoice-splice', severity: 'block', detail: 'CT-1 was 1000 now 19000000000' }],
    extracted: { prompt: 'SECRET_PROMPT', invoice_number: 'CT-1' },
    pay_tx: null,
  })
  assert.ok(d)
  assert.equal(d.received.source, 'telegram')
  assert.equal(d.policy.nextAction, 'WHY')
  assert.equal(d.money.moved, false)
  assert.equal(d.memory[0].code, 'invoice-splice')
  const blob = JSON.stringify(d)
  assert.equal(blob.includes('SECRET_PROMPT'), false)
  assert.equal(blob.includes('extracted'), false)
  assert.match(d.why[0], /manipulated duplicate/i)
  const inf = memoryInfluence([{ code: 'recipient-changed', severity: 'review', detail: 'last 0xa now 0xb' }])
  assert.equal(inf.next, 'OPEN')
})

test('paid row proof of decision is PROOF with money moved', () => {
  const d = publicDecisionFromInvoiceRow({
    invoice_hash: '0xdef',
    source: 'pdf',
    kind: 'invoice',
    status: 'paid',
    decision: 'auto-pay',
    amount_units: '1000',
    flags: [],
    pay_tx: '0xpay',
  })
  assert.equal(d?.policy.nextAction, 'PROOF')
  assert.equal(d?.money.moved, true)
  assert.equal(d?.money.payTx, '0xpay')
})

test('blocked splice leads why even if stored why started with over-band', () => {
  const d = publicDecisionFromInvoiceRow({
    invoice_hash: '0xsplice',
    status: 'blocked',
    decision: 'blocked',
    amount_units: '18000000000',
    flags: [
      { code: 'over-band0', severity: 'review', detail: 'amount 18000000000 exceeds band0' },
      { code: 'invoice-splice', severity: 'block', detail: 'CT-1 was 1000 now 18000000000' },
    ],
    decision_why: ['Owner review: amount exceeds Band 0', 'Blocked: manipulated duplicate'],
  })
  assert.match(d!.why[0], /manipulated duplicate/i)
})
