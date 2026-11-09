/** Constants from /SPEC.md. */
import type { ChainId, SharedRejectCode } from './types.js'

/**
 * CAIP-2 chain identifiers. The Solana reference is the first 32 characters of the cluster's base58
 * genesis hash, confirmed against both clusters with `solana genesis-hash` (CR-002).
 */
export const CHAINS = {
  solanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  solanaDevnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  base: 'eip155:8453',
  baseSepolia: 'eip155:84532',
  // CR-007. Chain ids read from the chains themselves (forge/RobinhoodProbe.t.sol).
  robinhood: 'eip155:4663',
  robinhoodTestnet: 'eip155:46630',
} as const satisfies Record<string, ChainId>

export type SupportedChain = (typeof CHAINS)[keyof typeof CHAINS]

export function isEvm(chain: ChainId): boolean {
  return chain.startsWith('eip155:')
}

export function isSvm(chain: ChainId): boolean {
  return chain.startsWith('solana:')
}

/** Each chain's dollar (USDC, or USDG on Robinhood Chain) has 6 decimals. */
export const USDC_DECIMALS = 6

export const GUARD_PORT = 8787

/** Pending intents expire after 10 minutes with APPROVAL_TIMEOUT. */
export const APPROVAL_TTL_MS = 10 * 60 * 1000

/** Safe Allowance Module reset period, in minutes. 24h. */
export const ALLOWANCE_RESET_TIME_MIN = 1440

export const SHARED_REJECT_CODES = [
  'PAUSED',
  'CHAIN_NOT_ALLOWED',
  'TOKEN_NOT_ALLOWED',
  'RECIPIENT_NOT_ALLOWED',
  'DOMAIN_NOT_ALLOWED',
  'PER_TX_EXCEEDED',
  'DAILY_EXCEEDED',
  'SIM_FAILED',
  'SIM_UNEXPECTED_EFFECT',
  'OWNER_REJECTED',
  'APPROVAL_TIMEOUT',
  'INVALID_402',
  'MANDATE_REQUIRED',
  'MANDATE_EXCEEDED',
  'MANDATE_EXPIRED',
  'BREAKER_TRIPPED',
] as const satisfies readonly SharedRejectCode[]
