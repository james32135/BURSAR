import { createHash } from 'node:crypto'
import { config } from './config.ts'
import { getDb, recordEvent } from './db.ts'
import { payablePdf } from './artifact.ts'
import { ingestPayable } from './ingest.ts'
import { getWorkspaceById, getWorkspaceByToken } from './workspace.ts'

export function emailHealth() {
  const live = Boolean(config.emailInboundSecret && config.emailInboundAddress)
  return {
    email: live,
    emailAddress: live ? config.emailInboundAddress : null,
    emailReason: live
      ? `Inbound adapter accepts authenticated posts for ${config.emailInboundAddress}`
      : 'No dedicated inbound mailbox or MX. POST /integrations/email/inbound exists but health stays false until EMAIL_INBOUND_SECRET and EMAIL_INBOUND_ADDRESS are set on the API.',
  }
}

export async function ingestEmailInbound(args: {
  secret: string
  authorization?: string
  body: {
    workspaceId?: string
    messageId?: string
    from?: string
    subject?: string
    vendor?: string
    remittance?: string
    amountUsd?: string
    invoiceNumber?: string
    pdfBase64?: string
  }
}) {
  if (!config.emailInboundSecret || !config.emailInboundAddress) {
    return { statusCode: 503 as const, body: { error: 'email inbound is not live', ...emailHealth() } }
  }
  if (args.secret !== config.emailInboundSecret) {
    return { statusCode: 401 as const, body: { error: 'bad email inbound secret' } }
  }
  const ws =
    (await getWorkspaceByToken(args.authorization)) ||
    (args.body.workspaceId ? await getWorkspaceById(args.body.workspaceId) : null)
  if (!ws || ws.demo) {
    return { statusCode: 401 as const, body: { error: 'workspace required' } }
  }
  const messageId = String(args.body.messageId || '').trim()
  if (!messageId) return { statusCode: 400 as const, body: { error: 'messageId required' } }

  let pdf: Buffer
  if (args.body.pdfBase64) {
    pdf = Buffer.from(args.body.pdfBase64, 'base64')
  } else if (args.body.vendor && args.body.remittance && args.body.amountUsd) {
    pdf = payablePdf({
      vendor: args.body.vendor,
      remittance: args.body.remittance,
      amountUsd: args.body.amountUsd,
      invoiceNumber: args.body.invoiceNumber || `EM-${Date.now()}`,
      kind: 'email-request',
      memo: args.body.subject || args.body.from || '',
    })
  } else {
    return { statusCode: 400 as const, body: { error: 'pdfBase64 or vendor/remittance/amountUsd required' } }
  }
  if (pdf.length < 20) return { statusCode: 400 as const, body: { error: 'empty attachment' } }

  const attachmentHash = createHash('sha256').update(pdf).digest('hex')
  const db = await getDb()
  const dup = await db.query(
    `SELECT message_id, invoice_hash FROM email_messages
     WHERE workspace_id = $1 AND (message_id = $2 OR attachment_hash = $3)`,
    [ws.id, messageId, attachmentHash]
  )
  if (dup.rows[0]) {
    return {
      statusCode: 409 as const,
      body: {
        duplicate: true,
        messageId: String(dup.rows[0].message_id),
        invoiceHash: dup.rows[0].invoice_hash,
      },
    }
  }

  await recordEvent(ws.id, '', 'email-received', { messageId, from: args.body.from, subject: args.body.subject })
  const out = await ingestPayable({ ws, pdf, source: 'email', kind: 'request', analyze: true })
  const invoiceHash = String((out.body as { invoiceHash?: string }).invoiceHash || '')
  await db.query(
    `INSERT INTO email_messages (workspace_id, message_id, attachment_hash, invoice_hash, from_addr, subject)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (workspace_id, message_id) DO NOTHING`,
    [ws.id, messageId, attachmentHash, invoiceHash || null, args.body.from || null, args.body.subject || null]
  )
  return { statusCode: out.statusCode, body: { ...out.body, messageId, source: 'email' } }
}
