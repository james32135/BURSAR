/**
 * Vercel serverless proxy. Injects the MCP token from server env.
 * Never expose BURSAR_MCP_TOKEN_SECRET as VITE_*.
 */
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  const base = (process.env.BURSAR_API_URL || '').replace(/\/$/, '')
  const token = process.env.BURSAR_MCP_TOKEN_SECRET || ''
  if (!base) {
    res.status(503).json({ error: 'BURSAR_API_URL missing' })
    return
  }
  const path = req.url.replace(/^\/api/, '') || '/'
  const url = base + path
  const incoming = req.headers.authorization
  const demo = String(req.headers['x-bursar-demo'] || '') === '1'
  const headers = {}
  if (incoming) headers.authorization = incoming
  else if (demo && token) headers.authorization = `Bearer ${token}`
  const ct = req.headers['content-type']
  if (ct) headers['content-type'] = ct
  const method = req.method || 'GET'
  const init = { method, headers }
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = []
    for await (const c of req) chunks.push(c)
    init.body = Buffer.concat(chunks)
  }
  const upstream = await fetch(url, init)
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.status(upstream.status)
  const outType = upstream.headers.get('content-type')
  if (outType) res.setHeader('content-type', outType)
  res.send(buf)
}
