import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BACKEND_ROOT, BURSAR_ROOT } from './config.ts'

function run(bin: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${process.env.PATH || ''}:/usr/bin:/usr/local/bin` },
    })
    let err = ''
    child.stderr.on('data', (d) => {
      err += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err.trim() || `${bin} exit ${code}`))
    })
  })
}

function isMissing(err: unknown) {
  const e = err as { code?: string; message?: string }
  return e.code === 'ENOENT' || /ENOENT/.test(e.message || '')
}

export async function rasterizePdf(pdf: Buffer): Promise<Buffer> {
  const dir = mkdtempSync(join(tmpdir(), 'bursar-raster-'))
  const inPath = join(dir, 'invoice.pdf')
  const outPath = join(dir, 'invoice.png')
  writeFileSync(inPath, pdf)
  const errors: string[] = []

  for (const bin of ['/usr/bin/pdftoppm', 'pdftoppm']) {
    try {
      const stem = join(dir, 'page')
      await run(bin, ['-png', '-singlefile', '-r', '144', inPath, stem])
      return readFileSync(`${stem}.png`)
    } catch (e) {
      errors.push(`${bin}: ${e instanceof Error ? e.message : String(e)}`)
      if (!isMissing(e)) break
    }
  }

  const py = [join(BACKEND_ROOT, 'scripts/rasterize.py'), join(BURSAR_ROOT, 'spikes/lib/rasterize.py')].find((p) =>
    existsSync(p)
  )
  if (!py) {
    errors.push('rasterize.py missing')
  } else {
    const bins = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['/usr/bin/python3', 'python3']
    for (const bin of bins) {
      try {
        await run(bin, [py, inPath, outPath])
        return readFileSync(outPath)
      } catch (e) {
        errors.push(`${bin}: ${e instanceof Error ? e.message : String(e)}`)
        if (!isMissing(e)) break
      }
    }
  }
  throw new Error(errors.join(' | '))
}
