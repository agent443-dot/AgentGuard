import { CHAINS, requireAddress } from '@agentguard/shared'

export type Family = 'solana' | 'robinhood'
export type NetworkId =
  'solana-mainnet' | 'solana-devnet' | 'robinhood-mainnet' | 'robinhood-testnet'

export interface Network {
  id: NetworkId
  family: Family
  chain: string
  /** The signing page's name for it, the `cluster` of every link. */
  cluster: string
  label: string
  usd: 'USDC' | 'USDG'
  native: 'SOL' | 'ETH'
  /** Native coin to send the hot wallet: the fees of a few dozen draws and payments. */
  gas: string
  /** The page's build variable for this network's hot wallet. */
  pageHotVar: string
  /** The page's build variable for its RPC, when the page needs one of the owner's own. */
  pageRpcVar?: string
  publicRpc?: string
}

export const NETWORKS: Record<NetworkId, Network> = {
  'solana-mainnet': {
    id: 'solana-mainnet',
    family: 'solana',
    chain: CHAINS.solanaMainnet,
    cluster: 'mainnet-beta',
    label: 'Solana',
    usd: 'USDC',
    native: 'SOL',
    gas: '0.02',
    pageHotVar: 'SOLANA_HOT_WALLET_MAINNET',
    pageRpcVar: 'SOLANA_MAINNET_RPC',
  },
  'solana-devnet': {
    id: 'solana-devnet',
    family: 'solana',
    chain: CHAINS.solanaDevnet,
    cluster: 'devnet',
    label: 'Solana devnet',
    usd: 'USDC',
    native: 'SOL',
    gas: '0.02',
    pageHotVar: 'SOLANA_HOT_WALLET_DEVNET',
    pageRpcVar: 'SOLANA_DEVNET_RPC',
    publicRpc: 'https://api.devnet.solana.com',
  },
  'robinhood-mainnet': {
    id: 'robinhood-mainnet',
    family: 'robinhood',
    chain: CHAINS.robinhood,
    cluster: 'robinhood',
    label: 'Robinhood Chain',
    usd: 'USDG',
    native: 'ETH',
    gas: '0.002',
    pageHotVar: 'ROBINHOOD_HOT_WALLET_MAINNET',
    publicRpc: 'https://rpc.mainnet.chain.robinhood.com',
  },
  'robinhood-testnet': {
    id: 'robinhood-testnet',
    family: 'robinhood',
    chain: CHAINS.robinhoodTestnet,
    cluster: 'robinhood-testnet',
    label: 'Robinhood Chain testnet',
    usd: 'USDG',
    native: 'ETH',
    gas: '0.002',
    pageHotVar: 'ROBINHOOD_HOT_WALLET_TESTNET',
    publicRpc: 'https://rpc.testnet.chain.robinhood.com',
  },
}

export const NETWORK_IDS = Object.keys(NETWORKS) as [NetworkId, ...NetworkId[]]

export function networkFor(family: Family, testnet: boolean): NetworkId {
  if (family === 'solana') {
    return testnet ? 'solana-devnet' : 'solana-mainnet'
  }
  return testnet ? 'robinhood-testnet' : 'robinhood-mainnet'
}

/** The chain's dollar, from the verified addresses in shared only. */
export function usdToken(network: NetworkId): string {
  return requireAddress(NETWORKS[network].chain, 'usd')
}

export function labelOf(chain: string): string {
  return Object.values(NETWORKS).find((network) => network.chain === chain)?.label ?? chain
}
