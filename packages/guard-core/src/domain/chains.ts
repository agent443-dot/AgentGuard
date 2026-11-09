import { CHAINS, type ChainId } from '@agentguard/shared'

const NAMES = new Map<ChainId, string>([
  [CHAINS.solanaMainnet, 'Solana'],
  [CHAINS.solanaDevnet, 'Solana devnet'],
  [CHAINS.base, 'Base'],
  [CHAINS.baseSepolia, 'Base Sepolia'],
  [CHAINS.robinhood, 'Robinhood Chain'],
  [CHAINS.robinhoodTestnet, 'Robinhood Chain testnet'],
])

/** The name the owner knows a chain by; the CAIP id for one without a name. */
export function chainName(chain: ChainId): string {
  return NAMES.get(chain) ?? chain
}
