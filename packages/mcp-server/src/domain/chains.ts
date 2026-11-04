import { CHAINS, getAddress, isEvm } from '@agentguard/shared'

export const CHAIN_NAMES: Record<string, string> = {
  [CHAINS.solanaMainnet]: 'Solana mainnet',
  [CHAINS.solanaDevnet]: 'Solana devnet',
  [CHAINS.base]: 'Base mainnet',
  [CHAINS.baseSepolia]: 'Base Sepolia',
}

export function chainName(chain: string): string {
  return CHAIN_NAMES[chain] ?? chain
}

/**
 * The USDC token for a chain. A verified address in shared wins; `baseUsdc` covers a Base chain that
 * shared has no address for yet, the same fallback guard-core uses. A wrong value cannot move money:
 * guard-core checks the token against the policy.
 */
export function usdcFor(chain: string, baseUsdc: string | undefined): string | undefined {
  return getAddress(chain, 'usdc') ?? (isEvm(chain) ? baseUsdc : undefined)
}
