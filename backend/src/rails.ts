/** BURSAR v1 settles USDC.e on Aristotle 16661 only. Other rails fail closed. */

export const SUPPORTED_RAIL = 'usdc.e-16661'

export type RailFlag = { code: 'unsupported-rail'; severity: 'block'; detail: string }

const BLOCK = [
  { re: /\b(bank\s*wire|wire\s*transfer|wires)\b/i, label: 'bank wire' },
  { re: /\bach\b/i, label: 'ACH' },
  { re: /\bsepa\b/i, label: 'SEPA' },
  { re: /\bswift\b/i, label: 'SWIFT' },
  { re: /\bbitcoin\b|\bbtc\b/i, label: 'BTC' },
  { re: /\bnative eth\b|\bethereum\b|\beth\b/i, label: 'ETH' },
  { re: /\bsolana\b|\bsol transfer\b/i, label: 'SOL' },
]

const OK_CURRENCY = new Set(['', 'USD', 'USDC', 'USDC.E', 'USDCE'])

export function detectUnsupportedRail(input: {
  text?: string
  currency?: string
  rail?: string
  chainNote?: string
}): RailFlag | null {
  const rail = String(input.rail || '').trim().toLowerCase()
  if (rail && rail !== SUPPORTED_RAIL && rail !== 'usdc.e' && rail !== 'usdce' && rail !== 'usdc' && rail !== '16661') {
    return {
      code: 'unsupported-rail',
      severity: 'block',
      detail: `UNSUPPORTED PAYMENT RAIL: ${rail}. BURSAR settles USDC.e on 0G Aristotle 16661 only.`,
    }
  }
  const ccy = String(input.currency || '').trim().toUpperCase()
  if (ccy && !OK_CURRENCY.has(ccy)) {
    return {
      code: 'unsupported-rail',
      severity: 'block',
      detail: `UNSUPPORTED PAYMENT RAIL: ${ccy}. BURSAR settles USDC.e on 0G Aristotle 16661 only.`,
    }
  }
  const blob = [input.text, input.currency, input.rail, input.chainNote].filter(Boolean).join(' ')
  for (const hit of BLOCK) {
    if (hit.re.test(blob)) {
      return {
        code: 'unsupported-rail',
        severity: 'block',
        detail: `UNSUPPORTED PAYMENT RAIL: ${hit.label}. BURSAR settles USDC.e on 0G Aristotle 16661 only.`,
      }
    }
  }
  return null
}

export const PAYABLE_KINDS = [
  'invoice',
  'contractor',
  'vendor-payment',
  'subscription',
  'api-bill',
  'agent-expense',
  'recurring',
  'request',
] as const

export type PayableKind = (typeof PAYABLE_KINDS)[number]

export function normalizeKind(raw?: string | null): PayableKind {
  const k = String(raw || 'invoice')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
  if (k === 'telegram-request' || k === 'email-request') return 'request'
  if ((PAYABLE_KINDS as readonly string[]).includes(k)) return k as PayableKind
  return 'invoice'
}
