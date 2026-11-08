/**
 * Verified onchain addresses. Owner: integrator (Session 5).
 *
 * SPEC rule: never guess. Session 1 reads these from the official Safe, Squads and Circle sources and
 * reports them in /CHANGES_REQUESTED.md. Reading an unset value throws rather than defaulting.
 */
import { CHAINS } from './constants.js'
import type { Address, ChainId } from './types.js'

/** CR-007: the chain's dollar. USDC from Circle, or USDG from Paxos on Robinhood Chain. */
export interface UsdToken {
  address: Address
  symbol: 'USDC' | 'USDG'
}

export interface ChainAddresses {
  /** USDC mint (Solana), or the dollar token contract (EVM). */
  usd?: UsdToken
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
    usd: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
    squadsProgram: SQUADS_V4,
  },
  [CHAINS.solanaDevnet]: {
    // https://developers.circle.com/stablecoins/quickstart-transfer-10-usdc-on-solana, and the mint
    // the Circle devnet faucet delivered on 2026-11-03.
    usd: { address: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'USDC' },
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
    usd: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC' },
  },
  // RH-1 (packages/onchain/docs/robinhood-research.md). The Allowance Module 0.1.1 is canonical on both
  // chains in safe-modules-deployments 3.0.14, and its code hash equals Base mainnet's (forge
  // RobinhoodProbe). USDG from Paxos's "USDG on Test/Main Networks" pages, read by the owner
  // (HUMAN-18), and on mainnet also Robinhood's contract list. Robinhood Chain has no Circle USDC:
  // every token named USDC there is someone else's.
  [CHAINS.robinhood]: {
    allowanceModule: '0xAA46724893dedD72658219405185Fb0Fc91e091C',
    usd: { address: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', symbol: 'USDG' },
  },
  [CHAINS.robinhoodTestnet]: {
    allowanceModule: '0xAA46724893dedD72658219405185Fb0Fc91e091C',
    usd: { address: '0x7E955252E15c84f5768B83c41a71F9eba181802F', symbol: 'USDG' },
  },
}

export function getAddress(chain: ChainId, key: keyof ChainAddresses): Address | undefined {
  const value = ADDRESSES[chain]?.[key]
  return typeof value === 'object' ? value.address : value
}

export function usdSymbol(chain: ChainId): UsdToken['symbol'] | undefined {
  return ADDRESSES[chain]?.usd?.symbol
}

export function requireAddress(chain: ChainId, key: keyof ChainAddresses): Address {
  const value = getAddress(chain, key)
  if (value === undefined) {
    throw new Error(`address_not_configured: chain=${chain} key=${key}`)
  }
  return value
}
