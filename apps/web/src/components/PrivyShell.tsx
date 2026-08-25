import { PrivyProvider } from '@privy-io/react-auth'
import { AppShell } from './AppShell'
import { privyConfig } from '@/lib/privy'

const appId = import.meta.env.PRIVY_APP_ID || ''

export default function PrivyShell() {
  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <AppShell />
    </PrivyProvider>
  )
}
