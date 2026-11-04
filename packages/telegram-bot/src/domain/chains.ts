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
export function killWarning(chains: ChainStatus[] | undefined): string {
  const scope =
    chains === undefined || chains.length === 0
      ? 'for each chain'
      : `for ${chains.map(({ chain }) => chainName(chain)).join(' and ')}`
  return (
    `<b>Kill switch.</b> This pauses every agent and prepares, ${scope}, the owner transaction ` +
    'that sets the allowance to 0 and removes the delegate. Continue?'
  )
}
