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

// Squads v4 is deployed at the same program id on every Solana cluster. Source: the PROGRAM_ID the
// official @sqds/multisig SDK exports.
const SQUADS_V4 = 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf'

export const ADDRESSES: Record<ChainId, ChainAddresses> = {
  [CHAINS.solanaMainnet]: {
    // https://developers.circle.com/stablecoins/usdc-contract-addresses
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    squadsProgram: SQUADS_V4,
  },
  [CHAINS.solanaDevnet]: {
    // https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana, and the mint
    // the Circle devnet faucet delivered on 2026-11-03.
    usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    squadsProgram: SQUADS_V4,
  },
  [CHAINS.base]: {},
  [CHAINS.baseSepolia]: {
    // Allowance Module 0.1.1 at Safe's deterministic address. Safe's list has no Base Sepolia entry,
    // so CR-005 compares runtime code instead: the code hash here equals the official Base mainnet
    // deployment's, 0x7aa63affdca06fe94576f00077ad61a02ccf203a5da31e1b4ed595df7b65cf3e
    // (forge test_moduleOnSepoliaIsTheMainnetCode).
    allowanceModule: '0xAA46724893dedD72658219405185Fb0Fc91e091C',
    // https://developers.circle.com/stablecoins/usdc-contract-addresses, the Base Sepolia row,
    // confirmed by the owner on 2026-11-04. It is also the address the x402 SDK ships for this chain.
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
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
