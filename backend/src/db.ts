import { PGlite } from '@electric-sql/pglite'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BACKEND_ROOT, config } from './config.ts'

export type QueryResult = { rows: Record<string, unknown>[] }

export interface Db {
  query(sql: string, params?: unknown[]): Promise<QueryResult>
}

let db: Db

function isPostgres(url: string) {
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
}

async function migrate(client: Db) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      vault TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL,
      agent_address TEXT NOT NULL,
      agent_pk_enc TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      demo BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const invCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices'`
  )
  const invNames = new Set(invCols.rows.map((r) => String(r.column_name)))
  if (invNames.size && !invNames.has('workspace_id')) {
    await client.query(`ALTER TABLE invoices ADD COLUMN workspace_id TEXT`)
  }
  if (invNames.size) {
    await client.query(`UPDATE invoices SET workspace_id = 'demo' WHERE workspace_id IS NULL`)
  }

  const evCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'events'`
  )
  const evNames = new Set(evCols.rows.map((r) => String(r.column_name)))
  if (evNames.size && !evNames.has('workspace_id')) {
    await client.query(`ALTER TABLE events ADD COLUMN workspace_id TEXT`)
  }

  await client.query(`CREATE INDEX IF NOT EXISTS invoices_ws_idx ON invoices (workspace_id)`)
  await client.query(`CREATE INDEX IF NOT EXISTS events_ws_idx ON events (workspace_id)`)
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS invoices_ws_hash_uidx ON invoices (workspace_id, invoice_hash)`
  )
  try {
    await client.query('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_pkey')
  } catch {
    /* older PGlite */
  }

  const extra = [
    ['source', 'TEXT'],
    ['kind', 'TEXT'],
    ['pipeline', 'TEXT'],
    ['decision', 'TEXT'],
    ['decision_why', 'JSONB'],
  ]
  const nowCols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices'`
  )
  const have = new Set(nowCols.rows.map((r) => String(r.column_name)))
  for (const [col, typ] of extra) {
    if (!have.has(col)) await client.query(`ALTER TABLE invoices ADD COLUMN ${col} ${typ}`)
  }
  await client.query(`
    CREATE TABLE IF NOT EXISTS integrations (
      workspace_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, kind)
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_identities (
      telegram_user_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      username TEXT,
      bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ,
      last_action_at TIMESTAMPTZ
    )
  `)
  await client.query(`CREATE INDEX IF NOT EXISTS telegram_identities_ws_idx ON telegram_identities (workspace_id)`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_bind_codes (
      code_hash TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_updates (
      update_id BIGINT PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS telegram_actions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS email_messages (
      workspace_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      attachment_hash TEXT NOT NULL,
      invoice_hash TEXT,
      from_addr TEXT,
      subject TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, message_id)
    )
  `)
  await client.query(`CREATE INDEX IF NOT EXISTS email_messages_hash_idx ON email_messages (workspace_id, attachment_hash)`)
}

export async function getDb(): Promise<Db> {
  if (db) return db
  const schema = readFileSync(resolve(BACKEND_ROOT, 'src/schema.sql'), 'utf8')
  if (isPostgres(config.databaseUrl)) {
    const pgmod = await import('pg')
    const Pool =
      (pgmod as { default?: { Pool: new (c: unknown) => { query: Db['query'] } }; Pool?: new (c: unknown) => { query: Db['query'] } })
        .default?.Pool || (pgmod as { Pool: new (c: unknown) => { query: Db['query'] } }).Pool
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    })
    try {
      await pool.query(schema)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.includes('does not exist') && !msg.includes('already exists')) throw e
    }
    db = {
      async query(sql: string, params: unknown[] = []) {
        const res = await pool.query(sql, params)
        return { rows: (res.rows || []) as Record<string, unknown>[] }
      },
    }
    await migrate(db)
    return db
  }
  mkdirSync(config.pgliteDir, { recursive: true })
  const client = new PGlite(config.pgliteDir)
  await client.waitReady
  try {
    await client.exec(schema)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('does not exist') && !msg.includes('already exists')) throw e
  }
  db = {
    async query(sql: string, params: unknown[] = []) {
      const res = await client.query(sql, params)
      return { rows: (res.rows || []) as Record<string, unknown>[] }
    },
  }
  await migrate(db)
  return db
}

export async function recordEvent(
  workspaceId: string | null,
  invoiceHash: string | null,
  kind: string,
  detail: unknown
) {
  const d = await getDb()
  await d.query(
    'INSERT INTO events (workspace_id, invoice_hash, kind, detail) VALUES ($1, $2, $3, $4::jsonb)',
    [workspaceId, invoiceHash, kind, JSON.stringify(detail ?? {})]
  )
}
