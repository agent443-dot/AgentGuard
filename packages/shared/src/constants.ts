/**
 * Constants from /SPEC.md. Owner: integrator (Session 5).
 */
import type { ChainId, SharedRejectCode } from './types.js'

/**
 * CAIP-2 chain identifiers. The Solana reference is the first 32 characters of the cluster's base58
 * genesis hash.
 *
 * UNVERIFIED (task INT-1): the two Solana values below are the commonly published identifiers but have
 * not been checked against a cluster. Confirm with
 *   curl -s https://api.devnet.solana.com -H 'content-type: application/json' \
 *     -d '{"jsonrpc":"2.0","id":1,"method":"getGenesisHash"}'
 * and the same against api.mainnet-beta.solana.com. A wrong value makes every x402 network check fail.
 */
export const CHAINS = {
  solanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  solanaDevnet: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  base: 'eip155:8453',
  baseSepolia: 'eip155:84532',
} as const satisfies Record<string, ChainId>

export type SupportedChain = (typeof CHAINS)[keyof typeof CHAINS]

export function isEvm(chain: ChainId): boolean {
  return chain.startsWith('eip155:')
}

export function isSvm(chain: ChainId): boolean {
  return chain.startsWith('solana:')
}

/** USDC is the only token in v0.1, and has 6 decimals on both chains. */
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
] as const satisfies readonly SharedRejectCode[]
