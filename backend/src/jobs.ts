import { randomBytes } from 'node:crypto'
import { getDb } from './db.ts'
import { ingestPayable } from './ingest.ts'
import { getWorkspaceById } from './workspace.ts'

type IngestPayload = {
  pdfBase64: string
  source: string
  kind: string
  analyze: boolean
}

let draining = false

export async function enqueueIngestJob(args: {
  workspaceId: string
  invoiceHash: string
  pdf: Buffer
  source: string
  kind: string
  analyze: boolean
}) {
  const db = await getDb()
  const id = randomBytes(12).toString('hex')
  await db.query(
    `INSERT INTO jobs (id, workspace_id, kind, status, payload, invoice_hash)
     VALUES ($1,$2,'ingest','queued',$3::jsonb,$4)`,
    [
      id,
      args.workspaceId,
      JSON.stringify({
        pdfBase64: args.pdf.toString('base64'),
        source: args.source,
        kind: args.kind,
        analyze: args.analyze,
      } satisfies IngestPayload),
      args.invoiceHash,
    ]
  )
  return id
}

export async function drainJobs() {
  if (draining) return
  draining = true
  try {
    const db = await getDb()
    const q = await db.query(
      `SELECT * FROM jobs WHERE kind = 'ingest' AND status = 'queued' ORDER BY created_at ASC LIMIT 1`
    )
    const row = q.rows[0]
    if (!row) return
    await db.query(`UPDATE jobs SET status = 'running', updated_at = NOW() WHERE id = $1`, [row.id])
    const payload = (typeof row.payload === 'string' ? JSON.parse(String(row.payload)) : row.payload) as IngestPayload
    const ws = await getWorkspaceById(String(row.workspace_id))
    if (!ws) {
      await db.query(`UPDATE jobs SET status = 'failed', error = 'workspace gone', updated_at = NOW() WHERE id = $1`, [
        row.id,
      ])
      return
    }
    try {
      const out = await ingestPayable({
        ws,
        pdf: Buffer.from(payload.pdfBase64, 'base64'),
        source: payload.source,
        kind: payload.kind,
        analyze: payload.analyze !== false,
      })
      if (out.statusCode >= 400 && !('duplicate' in (out.body as { duplicate?: boolean }))) {
        await db.query(`UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`, [
          row.id,
          JSON.stringify(out.body).slice(0, 400),
        ])
        return
      }
      await db.query(`UPDATE jobs SET status = 'done', updated_at = NOW() WHERE id = $1`, [row.id])
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 400) : String(e).slice(0, 400)
      await db.query(`UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW() WHERE id = $1`, [row.id, msg])
    }
  } finally {
    draining = false
  }
}

export function startJobWorker() {
  const tick = () => {
    void drainJobs().catch((e) => console.error('job drain', e))
  }
  tick()
  return setInterval(tick, 2000)
}
