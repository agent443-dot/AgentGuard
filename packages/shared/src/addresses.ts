/**
 * Verified onchain addresses. Owner: integrator (Session 5).
 *
 * SPEC rule: never guess. Session 1 reads these from the official Safe, Squads and Circle sources and
 * reports them in /CHANGES_REQUESTED.md. Reading an unset value throws rather than defaulting.
 */
import { CHAINS } from './constants.js'
import type { Address, ChainId } from './types.js'

export interface ChainAddresses {
  /** USDC mint (Solana) or token contract (EVM). Source: Circle. */
  usdc?: Address
  /** Squads v4 program id (Solana). Source: Squads. */
  squadsProgram?: Address
  /** Allowance Module (EVM). Source: Safe deployment list. */
  allowanceModule?: Address
}

export const ADDRESSES: Record<ChainId, ChainAddresses> = {
  [CHAINS.solanaMainnet]: {},
  [CHAINS.solanaDevnet]: {},
  [CHAINS.base]: {},
  [CHAINS.baseSepolia]: {},
}

export function getAddress(chain: ChainId, key: keyof ChainAddresses): Address | undefined {
  return ADDRESSES[chain]?.[key]
}

export function requireAddress(chain: ChainId, key: keyof ChainAddresses): Address {
  const value = getAddress(chain, key)
  if (value === undefined) {
    throw new Error(`address_not_configured: chain=${chain} key=${key}`)
  }
  return value
}
