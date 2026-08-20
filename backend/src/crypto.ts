import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from './config.ts'

function encKey() {
  const secret = process.env.BURSAR_SESSION_JWT_SECRET || config.apiToken || 'bursar-dev-only'
  return createHash('sha256').update(`bursar-ws:${secret}`).digest()
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(blob: string) {
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', encKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
