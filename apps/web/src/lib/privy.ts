import type { PrivyClientConfig } from '@privy-io/react-auth'
import { mainnet } from 'viem/chains'
import { aristotle } from './chain'

export const OWNER_WALLET_LIST = ['detected_wallets', 'metamask'] as const

/**
 * Connect must not force 0G Aristotle (16661).
 *
 * If `supportedChains` is only Aristotle, Privy prompts `wallet_addEthereumChain`
 * on first MetaMask connect. Blockaid treats that plus a `*.vercel.app` origin as
 * a malicious dapp. Ethereum mainnet stays first so an already-connected wallet
 * is "on a supported chain". Switch to 16661 only from the explicit owner action.
 *
 * Do not set `defaultChain`. Do not enable WalletConnect (unverified domain).
 */
export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: 'dark',
    accentColor: '#2563eb',
    logo: 'https://bursarx.vercel.app/favicon.svg',
    showWalletLoginFirst: true,
    walletList: [...OWNER_WALLET_LIST],
    walletChainType: 'ethereum-only',
    landingHeader: 'Connect owner wallet',
    loginMessage: 'BURSAR never asks for a seed phrase. The agent cannot own this vault.',
  },
  loginMethods: ['wallet'],
  embeddedWallets: { ethereum: { createOnLogin: 'off' } },
  supportedChains: [mainnet, aristotle],
  externalWallets: {
    walletConnect: { enabled: false },
  },
  legal: {
    termsAndConditionsUrl: 'https://bursarx.vercel.app/',
    privacyPolicyUrl: 'https://bursarx.vercel.app/',
  },
}
