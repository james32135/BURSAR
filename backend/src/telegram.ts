import { createHash, randomBytes } from 'node:crypto'
import { config } from './config.ts'
import { getDb, recordEvent } from './db.ts'
import { payablePdf } from './artifact.ts'
import { ingestPayable } from './ingest.ts'
import { executeAllowedPay } from './pay.ts'
import { getWorkspaceById } from './workspace.ts'

const CONSOLE = 'https://bursarx.vercel.app'
const CODE_TTL_MS = 15 * 60 * 1000
const RATE_MS = 400

type TgUser = { id: number; username?: string }
type TgChat = { id: number }
type TgMessage = { message_id?: number; chat?: TgChat; text?: string; from?: TgUser }
type TgCallback = { id: string; data?: string; from?: TgUser; message?: TgMessage }
type TgUpdate = { update_id?: number; message?: TgMessage; callback_query?: TgCallback }

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
}

async function bot(method: string, body: Record<string, unknown>) {
  if (!config.telegramBotToken) return null
  const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean }
  if (!json.ok) return null
  return json
}

async function send(chatId: number, text: string, extra?: Record<string, unknown>) {
  await bot('sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  })
}

async function answerCb(id: string, text?: string) {
  await bot('answerCallbackQuery', { callback_query_id: id, text: text || '', show_alert: Boolean(text && text.length > 40) })
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

function usd(units: unknown) {
  const n = Number(units || 0)
  if (!Number.isFinite(n)) return '-'
  return (n / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + ' USDC.e'
}

async function identity(telegramUserId: string) {
  const db = await getDb()
  const q = await db.query(
    `SELECT * FROM telegram_identities WHERE telegram_user_id = $1 AND revoked_at IS NULL`,
    [telegramUserId]
  )
  return q.rows[0] || null
}

async function rateOk(telegramUserId: string) {
  const db = await getDb()
  const q = await db.query(`SELECT last_action_at FROM telegram_identities WHERE telegram_user_id = $1`, [telegramUserId])
  const last = q.rows[0]?.last_action_at ? Date.parse(String(q.rows[0].last_action_at)) : 0
  if (last && Date.now() - last < RATE_MS) return false
  await db.query(`UPDATE telegram_identities SET last_action_at = NOW() WHERE telegram_user_id = $1`, [telegramUserId])
  return true
}

async function logAction(workspaceId: string, telegramUserId: string, kind: string, payload: unknown) {
  const db = await getDb()
  await db.query(
    `INSERT INTO telegram_actions (id, workspace_id, telegram_user_id, kind, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [randomBytes(12).toString('hex'), workspaceId, telegramUserId, kind, JSON.stringify(payload ?? {})]
  )
}

export async function issueTelegramBindCode(workspaceId: string) {
  const db = await getDb()
  const code = randomBytes(5).toString('hex').toUpperCase()
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString()
  await db.query(
    `INSERT INTO telegram_bind_codes (code_hash, workspace_id, expires_at) VALUES ($1,$2,$3)`,
    [hashCode(code), workspaceId, expires]
  )
  const bot = config.telegramBotUsername.replace(/^@/, '')
  return {
    code,
    expiresAt: expires,
    bot,
    deepLink: `https://t.me/${bot}?start=${code}`,
  }
}

export async function telegramStatus(workspaceId: string) {
  const db = await getDb()
  const q = await db.query(
    `SELECT telegram_user_id, username, bound_at, revoked_at FROM telegram_identities
     WHERE workspace_id = $1 AND revoked_at IS NULL`,
    [workspaceId]
  )
  const row = q.rows[0]
  return {
    live: Boolean(config.telegramBotToken),
    bot: config.telegramBotUsername.replace(/^@/, '') || null,
    bound: Boolean(row),
    telegramUserId: row ? String(row.telegram_user_id) : null,
    username: row?.username ? String(row.username) : null,
    boundAt: row ? String(row.bound_at) : null,
  }
}

export async function unbindTelegram(workspaceId: string) {
  const db = await getDb()
  await db.query(
    `UPDATE telegram_identities SET revoked_at = NOW() WHERE workspace_id = $1 AND revoked_at IS NULL`,
    [workspaceId]
  )
}

export async function notifyWorkspacePayable(
  workspaceId: string,
  body: {
    invoiceHash?: string
    decision?: string
    status?: string
    vendor?: string | null
    amount_units?: string | number | null
    remittance?: string
    why?: string[]
    duplicate?: boolean
  }
) {
  if (!config.telegramBotToken) return
  const db = await getDb()
  const q = await db.query(
    `SELECT chat_id FROM telegram_identities WHERE workspace_id = $1 AND revoked_at IS NULL`,
    [workspaceId]
  )
  if (!q.rows[0]) return
  const chatId = Number(q.rows[0].chat_id)
  if (body.duplicate) {
    await send(chatId, `Duplicate payable. Hash already on this vault. 0 USDC.e moved.`)
    return
  }
  const decision = body.decision || body.status || 'unknown'
  const why = (body.why || []).join('\n')
  const hash = body.invoiceHash || ''
  const lines = [
    decision === 'auto-pay' ? 'AUTO-PAY READY' : decision === 'blocked' ? 'BLOCKED' : 'OWNER APPROVAL REQUIRED',
    `Vendor: ${body.vendor || '-'}`,
    `Amount: ${usd(body.amount_units)}`,
    `Recipient: ${body.remittance || '-'}`,
    `Payable: ${hash.slice(0, 18)}…`,
    why,
  ]
  const buttons =
    decision === 'auto-pay'
      ? [[{ text: 'PAY', callback_data: `pay:${hash}` }, { text: 'Open console', url: `${CONSOLE}/app/inbox/${hash}` }]]
      : decision === 'blocked'
        ? [[{ text: 'Open console', url: `${CONSOLE}/app/inbox/${hash}` }]]
        : [[{ text: 'APPROVE IN APP', url: `${CONSOLE}/app/inbox/${hash}` }]]
  await send(chatId, lines.filter(Boolean).join('\n'), {
    reply_markup: { inline_keyboard: buttons },
  })
}

async function bindFromCode(telegramUserId: string, chatId: number, username: string | undefined, raw: string) {
  const db = await getDb()
  const existing = await identity(telegramUserId)
  if (existing) {
    return `Already bound to workspace ${existing.workspace_id}. Unbind in Settings before attaching another desk.`
  }
  const hashed = hashCode(raw)
  const row = await db.query(`SELECT * FROM telegram_bind_codes WHERE code_hash = $1`, [hashed])
  const code = row.rows[0]
  if (!code) return 'Bind code not recognized. Generate a new code in the BURSAR console Settings.'
  if (code.used_at) return 'Bind code already used. Generate a new code in Settings.'
  if (Date.parse(String(code.expires_at)) < Date.now()) return 'Bind code expired. Generate a new code in Settings.'
  const wsId = String(code.workspace_id)
  await db.query(`UPDATE telegram_bind_codes SET used_at = NOW() WHERE code_hash = $1`, [hashed])
  await db.query(
    `INSERT INTO telegram_identities (telegram_user_id, workspace_id, chat_id, username, bound_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (telegram_user_id) DO UPDATE SET workspace_id=$2, chat_id=$3, username=$4, bound_at=NOW(), revoked_at=NULL`,
    [telegramUserId, wsId, String(chatId), username || null]
  )
  await db.query(
    `INSERT INTO integrations (workspace_id, kind, config) VALUES ($1,'telegram',$2::jsonb)
     ON CONFLICT (workspace_id, kind) DO UPDATE SET config = $2::jsonb`,
    [wsId, JSON.stringify({ telegramUserId, chatId: String(chatId) })]
  )
  await logAction(wsId, telegramUserId, 'bind', { chatId })
  const ws = await getWorkspaceById(wsId)
  return `Bound to workspace ${wsId.slice(0, 8)}… Vault ${ws?.vault || ''}. This chat cannot hold the owner key.`
}

async function requireWs(telegramUserId: string, chatId: number) {
  const row = await identity(telegramUserId)
  if (!row) {
    await send(chatId, 'This Telegram account is not bound. Open BURSAR Settings, generate a bind code, then send /start CODE.')
    return null
  }
  const ws = await getWorkspaceById(String(row.workspace_id))
  if (!ws) {
    await send(chatId, 'Bound workspace is gone. Unbind in Settings and generate a new code.')
    return null
  }
  return { ws, row }
}

function cmd(text: string) {
  return text.split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase()
}

async function showAttention(chatId: number, workspaceId: string) {
  const db = await getDb()
  const q = await db.query(
    `SELECT invoice_hash, vendor, amount_units, status, decision, decision_why FROM invoices
     WHERE workspace_id = $1 AND status <> 'paid' ORDER BY created_at DESC LIMIT 8`,
    [workspaceId]
  )
  if (!q.rows.length) {
    await send(chatId, 'No open payables.')
    return
  }
  const auto = q.rows.filter((r) => r.decision === 'auto-pay' || r.status === 'clean').length
  const review = q.rows.filter((r) => r.status === 'flagged' || r.decision === 'owner-review').length
  const blocked = q.rows.filter((r) => r.status === 'blocked' || r.decision === 'blocked').length
  const lines = [
    `${q.rows.length} payables need attention.`,
    `Auto-pay ${auto} · Owner review ${review} · Blocked ${blocked}`,
    '',
    ...q.rows.map((r) => {
      const why = typeof r.decision_why === 'string' ? JSON.parse(String(r.decision_why)) : r.decision_why
      const first = Array.isArray(why) ? why[0] : ''
      return `${r.decision || r.status} · ${r.vendor || '-'} · ${usd(r.amount_units)} · ${String(r.invoice_hash).slice(0, 10)} ${first}`
    }),
  ]
  await send(chatId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [[{ text: 'Review first', callback_data: `open:${q.rows[0].invoice_hash}` }]],
    },
  })
}

async function inspect(chatId: number, workspaceId: string, hash: string) {
  const db = await getDb()
  const q = await db.query(`SELECT * FROM invoices WHERE workspace_id = $1 AND invoice_hash = $2`, [workspaceId, hash])
  const inv = q.rows[0]
  if (!inv) {
    await send(chatId, 'Payable not in this workspace.')
    return
  }
  const why = typeof inv.decision_why === 'string' ? JSON.parse(String(inv.decision_why)) : inv.decision_why
  const lines = [
    `Vendor: ${inv.vendor || '-'}`,
    `Amount: ${usd(inv.amount_units)}`,
    `Recipient: ${inv.remittance || '-'}`,
    `Invoice: ${inv.invoice_hash}`,
    `Decision: ${inv.decision || inv.status}`,
    `Risk / why: ${Array.isArray(why) ? why.join(' ') : String(why || '-')}`,
  ]
  const decision = String(inv.decision || '')
  const buttons =
    decision === 'auto-pay' && inv.status !== 'paid'
      ? [[{ text: 'PAY', callback_data: `pay:${hash}` }, { text: 'Open console', url: `${CONSOLE}/app/inbox/${hash}` }]]
      : [[{ text: 'APPROVE IN APP', url: `${CONSOLE}/app/inbox/${hash}` }]]
  await send(chatId, lines.join('\n'), { reply_markup: { inline_keyboard: buttons } })
}

async function help(chatId: number) {
  await send(
    chatId,
    [
      'BURSAR Telegram is a workspace desk, not a key store.',
      '/start — bind with a one-time Settings code',
      '/workspace — which vault this chat is bound to',
      '/attention — open payables',
      '/inbox — same as attention',
      '/review — exceptions',
      '/payments — recent paid hashes',
      '/vendors — vendor memory',
      '/help — this list',
      'To submit a payable, send vendor, amount, and a 0x remittance on 0G Aristotle USDC.e.',
      'PAY in this chat only runs Band-0 session pay. Owner approve / withdraw / policy stay on bursarx.vercel.app.',
    ].join('\n')
  )
}

export async function handleTelegramUpdate(update: TgUpdate) {
  if (!config.telegramBotToken) return { ok: false, error: 'telegram disabled' }
  const db = await getDb()
  const updateId = Number(update.update_id || 0)
  if (updateId) {
    const seen = await db.query(`SELECT update_id FROM telegram_updates WHERE update_id = $1`, [updateId])
    if (seen.rows[0]) return { ok: true, duplicate: true }
    await db.query(`INSERT INTO telegram_updates (update_id) VALUES ($1) ON CONFLICT DO NOTHING`, [updateId])
  }

  const cb = update.callback_query
  if (cb?.id && cb.from && cb.message?.chat) {
    const telegramUserId = String(cb.from.id)
    const chatId = cb.message.chat.id
    const bound = await requireWs(telegramUserId, chatId)
    if (!bound) {
      await answerCb(cb.id, 'Not bound')
      return { ok: true }
    }
    if (!(await rateOk(telegramUserId))) {
      await answerCb(cb.id, 'Wait a moment, then retry.')
      return { ok: true, rateLimited: true }
    }
    const data = String(cb.data || '')
    const [kind, hash] = data.split(':')
    if (kind === 'pay' && hash) {
      const paid = await executeAllowedPay(bound.ws, hash)
      await logAction(bound.ws.id, telegramUserId, 'pay', { hash, ok: paid.ok })
      if (paid.ok === false) {
        await answerCb(cb.id, paid.error)
        await send(chatId, `PAY denied. ${paid.error}. 0 USDC.e moved.`)
        return { ok: true, paid }
      }
      await answerCb(cb.id, 'Paid')
      await send(
        chatId,
        [
          `PAID ${usd(paid.moneyMoved)}`,
          `Tx ${paid.hash}`,
          paid.explorer,
          `Vault ${paid.preVault} → ${paid.postVault}`,
          `Vendor ${paid.preVendor} → ${paid.postVendor}`,
        ].join('\n')
      )
      return { ok: true, paid }
    }
    if ((kind === 'open' || kind === 'review') && hash) {
      await answerCb(cb.id)
      await inspect(chatId, bound.ws.id, hash)
      return { ok: true }
    }
    await answerCb(cb.id)
    return { ok: true }
  }

  const msg = update.message
  const chatId = msg?.chat?.id
  const from = msg?.from
  const text = (msg?.text || '').trim()
  if (!chatId || !from || !text) return { ok: true, ignored: true }
  const telegramUserId = String(from.id)
  const c = cmd(text)

  if (c === '/start') {
    const payload = text.replace(/^\/start(@\w+)?/i, '').trim()
    if (payload) {
      const reply = await bindFromCode(telegramUserId, chatId, from.username, payload)
      await send(chatId, reply)
      return { ok: true, bound: !reply.startsWith('Already') && !reply.startsWith('Bind') }
    }
    await send(
      chatId,
      `BURSAR. Open ${CONSOLE}/app/settings, generate a one-time bind code, then send /start CODE or tap the deep link. Never paste a seed or owner key here.`
    )
    return { ok: true }
  }

  if (c === '/help') {
    await help(chatId)
    return { ok: true }
  }

  if (c === '/bind') {
    const payload = text.replace(/^\/bind(@\w+)?/i, '').trim()
    if (!payload) {
      await send(chatId, 'Use a one-time Settings code: /start CODE. Do not paste the workspace MCP token.')
      return { ok: true }
    }
    const reply = await bindFromCode(telegramUserId, chatId, from.username, payload)
    await send(chatId, reply)
    return { ok: true }
  }

  const bound = await requireWs(telegramUserId, chatId)
  if (!bound) return { ok: true, unbound: true }
  if (!(await rateOk(telegramUserId))) {
    await send(chatId, 'Wait a moment, then retry.')
    return { ok: true, rateLimited: true }
  }

  if (c === '/workspace') {
    await send(chatId, `Workspace ${bound.ws.id}\nVault ${bound.ws.vault}\nOwner ${bound.ws.owner}\nDEMO=${bound.ws.demo}`)
    return { ok: true }
  }
  if (c === '/attention' || c === '/inbox') {
    await showAttention(chatId, bound.ws.id)
    return { ok: true }
  }
  if (c === '/review') {
    const db2 = await getDb()
    const q = await db2.query(
      `SELECT invoice_hash, vendor, amount_units, status, decision FROM invoices
       WHERE workspace_id = $1 AND status IN ('flagged','blocked') ORDER BY created_at DESC LIMIT 8`,
      [bound.ws.id]
    )
    if (!q.rows.length) {
      await send(chatId, 'No exceptions.')
      return { ok: true }
    }
    await send(
      chatId,
      q.rows.map((r) => `${r.status} ${r.vendor || '-'} ${usd(r.amount_units)} ${String(r.invoice_hash).slice(0, 12)}`).join('\n')
    )
    return { ok: true }
  }
  if (c === '/payments') {
    const db2 = await getDb()
    const q = await db2.query(
      `SELECT invoice_hash, vendor, amount_units, pay_tx FROM invoices
       WHERE workspace_id = $1 AND status = 'paid' ORDER BY updated_at DESC LIMIT 8`,
      [bound.ws.id]
    )
    if (!q.rows.length) {
      await send(chatId, 'No paid payables in this workspace yet.')
      return { ok: true }
    }
    await send(
      chatId,
      q.rows
        .map((r) => `${r.vendor || '-'} ${usd(r.amount_units)}\n${r.pay_tx || r.invoice_hash}`)
        .join('\n\n')
    )
    return { ok: true }
  }
  if (c === '/vendors') {
    const db2 = await getDb()
    const q = await db2.query(
      `SELECT remittance, vendor, COUNT(*)::int AS n FROM invoices
       WHERE workspace_id = $1 AND remittance IS NOT NULL GROUP BY remittance, vendor ORDER BY n DESC LIMIT 8`,
      [bound.ws.id]
    )
    if (!q.rows.length) {
      await send(chatId, 'No vendor memory yet.')
      return { ok: true }
    }
    await send(chatId, q.rows.map((r) => `${r.vendor || '-'} ${r.remittance} n=${r.n}`).join('\n'))
    return { ok: true }
  }

  const parsed = parseRequest(text)
  if (!parsed) {
    await send(
      chatId,
      'Need vendor, amount, and a 0x remittance on Aristotle USDC.e. Example: Payment request from Contoso: 1.25 USDC.e 0x1111111111111111111111111111111111111111'
    )
    return { ok: true }
  }

  await send(
    chatId,
    'Received. Processing on 0G Storage and Direct TeeML. You will get AUTO-PAY, OWNER APPROVAL, or BLOCKED when it finishes. This chat cannot hold the owner key.'
  )
  const pdf = payablePdf({
    vendor: parsed.vendor,
    remittance: parsed.remittance,
    amountUsd: parsed.amountUsd,
    invoiceNumber: parsed.invoiceNumber,
    kind: 'telegram-request',
  })
  const wsRef = bound.ws
  const telegramUser = telegramUserId
  void (async () => {
    try {
      const out = await ingestPayable({ ws: wsRef, pdf, source: 'telegram', kind: 'request', analyze: true })
      const body = out.body as { invoiceHash?: string; duplicate?: boolean }
      await logAction(wsRef.id, telegramUser, 'submit', { invoiceHash: body.invoiceHash, duplicate: body.duplicate })
    } catch (e) {
      await send(chatId, `Intake failed. ${e instanceof Error ? e.message : String(e)}. 0 USDC.e moved.`)
    }
  })()
  return { ok: true, accepted: true }
}
