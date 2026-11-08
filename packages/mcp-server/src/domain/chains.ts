import { ADDRESSES, CHAINS, type UsdToken } from '@agentguard/shared'

export const CHAIN_NAMES: Record<string, string> = {
  [CHAINS.solanaMainnet]: 'Solana mainnet',
  [CHAINS.solanaDevnet]: 'Solana devnet',
  [CHAINS.base]: 'Base mainnet',
  [CHAINS.baseSepolia]: 'Base Sepolia',
  [CHAINS.robinhood]: 'Robinhood Chain',
  [CHAINS.robinhoodTestnet]: 'Robinhood Chain testnet',
}

export function chainName(chain: string): string {
  return CHAIN_NAMES[chain] ?? chain
}

const BASE_CHAINS: readonly string[] = [CHAINS.base, CHAINS.baseSepolia]

/**
 * The chain's dollar: USDC, or USDG on Robinhood Chain (CR-007). A verified token in shared wins.
 * `baseUsdc` covers only a Base chain shared has none for yet, as guard-core does: on any other chain
 * a USDC address would be someone else's token. A wrong value cannot move money, because guard-core
 * checks the token against the policy.
 */
export function usdTokenFor(chain: string, baseUsdc: string | undefined): UsdToken | undefined {
  const verified = ADDRESSES[chain]?.usd
  if (verified !== undefined) {
    return verified
  }
  return baseUsdc !== undefined && BASE_CHAINS.includes(chain)
    ? { address: baseUsdc, symbol: 'USDC' }
    : undefined
}

/** For text about a chain whose token this server may not know, such as an intent read back. */
export function usdSymbolFor(chain: string): string {
  return ADDRESSES[chain]?.usd?.symbol ?? (BASE_CHAINS.includes(chain) ? 'USDC' : 'USD')
}
