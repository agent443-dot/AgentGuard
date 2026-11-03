import type { PayIntent, RejectCode, SimulationResult } from '@agentguard/shared'
import { parseAmount } from './amount.js'

const SIGNED = /^-?(0|[1-9]\d*)$/

/**
 * The adapters run the chain-specific checks. This one holds on every chain: the wallet must not
 * lose more of the token than the intent pays. A figure we cannot read fails the simulation.
 */
export function checkSimulation(simulation: SimulationResult, intent: PayIntent): RejectCode[] {
  let net = 0n
  for (const change of simulation.balanceChanges) {
    if (!SIGNED.test(change.delta)) {
      return ['SIM_FAILED']
    }
    if (change.token === intent.token) {
      net += BigInt(change.delta)
    }
  }
  return net < -parseAmount(intent.amount) ? ['SIM_UNEXPECTED_EFFECT'] : []
}
