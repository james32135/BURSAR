import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortHash(value?: string | null, size = 6): string {
  if (!value) return '-'
  if (value.length <= size * 2 + 2) return value
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

export function usd(units: number | string | null | undefined) {
  const n = Number(units || 0)
  if (!Number.isFinite(n)) return '-'
  return (n / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + ' USDC.e'
}

export const EXPLORER = 'https://chainscan.0g.ai'
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addrUrl = (addr: string) => `${EXPLORER}/address/${addr}`
