import { recoverSigner, sha256Hex } from './util.ts'

export type AttestationInput = {
  responseBytes: Buffer
  signedText: string
  signature: string
  expectedSigner: string
  invoiceHash: string
}

export type AttestationResult =
  | {
      ok: true
      requestHalf: string
      responseHalf: string
      responseHash: string
      recoveredSigner: string
      signedText: string
      invoiceHash: string
    }
  | { ok: false; reason: string }

/**
 * Production attestor. Matches spike A:
 * - persist exact response bytes
 * - split signature.text on ':'
 * - right half MUST equal sha256(responseBytes)
 * - left half is the broker's rewritten request hash — store, do not require
 *   equality with sha256(original POST)
 * - recoverAddress(hashMessage(text), signature) === registered tee signer
 * - bind the record to the invoice artifact hash
 */
export function attestResponse(input: AttestationInput): AttestationResult {
  if (!input.responseBytes?.length) return { ok: false, reason: 'missing-response-bytes' }
  if (!input.signedText) return { ok: false, reason: 'missing-signed-text' }
  if (!input.signature) return { ok: false, reason: 'missing-signature' }
  if (!input.expectedSigner) return { ok: false, reason: 'missing-expected-signer' }
  if (!input.invoiceHash) return { ok: false, reason: 'missing-invoice-hash' }

  const parts = input.signedText.split(':')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed-signed-text' }

  const responseHash = sha256Hex(input.responseBytes)
  if (parts[1].toLowerCase() !== responseHash.toLowerCase()) {
    return { ok: false, reason: 'response-hash-mismatch' }
  }

  let recovered: string
  try {
    recovered = recoverSigner(input.signedText, input.signature)
  } catch {
    return { ok: false, reason: 'malformed-signature' }
  }
  if (recovered.toLowerCase() !== input.expectedSigner.toLowerCase()) {
    return { ok: false, reason: 'signer-mismatch' }
  }

  return {
    ok: true,
    requestHalf: parts[0].toLowerCase(),
    responseHalf: parts[1].toLowerCase(),
    responseHash,
    recoveredSigner: recovered,
    signedText: input.signedText,
    invoiceHash: input.invoiceHash,
  }
}

export function processResponseIsNotEnough(value: unknown): boolean {
  return value !== true
}
