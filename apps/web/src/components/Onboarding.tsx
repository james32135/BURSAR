import { useState } from 'react'
import { MagneticButton } from './MagneticButton'
import { DeskFlow } from './DeskFlow'

const KEY = 'bursar-desk-onboarded'

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const slides = [
    {
      t: 'What this is',
      d: 'BURSAR is the autonomous finance desk for Web3 teams. It receives invoices, checks them privately, and pays only when policy allows.',
    },
    {
      t: 'Owner vs agent',
      d: 'You own the vault. The agent gets a scoped session. Capability, not ownership. The session cannot withdraw, change policy, or add vendors.',
    },
    {
      t: 'Why connect a wallet',
      d: 'Connect the owner wallet only for owner work: pause, policy, revoke, withdraw. Invoice screening and allowed Band-0 pay do not open MetaMask.',
    },
    {
      t: 'How work moves',
      d: 'Invoice → private AI → policy → vault → payment → proof. The contract is the final authority. AI recommends. It never holds the treasury key.',
    },
  ]
  const s = slides[step]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-labelledby="onboard-title">
      <div className="w-full max-w-lg rounded-md border border-[var(--border)] bg-white p-6 shadow-xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {step + 1} / {slides.length}
        </p>
        <h2 id="onboard-title" className="font-display mt-2 text-2xl">{s.t}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">{s.d}</p>
        {step === 3 && <DeskFlow className="mt-6" />}
        <div className="mt-8 flex justify-between">
          <button
            type="button"
            className="text-sm text-[var(--fg-muted)]"
            onClick={() => {
              localStorage.setItem(KEY, '1')
              onDone()
            }}
          >
            Skip
          </button>
          <MagneticButton
            onClick={() => {
              if (step < slides.length - 1) setStep(step + 1)
              else {
                localStorage.setItem(KEY, '1')
                onDone()
              }
            }}
          >
            {step < slides.length - 1 ? 'Next' : 'Open the desk'}
          </MagneticButton>
        </div>
      </div>
    </div>
  )
}

export function needsOnboarding() {
  try {
    return localStorage.getItem(KEY) !== '1'
  } catch {
    return false
  }
}
