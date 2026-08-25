export class BursarClient {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    async req(path, init = {}) {
        const headers = new Headers(init.headers);
        headers.set('authorization', `Bearer ${this.opts.token}`);
        const res = await fetch(this.opts.baseUrl.replace(/\/$/, '') + path, { ...init, headers });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(`bursar ${res.status} ${path}`);
            err.status = res.status;
            err.body = json;
            throw err;
        }
        return json;
    }
    health() {
        return fetch(this.opts.baseUrl.replace(/\/$/, '') + '/health').then((r) => r.json());
    }
    workspace() {
        return this.req('/workspace');
    }
    getPaymentStatus(hash) {
        return this.req('/invoices/' + hash).then((inv) => ({
            hash,
            status: inv.status,
            pay_tx: inv.pay_tx,
            amount_units: inv.amount_units,
            remittance: inv.remittance,
        }));
    }
    stats() {
        return this.req('/workspace/stats');
    }
    policy() {
        return this.req('/policy');
    }
    queue() {
        return this.req('/queue');
    }
    getInvoice(hash) {
        return this.req('/invoices/' + hash);
    }
    async submitInvoice(pdf, analyze = true) {
        const form = new FormData();
        form.set('file', new Blob([pdf]), 'invoice.pdf');
        return this.req('/invoices?analyze=' + (analyze ? '1' : '0'), { method: 'POST', body: form });
    }
    submitPayable(body) {
        return this.req('/payables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    createPayable(body) {
        return this.submitPayable(body);
    }
    getPayable(hash) {
        return this.getInvoice(hash);
    }
    review() {
        return this.attention().then((a) => ({
            payables: (a.payables || []).filter((p) => p.status === 'flagged' || p.decision === 'owner-review' || p.status === 'blocked'),
        }));
    }
    explainDecision(hash) {
        return this.getInvoice(hash).then((inv) => ({
            hash,
            status: inv.status,
            decision: inv.decision,
            why: inv.why,
            flags: inv.flags,
        }));
    }
    payments() {
        return this.queue().then((q) => ({
            payments: (q.invoices || []).filter((i) => i.pay_tx || i.status === 'paid'),
        }));
    }
    vendors() {
        return this.vendorMemory();
    }
    attention() {
        return this.req('/attention');
    }
    vendorMemory() {
        return this.req('/vendors/memory');
    }
    payAllowed() {
        return this.req('/queue/pay-allowed', { method: 'POST' });
    }
    pay(hash) {
        return this.req('/invoices/' + hash + '/pay', { method: 'POST' });
    }
    events() {
        return this.req('/events');
    }
    agentBounds() {
        return this.req('/workspace/agent-bounds');
    }
    async waitForDecision(hash, timeoutMs = 180_000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const inv = (await this.getInvoice(hash));
            if (inv.decision || ['clean', 'flagged', 'blocked', 'paid'].includes(String(inv.status)))
                return inv;
            await new Promise((r) => setTimeout(r, 2500));
        }
        throw new Error('timeout waiting for payable decision');
    }
    verify(id) {
        return fetch(this.opts.baseUrl.replace(/\/$/, '') + '/verify/' + id).then((r) => r.json());
    }
    verifyPayment(id) {
        return this.verify(id);
    }
}
