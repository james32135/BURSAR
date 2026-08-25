/** Minimal PDF so structured payables still hit rasterize → Direct TeeML. Not a mock record. */

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function payablePdf(fields: {
  vendor: string
  remittance: string
  amountUsd: string
  invoiceNumber: string
  memo?: string
  kind?: string
  dueDate?: string
  rail?: string
}): Buffer {
  const lines = [
    'PAYABLE',
    `Vendor: ${fields.vendor}`,
    `Number: ${fields.invoiceNumber}`,
    `Kind: ${fields.kind || 'invoice'}`,
    `Amount USD: ${fields.amountUsd}`,
    `Currency: USDC.e`,
    `Payment rail: ${fields.rail || 'usdc.e-16661'}`,
    `Remittance USDC.e: ${fields.remittance}`,
    fields.dueDate ? `Due: ${fields.dueDate}` : '',
    fields.memo ? `Memo: ${fields.memo}` : '',
  ].filter(Boolean)
  const cmds = lines
    .map((line, i) => `0 ${-18 * i} Td (${esc(line)}) Tj`)
    .join('\n')
  const stream = `BT /F1 12 Tf 50 760 Td\n${cmds}\nET\n`
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ]
  let body = '%PDF-1.4\n'
  const xref: number[] = [0]
  for (const obj of objects) {
    xref.push(body.length)
    body += obj + '\n'
  }
  const start = body.length
  body += `xref\n0 ${xref.length}\n`
  body += '0000000000 65535 f \n'
  for (let i = 1; i < xref.length; i++) body += `${String(xref[i]).padStart(10, '0')} 00000 n \n`
  body += `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}
