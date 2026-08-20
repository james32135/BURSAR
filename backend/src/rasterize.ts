import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKEND_ROOT, BURSAR_ROOT } from './config.ts'

function runPython(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => {
      err += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err || `${bin} exit ${code}`))
    })
  })
}

export async function rasterizePdf(pdf: Buffer): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'bursar-raster-'))
  const inPath = join(dir, 'invoice.pdf')
  const outPath = join(dir, 'invoice.png')
  writeFileSync(inPath, pdf)
  const py = [join(BACKEND_ROOT, 'scripts/rasterize.py'), join(BURSAR_ROOT, 'spikes/lib/rasterize.py')].find((p) =>
    existsSync(p)
  )
  if (!py) throw new Error('rasterize.py missing')
  const bins = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  let last = 'no python'
  for (const bin of bins) {
    try {
      await runPython(bin, [py, inPath, outPath])
      const { readFileSync } = await import('node:fs')
      return readFileSync(outPath)
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(last)
}
