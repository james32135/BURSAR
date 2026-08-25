/**
 * Proxy every /api path to Render, including nested /verify/:id and /invoices/:hash.
 * Vite on Vercel only auto-routed one-segment /api/* handlers.
 * Injects the MCP token for DEMO (x-bursar-demo) from server env. Never VITE_*.
 */
export const config = { matcher: '/api/:path*' }

export default async function middleware(request) {
  const incoming = new URL(request.url)
  const base = (process.env.BURSAR_API_URL || 'https://bursar-api.onrender.com').replace(/\/$/, '')
  const path = incoming.pathname.replace(/^\/api/, '') || '/'
  const dest = base + path + incoming.search
  const headers = new Headers()
  const auth = request.headers.get('authorization')
  const demo = request.headers.get('x-bursar-demo') === '1'
  const token = process.env.BURSAR_MCP_TOKEN_SECRET || ''
  if (auth) headers.set('authorization', auth)
  else if (demo && token) headers.set('authorization', `Bearer ${token}`)
  const ct = request.headers.get('content-type')
  if (ct) headers.set('content-type', ct)
  const method = request.method
  const init = { method, headers }
  if (method !== 'GET' && method !== 'HEAD' && request.body) {
    init.body = request.body
    init.duplex = 'half'
  }
  const upstream = await fetch(dest, init)
  const out = new Headers()
  const outType = upstream.headers.get('content-type')
  if (outType) out.set('content-type', outType)
  return new Response(upstream.body, { status: upstream.status, headers: out })
}
