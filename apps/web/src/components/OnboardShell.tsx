import { PrivyProvider } from '@privy-io/react-auth'
import { aristotle } from '@/lib/chain'
import Onboarding from '@/pages/Onboarding'

const appId = import.meta.env.PRIVY_APP_ID || ''

export default function OnboardShell() {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: 'dark', accentColor: '#2563eb' },
        loginMethods: ['wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'off' } },
        defaultChain: aristotle,
        supportedChains: [aristotle],
      }}
    >
      <Onboarding />
    </PrivyProvider>
  )
}
