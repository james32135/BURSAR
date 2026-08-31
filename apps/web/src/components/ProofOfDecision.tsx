import { addrUrl, shortHash, storageUrl, txUrl, usd } from '@/lib/cn'

export type DecisionTrail = {
  received: { invoiceHash: string; source: string; kind: string }
  stored: { storageRoot: string | null; goProofOk: boolean }
  computed: {
    recoveredSigner: string | null
    responseHash: string | null
    attestation: string
  }
  memory: { code: string; detail: string }[]
  policy: { decision: string; nextAction: string; rail: string }
  money: { moved: boolean; payTx: string | null; amountUnits: string }
  why: string[]
}

export type VerifyPayload = {
  status?: string
  reason?: string
  invoiceHash?: string
  txHash?: string
  vault?: string
  vendor?: string
  amount?: string
  storageRoot?: string
  storageScan?: string
  recoveredSigner?: string
  responseHash?: string
  goProof?: { ok?: boolean; log?: string }
  didMoneyMove?: boolean
  nextAction?: string
  why?: string[]
  decision?: DecisionTrail | null
  attestation?: string
}

const STAGES = [
  { key: 'received', t: 'Received' },
  { key: 'stored', t: 'Stored' },
  { key: 'computed', t: 'Computed' },
  { key: 'memory', t: 'Memory' },
  { key: 'policy', t: 'Policy' },
  { key: 'money', t: 'Money' },
] as const

function stageCopy(v: VerifyPayload, d: DecisionTrail | null | undefined, key: (typeof STAGES)[number]['key']) {
  if (key === 'received') {
    return {
      detail: d?.received.invoiceHash || v.invoiceHash || '-',
      sub: `${d?.received.source || 'unknown'} · ${d?.received.kind || 'invoice'}`,
      done: Boolean(d?.received.invoiceHash || v.invoiceHash),
    }
  }
  if (key === 'stored') {
    const root = d?.stored.storageRoot || v.storageRoot
    return {
      detail: root || 'no storage root',
      sub: d?.stored.goProofOk || v.goProof?.ok ? 'Go merkle: file validated' : root ? 'root on 0G Storage' : 'not stored',
      href: root ? v.storageScan || storageUrl(root) : undefined,
      done: Boolean(root),
    }
  }
  if (key === 'computed') {
    const signer = d?.computed.recoveredSigner || v.recoveredSigner
    return {
      detail: signer || 'no recovered signer',
      sub: d?.computed.attestation || v.attestation || 'EIP-191 processResponse (not a hardware quote)',
      href: signer ? addrUrl(signer) : undefined,
      done: Boolean(signer),
    }
  }
  if (key === 'memory') {
    const mem = d?.memory || []
    return {
      detail: mem.length ? mem.map((m) => m.code).join(' · ') : 'no memory flags',
      sub: mem[0]?.detail || 'Recipient history, amount bands, prior hashes, and obligations did not block.',
      done: true,
    }
  }
  if (key === 'policy') {
    return {
      detail: `${d?.policy.nextAction || v.nextAction || '-'} · ${d?.policy.decision || v.status || '-'}`,
      sub: d?.policy.rail || 'usdc.e-16661',
      done: Boolean(d?.policy.decision || v.status),
    }
  }
  const moved = d?.money.moved ?? Boolean(v.didMoneyMove)
  const tx = d?.money.payTx || v.txHash
  return {
    detail: moved ? usd(d?.money.amountUnits || v.amount) : '0.00 USDC.e',
    sub: moved ? tx || 'transfer on chain' : '$0 moved',
    href: tx ? txUrl(tx) : undefined,
    done: v.status === 'VERIFIED' || v.status === 'BLOCKED',
  }
}

export function ProofOfDecision({ v, compact }: { v: VerifyPayload; compact?: boolean }) {
  const d = v.decision
  const why = (d?.why && d.why.length ? d.why : v.why) || []
  const verified = v.status === 'VERIFIED'
  const blocked = v.status === 'BLOCKED'
  return (
    <div className={compact ? '' : 'mt-6'}>
      {!compact && (
        <h3 className="font-display text-lg font-bold">Proof of decision</h3>
      )}
      <p className={`${compact ? '' : 'mt-2'} text-sm text-[var(--fg-muted,#a1a1aa)]`}>
        What arrived, what 0G stored and computed, what memory and policy checked, what money moved, and why the result is{' '}
        {v.status || 'pending'}. Prompts and keys are not shown.
      </p>
      <ol className={`mt-4 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {STAGES.map((s, i) => {
          const copy = stageCopy(v, d, s.key)
          return (
            <li key={s.key} className="rounded-[4px] border border-white/10 bg-[#111113] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#71717a]">
                {String(i + 1).padStart(2, '0')} · {s.t}
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-[#d4d4d8]">
                {copy.href ? (
                  <a className="text-[#93c5fd] underline" href={copy.href} target="_blank" rel="noreferrer">
                    {shortHash(copy.detail, 8)}
                  </a>
                ) : (
                  copy.detail
                )}
              </p>
              <p className="mt-1 text-xs text-[#a1a1aa]">{copy.sub}</p>
            </li>
          )
        })}
      </ol>
      {why.length > 0 && (
        <div className="mt-4 space-y-1">
          {why.map((line) => (
            <p key={line} className={`text-sm ${blocked ? 'text-amber-200' : verified ? 'text-emerald-300' : 'text-[#a1a1aa]'}`}>
              {line}
            </p>
          ))}
        </div>
      )}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#71717a]">
        {verified ? 'VERIFIED because Paid + USDC.e Transfer + Go proof agree' : blocked ? 'BLOCKED. $0 moved' : v.status}
      </p>
    </div>
  )
}
