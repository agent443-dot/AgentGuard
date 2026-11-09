import type { ChainId } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'

/** The cluster names the signing page accepts (packages/onchain/web/build.ts). */
const CLUSTERS = new Map<ChainId, string>([
  [CHAINS.solanaDevnet, 'devnet'],
  [CHAINS.solanaMainnet, 'mainnet-beta'],
  [CHAINS.robinhoodTestnet, 'robinhood-testnet'],
  [CHAINS.robinhood, 'robinhood'],
])

/** Solana names the Squads multisig and the hot wallet. On EVM the page knows its hot wallet: only the Safe. */
export type KillTarget = { chain: ChainId } & ({ multisig: string; hot: string } | { safe: string })

/** One chain's onchain kill, as a link the bot stamps with the time it posts it. */
export interface PhantomKill {
  chain: ChainId
  /** The Phantom app's universal link. */
  link: (issued: Date) => string
  /** The same page in the browser, for Phantom's desktop extension. */
  page: (issued: Date) => string
}

/**
 * Opens the onchain kill on our signing page inside Phantom, where only the owner can sign it (ADR
 * 003). Every value comes from the bot's own config and all of them are public: the page derives the
 * limit from them and checks the chain before it asks for a signature. The page refuses a link whose
 * `issued` is more than 15 minutes old, so a button that outlives the bot's memory of it (a restart)
 * still stops working.
 */
export function phantomKillUrl(signPage: string, target: KillTarget, issued: Date): string {
  const link = killPageUrl(signPage, target, issued)
  const ref = new URL(signPage).origin
  return `https://phantom.app/ul/browse/${encodeURIComponent(link)}?ref=${encodeURIComponent(ref)}`
}

/**
 * The signing page itself. On a desktop browser with the Phantom extension the universal link stops
 * at a "open this in the Phantom app" page; this one opens straight in the browser.
 */
export function killPageUrl(signPage: string, target: KillTarget, issued: Date): string {
  const cluster = CLUSTERS.get(target.chain)
  if (cluster === undefined) {
    throw new Error(`no signing-page cluster for ${target.chain}`)
  }
  const keys: Record<string, string> =
    'safe' in target ? { safe: target.safe } : { multisig: target.multisig, hot: target.hot }
  const query = new URLSearchParams({
    action: 'kill',
    cluster,
    ...keys,
    issued: String(Math.floor(issued.getTime() / 1000)),
  })
  return `${signPage.replace(/\/+$/, '')}/?${query}`
}

export function phantomKill(signPage: string, target: KillTarget): PhantomKill {
  return {
    chain: target.chain,
    link: (issued) => phantomKillUrl(signPage, target, issued),
    page: (issued) => killPageUrl(signPage, target, issued),
  }
}
