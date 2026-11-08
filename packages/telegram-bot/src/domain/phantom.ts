import type { ChainId } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'

/** The cluster names the signing page accepts (packages/onchain/web/build.ts). */
const CLUSTERS = new Map<ChainId, string>([
  [CHAINS.solanaDevnet, 'devnet'],
  [CHAINS.solanaMainnet, 'mainnet-beta'],
])

export interface KillPage {
  signPage: string
  chain: ChainId
  multisig: string
  hot: string
}

/**
 * Opens the onchain kill on our signing page inside Phantom, where only the owner can sign it (ADR
 * 003). Every value comes from the bot's own config and all of them are public: the page derives the
 * spending limit from them and checks the chain before it asks for a signature. The page refuses a
 * link whose `issued` is more than 15 minutes old, so a button that outlives the bot's memory of it
 * (a restart) still stops working.
 */
export function phantomKillUrl({ signPage, chain, multisig, hot }: KillPage, issued: Date): string {
  const cluster = CLUSTERS.get(chain)
  if (cluster === undefined) {
    throw new Error(`no signing-page cluster for ${chain}`)
  }
  const query = `action=kill&cluster=${cluster}&multisig=${encodeURIComponent(multisig)}&hot=${encodeURIComponent(hot)}&issued=${Math.floor(issued.getTime() / 1000)}`
  const link = `${signPage.replace(/\/+$/, '')}/?${query}`
  const ref = new URL(signPage).origin
  return `https://phantom.app/ul/browse/${encodeURIComponent(link)}?ref=${encodeURIComponent(ref)}`
}
