import type { ChainId } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'

export type ExplorerTarget = 'tx' | 'address'

interface Explorer {
  root: string
  paths: Record<ExplorerTarget, string>
  /** The cluster or network goes in the URL itself: a devnet id opened on mainnet shows nothing. */
  query: string
}

const SOLSCAN = { tx: 'tx', address: 'account' }
// Basescan and Blockscout (Robinhood Chain) use the same paths.
const EVM = { tx: 'tx', address: 'address' }

/** Keyed by the exact CAIP-2 id. A chain missing here gets no link rather than a guess. */
const EXPLORERS = new Map<ChainId, Explorer>([
  [CHAINS.solanaMainnet, { root: 'https://solscan.io', paths: SOLSCAN, query: '' }],
  [CHAINS.solanaDevnet, { root: 'https://solscan.io', paths: SOLSCAN, query: '?cluster=devnet' }],
  [CHAINS.base, { root: 'https://basescan.org', paths: EVM, query: '' }],
  [CHAINS.baseSepolia, { root: 'https://sepolia.basescan.org', paths: EVM, query: '' }],
  [CHAINS.robinhood, { root: 'https://robinhoodchain.blockscout.com', paths: EVM, query: '' }],
  [
    CHAINS.robinhoodTestnet,
    { root: 'https://explorer.testnet.chain.robinhood.com', paths: EVM, query: '' },
  ],
])

export function explorerUrl(
  chain: ChainId,
  target: ExplorerTarget,
  id: string,
): string | undefined {
  const explorer = EXPLORERS.get(chain)
  if (explorer === undefined || id === '') {
    return undefined
  }
  // The id came from a counterparty: encoding keeps it one path segment on the explorer we chose.
  return `${explorer.root}/${explorer.paths[target]}/${encodeURIComponent(id)}${explorer.query}`
}
