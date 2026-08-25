import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bursarRoot = resolve(here, '../..')

function envFile(): Record<string, string> {
  const p = resolve(bursarRoot, '.env')
  const out: Record<string, string> = {}
  if (!existsSync(p)) return out
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    let v = t.slice(i + 1)
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[t.slice(0, i)] = v
  }
  return out
}

export default defineConfig(() => {
  const env = envFile()
  const token = env.BURSAR_MCP_TOKEN_SECRET || process.env.BURSAR_MCP_TOKEN_SECRET || ''
  const privyAppId = env.PRIVY_APP_ID || process.env.PRIVY_APP_ID || 'cmt7x9rac00220cla0me1vobe'
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': resolve(here, 'src') } },
    define: {
      'import.meta.env.PRIVY_APP_ID': JSON.stringify(privyAppId),
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          rewrite: (p) => p.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const incoming = req.headers.authorization
              if (incoming) {
                proxyReq.setHeader('authorization', String(incoming))
                return
              }
              const demo = String(req.headers['x-bursar-demo'] || '') === '1'
              if (demo && token) proxyReq.setHeader('authorization', `Bearer ${token}`)
            })
          },
        },
      },
    },
  }
})
