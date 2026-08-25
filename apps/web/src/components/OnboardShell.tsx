import { PrivyProvider } from '@privy-io/react-auth'
import { privyConfig } from '@/lib/privy'
import Onboarding from '@/pages/Onboarding'

const appId = import.meta.env.PRIVY_APP_ID || ''

export default function OnboardShell() {
  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <Onboarding />
    </PrivyProvider>
  )
}
