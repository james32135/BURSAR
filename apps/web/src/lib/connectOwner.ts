import type { ConnectWalletModalOptions } from '@privy-io/react-auth'
import { OWNER_WALLET_LIST } from './privy'

/** Injected MetaMask only. Never WalletConnect. Never add-chain. */
export function connectOwner(
  connectWallet: (options?: ConnectWalletModalOptions) => void,
  login: () => void,
) {
  connectWallet({
    walletList: [...OWNER_WALLET_LIST],
    description: 'Owner wallet only. BURSAR never asks for a seed phrase.',
  })
}
