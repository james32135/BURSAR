export type Flag = { code: string; severity: 'block' | 'review'; detail: string }

import { detectUnsupportedRail } from './rails.ts'

export function screenInvoice(input: {
  invoiceHash: string
  alreadyPaid: boolean
  alreadySeen: boolean
  extracted: Record<string, string> | null
  remittanceAllowed: boolean
  amountUnits: bigint | null
  band0Max: bigint
}): { flags: Flag[]; status: 'clean' | 'flagged' | 'blocked' } {
  const flags: Flag[] = []
  if (input.alreadyPaid) flags.push({ code: 'duplicate-paid', severity: 'block', detail: 'invoice hash already paid on-chain' })
  if (input.alreadySeen) flags.push({ code: 'duplicate-seen', severity: 'block', detail: 'invoice hash already ingested' })
  if (!input.extracted) flags.push({ code: 'extract-failed', severity: 'block', detail: 'no JSON object from vision model' })
  const rail = detectUnsupportedRail({
    text: [input.extracted?.description, input.extracted?.chain_note, input.extracted?.payment_rail].filter(Boolean).join(' '),
    currency: input.extracted?.currency || input.extracted?.total_currency,
    rail: input.extracted?.payment_rail,
    chainNote: input.extracted?.chain_note,
  })
  if (rail) flags.push(rail)
  const rem = input.extracted?.remittance_usdc_e || ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(rem)) {
    flags.push({ code: 'bad-remittance', severity: 'block', detail: 'missing or invalid remittance address' })
  } else if (!input.remittanceAllowed) {
    flags.push({ code: 'vendor-not-allowlisted', severity: 'block', detail: rem })
  }
  if (input.amountUnits == null) flags.push({ code: 'bad-amount', severity: 'block', detail: 'cannot parse total_usd' })
  else if (input.amountUnits > input.band0Max) {
    flags.push({
      code: 'over-band0',
      severity: 'review',
      detail: `amount ${input.amountUnits} exceeds band0 ${input.band0Max}; session cannot auto-pay`,
    })
  }
  if (flags.some((f) => f.severity === 'block')) return { flags, status: 'blocked' }
  if (flags.length) return { flags, status: 'flagged' }
  return { flags, status: 'clean' }
}
