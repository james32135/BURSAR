import { config } from './config.ts'
import { getDb } from './db.ts'
import { payablePdf } from './artifact.ts'
import { ingestPayable } from './ingest.ts'
import { getWorkspaceById, getWorkspaceByToken } from './workspace.ts'

type TgUpdate = {
  message?: {
    chat?: { id: number }
    text?: string
    from?: { id: number; username?: string }
  }
}

async function send(chatId: number, text: string) {
  if (!config.telegramBotToken) return
  await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
}

function parseRequest(text: string) {
  const rem = text.match(/0x[a-fA-F0-9]{40}/)
  const amt = text.match(/([\d,]+\.?\d*)\s*(USDC\.e|USD|usdc)?/i)
  const vendorMatch = text.match(/from\s+([^:\n]+)/i) || text.match(/vendor[:\s]+([^,\n]+)/i)
  if (!rem || !amt) return null
  return {
    remittance: rem[0],
    amountUsd: amt[1].replace(/,/g, ''),
    vendor: (vendorMatch?.[1] || 'Telegram vendor').trim(),
    invoiceNumber: `TG-${Date.now()}`,
  }
}

export async function handleTelegramUpdate(update: TgUpdate) {
  if (!config.telegramBotToken) return { ok: false, error: 'telegram disabled' }
  const msg = update.message
  const chatId = msg?.chat?.id
  const text = (msg?.text || '').trim()
  if (!chatId || !text) return { ok: true, ignored: true }

  const db = await getDb()
  const bound = await db.query(
    `SELECT workspace_id FROM integrations WHERE kind = 'telegram' AND config->>'chatId' = $1`,
    [String(chatId)]
  )

  if (text.startsWith('/start')) {
    await send(chatId, 'BURSAR. Send /bind <workspace token> once. Then a payment request with vendor, amount, and 0x remittance.')
    return { ok: true }
  }
  if (text.startsWith('/bind')) {
    const token = text.replace('/bind', '').trim()
    const ws = await getWorkspaceByToken(`Bearer ${token}`)
    if (!ws) {
      await send(chatId, 'Bind failed. Token did not match a workspace.')
      return { ok: true }
    }
    await db.query(
      `INSERT INTO integrations (workspace_id, kind, config) VALUES ($1,'telegram',$2::jsonb)
       ON CONFLICT (workspace_id, kind) DO UPDATE SET config = $2::jsonb`,
      [ws.id, JSON.stringify({ chatId: String(chatId) })]
    )
    await send(chatId, `Bound to workspace ${ws.id}. Isolated vault ${ws.vault}`)
    return { ok: true }
  }

  const wsId = bound.rows[0] ? String(bound.rows[0].workspace_id) : ''
  const ws = wsId ? await getWorkspaceById(wsId) : null
  if (!ws) {
    await send(chatId, 'This chat is not bound. Send /bind <workspace token>.')
    return { ok: true }
  }

  if (/^review$/i.test(text) || /^queue$/i.test(text)) {
    const q = await db.query(
      `SELECT invoice_hash, vendor, amount_units, status, decision, decision_why FROM invoices
       WHERE workspace_id = $1 AND status <> 'paid' ORDER BY created_at DESC LIMIT 8`,
      [ws.id]
    )
    if (!q.rows.length) {
      await send(chatId, 'No open payables.')
      return { ok: true }
    }
    const lines = q.rows.map((r) => {
      const why = typeof r.decision_why === 'string' ? JSON.parse(String(r.decision_why)) : r.decision_why
      const first = Array.isArray(why) ? why[0] : ''
      return `${r.status} ${r.vendor || '-'} ${r.amount_units} ${String(r.invoice_hash).slice(0, 10)} ${first}`
    })
    await send(chatId, lines.join('\n'))
    return { ok: true }
  }

  const parsed = parseRequest(text)
  if (!parsed) {
    await send(chatId, 'Need vendor, amount, and a 0x remittance. Example: New payment request from Contoso: 1.25 USDC.e 0x1111...1111')
    return { ok: true }
  }

  const pdf = payablePdf({
    vendor: parsed.vendor,
    remittance: parsed.remittance,
    amountUsd: parsed.amountUsd,
    invoiceNumber: parsed.invoiceNumber,
    kind: 'telegram-request',
  })
  const out = await ingestPayable({ ws, pdf, source: 'telegram', kind: 'request', analyze: true })
  const body = out.body as {
    invoiceHash?: string
    decision?: string
    why?: string[]
    status?: string
    duplicate?: boolean
  }
  if (out.statusCode === 409) {
    await send(chatId, `Duplicate. Hash already ${body.status}. Zero USDC.e moved.`)
    return { ok: true, duplicate: true }
  }
  const why = (body.why || []).join(' ')
  await send(
    chatId,
    [
      `Payable ${body.invoiceHash}`,
      `Decision: ${body.decision || body.status}`,
      why,
      body.decision === 'auto-pay'
        ? 'Band 0 path. Use the console or MCP execute_allowed_payment. This chat does not hold the owner key.'
        : 'No auto-pay. Owner action required in the console if this is owner-review. Blocked payables never move USDC.e.',
    ].join('\n')
  )
  return { ok: true, invoiceHash: body.invoiceHash, decision: body.decision }
}
