import type { AllowanceState, ChainId } from '@agentguard/shared'
import { formatUsd } from './money.js'
import { alreadyRemoved, chainName, utcTime } from './text.js'

/** One chain guard-core runs. A null allowance is a chain whose onchain state could not be read. */
export interface ChainStatus {
  chain: ChainId
  allowance: AllowanceState | null
}

/** The chains block of /status. Undefined: this guard-core cannot report its chains yet. */
export function chainsText(chains: ChainStatus[] | undefined): string {
  if (chains === undefined) {
    return 'Chains: not reported by this guard-core'
  }
  if (chains.length === 0) {
    return '<b>Chains: none configured.</b> Every payment is refused.'
  }
  return ['Chains:', ...chains.map(chainLine)].join('\n')
}

function chainLine({ chain, allowance }: ChainStatus): string {
  if (allowance === null) {
    return `• ${chainName(chain)}: <b>onchain allowance could not be read</b>`
  }
  if (allowance.status === 'none') {
    return `• ${chainName(chain)}: <b>no onchain limit (killed)</b>`
  }
  return (
    `• ${chainName(chain)}: ${formatUsd(allowance.spent)} of ${formatUsd(allowance.cap)} ` +
    `onchain today, resets ${utcTime(allowance.resetsAt)}`
  )
}

/** Names the chains when guard-core reports them, so the owner sees what kill will cover. */
export function killWarning(chains: ChainStatus[] | undefined, phantom = false): string {
  const scope =
    chains === undefined || chains.length === 0
      ? 'for each chain'
      : `for ${chains.map(({ chain }) => chainName(chain)).join(' and ')}`
  const warning =
    `<b>Kill switch.</b> <b>Kill everything</b> pauses every agent and prepares, ${scope}, the ` +
    'owner transaction that sets the allowance to 0 and removes the delegate.'
  return phantom ? `${warning}\n${PHANTOM_STEP}\nContinue?` : `${warning} Continue?`
}

/**
 * Only the owner's key can remove the onchain limit, so the bot hands it over. It does so only after
 * guard-core has paused the agents: the onchain half alone would leave the guard running.
 */
export const PHANTOM_STEP =
  'Once guard-core confirms, you get a Phantom button for each chain to remove its onchain limit, ' +
  'after you confirm in Phantom.'

export const KILL_FAILED =
  '<b>Kill failed</b>: guard-core did not confirm. Assume nothing is paused and run /kill again.'

/** Squads on Solana, the Safe's Allowance Module on EVM: either way it is what refills the hot wallet. */
function brake(chain: ChainId): string {
  return chain.startsWith('solana:')
    ? 'the Squads spending limit that refills the hot wallet'
    : "the hot wallet's allowance on the Safe, which refills it"
}

/**
 * With the signing page configured, the onchain limits are still a brake when guard-core is down.
 * Each button removes one chain's, so the message says which does what.
 */
export function killFailedOnchain(chains: ChainId[], removed: ChainId[] = []): string {
  if (chains.length === 0) {
    return [KILL_FAILED, ...removed.map(alreadyRemoved)].join('\n')
  }
  return [
    '<b>Kill failed</b>: guard-core did <b>NOT</b> confirm a pause. Assume the agents still run and ' +
      'run /kill again. If guard-core stays down, each button below removes one onchain limit:',
    ...chains.map((chain) => `• ${chainName(chain)}: ${brake(chain)}`),
    ...removed.map(alreadyRemoved),
    'That is only the onchain half of the kill: guard-core can still spend what the hot wallets hold.',
  ].join('\n')
}

export const openLabel = (chain: ChainId) => `Open ${chainName(chain)} kill in Phantom`
export const anywayLabel = (chain: ChainId) => `Remove ${chainName(chain)} limit anyway (Phantom)`

export const KILL_OFFER_EXPIRED =
  '<i>This Phantom button has expired. Use /kill for a fresh one.</i>'
