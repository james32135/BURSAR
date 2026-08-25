import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../src/app.ts'
import { config } from '../src/config.ts'

test('telegram webhook without bot would 503 only if token missing; secret mismatch is 401', async () => {
  if (!config.telegramBotToken) {
    const res = await app.request('/integrations/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 1 }),
    })
    assert.equal(res.status, 503)
    return
  }
  if (!config.telegramWebhookSecret) return
  const bad = await app.request('/integrations/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'nope' },
    body: JSON.stringify({ update_id: Date.now() }),
  })
  assert.equal(bad.status, 401)
})
