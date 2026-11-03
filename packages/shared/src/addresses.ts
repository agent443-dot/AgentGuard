/**
 * Verified onchain addresses. Owner: integrator (Session 5).
 *
 * SPEC rule: never guess an address. Session 1 (onchain) reads them from the official Safe and
 * Circle deployment lists and reports them in /CHANGES_REQUESTED.md; the integrator fills them in
 * here with a link to the source. Reading an unset address throws instead of defaulting.
 */
import { CHAIN_IDS } from './constants.js'
import type { Hex } from './types.js'

export interface ChainAddresses {
  /** USDC token. Source: Circle official deployment list. */
  usdc?: Hex
  /** Safe Allowance Module (audited). Source: Safe official deployment list. */
  allowanceModule?: Hex
}

export const ADDRESSES: Record<number, ChainAddresses> = {
  [CHAIN_IDS.baseSepolia]: {},
  [CHAIN_IDS.base]: {},
}

export function getAddress(chainId: number, key: keyof ChainAddresses): Hex | undefined {
  return ADDRESSES[chainId]?.[key]
}

/** Throws when the address has not been verified and filled in yet. Default deny, per SPEC. */
export function requireAddress(chainId: number, key: keyof ChainAddresses): Hex {
  const value = getAddress(chainId, key)
  if (value === undefined) {
    throw new Error(`address_not_configured: chainId=${chainId} key=${key}`)
  }
  return value
}
