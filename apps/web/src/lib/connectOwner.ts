import type { LoginModalOptions } from '@privy-io/react-auth'

/** Privy login (SIWE). connectWallet alone leaves authenticated=false. */
export function connectOwner(login: (options?: LoginModalOptions) => void) {
  login({ loginMethods: ['wallet'] })
}
