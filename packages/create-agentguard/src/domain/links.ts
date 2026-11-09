import { NETWORKS, type NetworkId } from './networks.js'

function link(page: string, params: Record<string, string>): string {
  return `${page}/?${new URLSearchParams(params).toString()}`
}

export function createLink(page: string, network: NetworkId): string {
  return link(page, { action: 'create', cluster: NETWORKS[network].cluster })
}

/** Squads' add-limit on Solana, the Allowance Module's enable on a Safe. The amount is base units. */
export function capLink(page: string, network: NetworkId, vault: string, cap: bigint): string {
  const { cluster, family } = NETWORKS[network]
  return family === 'solana'
    ? link(page, { action: 'add-limit', cluster, multisig: vault, amount: cap.toString() })
    : link(page, { action: 'enable', cluster, safe: vault, amount: cap.toString() })
}
