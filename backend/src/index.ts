import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { config } from './config.ts'
import { getDb } from './db.ts'
import { ensureDemoWorkspace } from './workspace.ts'

await getDb()
await ensureDemoWorkspace()
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`bursar-api listening on ${info.port}`)
})
