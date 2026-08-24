import { PrivyProvider } from '@privy-io/react-auth'
import { AppShell } from './AppShell'
import { aristotle } from '@/lib/chain'

const appId = import.meta.env.PRIVY_APP_ID || ''

export default function PrivyShell() {
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
      <AppShell />
    </PrivyProvider>
  )
}
