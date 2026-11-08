import type { AllowanceState, ChainId } from '@agentguard/shared'
import { formatUsd } from './money.js'
import { chainName, utcTime } from './text.js'

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
  'Once guard-core confirms, you get <b>Open kill in Phantom</b> to remove the Solana spending ' +
  'limit onchain, after you confirm in Phantom.'

export const KILL_FAILED =
  '<b>Kill failed</b>: guard-core did not confirm. Assume nothing is paused and run /kill again.'

/** With the signing page configured, the onchain limit is still a brake when guard-core is down. */
export const KILL_FAILED_ONCHAIN =
  '<b>Kill failed</b>: guard-core did <b>NOT</b> confirm a pause. Assume the agents still run and ' +
  'run /kill again. If guard-core stays down, you can still remove the Solana spending limit ' +
  'onchain, which stops the hot wallet from being refilled. That is only the onchain half of the ' +
  'kill: guard-core can still spend what the hot wallet holds.'

export const PHANTOM_ANYWAY = 'Remove onchain limit anyway (Phantom)'

export const KILL_OFFER_EXPIRED =
  '<i>This Phantom button has expired. Use /kill for a fresh one.</i>'
