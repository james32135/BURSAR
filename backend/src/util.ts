import { createHash } from 'node:crypto'
import { ethers } from 'ethers'

export function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function sha256Bytes32(buf: Buffer | string): string {
  return '0x' + sha256Hex(buf)
}

export function recoverSigner(text: string, signature: string): string {
  return ethers.recoverAddress(ethers.hashMessage(text), signature)
}

export function parseUsdToUnits(raw: string, decimals = 6): bigint {
  const t = String(raw || '').replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error('invalid amount')
  const [w, f = ''] = t.split('.')
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(w) * 10n ** BigInt(decimals) + BigInt(frac || '0')
}

export function extractJsonObject(text: string): Record<string, string> | null {
  const fence = text.match(/```json\s*([\s\S]*?)```/i)
  const body = fence ? fence[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const obj = JSON.parse(body.slice(start, end + 1))
    if (!obj || typeof obj !== 'object') return null
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = v == null ? '' : String(v)
    return out
  } catch {
    return null
  }
}
