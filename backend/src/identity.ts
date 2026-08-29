import { ethers } from 'ethers'

/** Foundation 0g-agentic-id production IDs. */
export const PRODUCTION_7857 = {
  IERC165: '0x01ffc9a7',
  IERC721: '0x80ac58cd',
  IERC7857: '0x2afbede9',
  IERC7857Authorize: '0xdf597d99',
  IERC7857Cloneable: '0x74f8628b',
} as const

export const AGENT_ID_ABI = [
  'function supportsInterface(bytes4) view returns (bool)',
  'function ownerOf(uint256) view returns (address)',
  'function vault() view returns (address)',
  'function sessionAgent() view returns (address)',
  'function authorizedUsersOf(uint256) view returns (address[])',
  'function intelligentDatasOf(uint256) view returns (tuple(string dataDescription, bytes32 dataHash)[])',
  'function totalSupply() view returns (uint256)',
]

export async function probeAgentId(rpc: ethers.Provider, address?: string) {
  if (!address || !ethers.isAddress(address) || address === ethers.ZeroAddress) {
    return {
      configured: false,
      note: 'BursarAgentID not set. Clerk identity is optional until deploy.',
      productionIds: PRODUCTION_7857,
      settlement: 'vault-usdc.e-transfer',
      iTransfer: 'disabled — Foundation TEE attestor is Galileo-only',
    }
  }
  const code = await rpc.getCode(address)
  if (code.length <= 4) {
    return { configured: true, address, hasCode: false, reason: 'no code at BURSAR_AGENT_ID' }
  }
  const c = new ethers.Contract(address, AGENT_ID_ABI, rpc)
  const supports: Record<string, boolean> = {}
  for (const [name, id] of Object.entries(PRODUCTION_7857)) {
    supports[name] = Boolean(await c.supportsInterface(id))
  }
  const tokenId = 1n
  const [owner, vault, sessionAgent, authorized, iData, totalSupply] = await Promise.all([
    c.ownerOf(tokenId),
    c.vault(),
    c.sessionAgent(),
    c.authorizedUsersOf(tokenId),
    c.intelligentDatasOf(tokenId),
    c.totalSupply(),
  ])
  const standardsVerifiable =
    supports.IERC165 && supports.IERC721 && supports.IERC7857 && supports.IERC7857Authorize && supports.IERC7857Cloneable
  return {
    configured: true,
    address,
    hasCode: true,
    codeBytes: (code.length - 2) / 2,
    tokenId: '1',
    owner,
    vault,
    sessionAgent,
    authorized,
    intelligentData: iData,
    totalSupply: totalSupply.toString(),
    supportsInterface: supports,
    standardsVerifiable,
    unofficialInterfaceId: false,
    settlement: 'vault-usdc.e-transfer — Agentic ID is clerk identity, not vendor pay',
    iTransfer: 'reverts NoMainnetAttestor',
    processResponse: 'EIP-191 recovery, not a hardware quote',
  }
}
