import { defineChain } from 'viem'
import { LIVE } from './live'

export const aristotle = defineChain({
  id: 16661,
  name: '0G Aristotle',
  nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 },
  rpcUrls: { default: { http: [LIVE.rpc] } },
  blockExplorers: { default: { name: 'ChainScan', url: 'https://chainscan.0g.ai' } },
})

export const vaultAbi = [
  {
    type: 'function',
    name: 'setPaused',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'v', type: 'bool' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setVendor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vendor', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setBands',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'band0Max', type: 'uint256' },
      { name: 'band1Max', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeSession',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'ownerPay',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vendor', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'invoiceHash', type: 'bytes32' },
      { name: 'storageRoot', type: 'bytes32' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'recoveredSigner', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'createSession',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'agent', type: 'address' },
      { name: 'cap', type: 'uint256' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [],
  },
] as const

export const factoryAbi = [
  {
    type: 'function',
    name: 'createVault',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'band0Max', type: 'uint256' },
      { name: 'band1Max', type: 'uint256' },
    ],
    outputs: [{ name: 'vault', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isVault',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'vaultCount',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'vaultAt',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'vaultsOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'event',
    name: 'VaultCreated',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'vault', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'band0Max', type: 'uint256', indexed: false },
      { name: 'band1Max', type: 'uint256', indexed: false },
    ],
  },
] as const

export const usdcAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const
