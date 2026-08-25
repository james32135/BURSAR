export type BursarClientOptions = { baseUrl: string; token: string }

export class BursarClient {
  constructor(private opts: BursarClientOptions) {}

  private async req(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${this.opts.token}`)
    const res = await fetch(this.opts.baseUrl.replace(/\/$/, '') + path, { ...init, headers })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(`bursar ${res.status} ${path}`)
      ;(err as Error & { status: number; body: unknown }).status = res.status
      ;(err as Error & { status: number; body: unknown }).body = json
      throw err
    }
    return json
  }

  health() {
    return fetch(this.opts.baseUrl.replace(/\/$/, '') + '/health').then((r) => r.json())
  }
  workspace() {
    return this.req('/workspace')
  }
  getPaymentStatus(hash: string) {
    return this.req('/invoices/' + hash).then((inv: { status: string; pay_tx?: string; amount_units?: string; remittance?: string }) => ({
      hash,
      status: inv.status,
      pay_tx: inv.pay_tx,
      amount_units: inv.amount_units,
      remittance: inv.remittance,
    }))
  }
  stats() {
    return this.req('/workspace/stats')
  }
  policy() {
    return this.req('/policy')
  }
  queue() {
    return this.req('/queue')
  }
  getInvoice(hash: string) {
    return this.req('/invoices/' + hash)
  }
  async submitInvoice(pdf: Buffer | Uint8Array, analyze = true) {
    const form = new FormData()
    form.set('file', new Blob([pdf]), 'invoice.pdf')
    return this.req('/invoices?analyze=' + (analyze ? '1' : '0'), { method: 'POST', body: form })
  }
  submitPayable(body: { vendor: string; remittance: string; amountUsd: string; invoiceNumber?: string; memo?: string; kind?: string }) {
    return this.req('/payables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  }
  attention() {
    return this.req('/attention')
  }
  vendorMemory() {
    return this.req('/vendors/memory')
  }
  payAllowed() {
    return this.req('/queue/pay-allowed', { method: 'POST' })
  }
  pay(hash: string) {
    return this.req('/invoices/' + hash + '/pay', { method: 'POST' })
  }
  verify(id: string) {
    return fetch(this.opts.baseUrl.replace(/\/$/, '') + '/verify/' + id).then((r) => r.json())
  }
}
