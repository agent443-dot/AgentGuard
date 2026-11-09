import type { ChainAdapter } from '@agentguard/onchain'
import type { PayIntent, RejectCode, SimulationResult } from '@agentguard/shared'
import { redactUrls } from '../domain/redact.js'
import { checkSimulation } from '../domain/simulation.js'
import type { PaymentDeps } from './payments.js'

/** Nothing is signed unless the simulation found nothing to object to. */
export async function simulate(
  deps: Pick<PaymentDeps, 'log'>,
  adapter: ChainAdapter,
  intent: PayIntent,
): Promise<{ simulation?: SimulationResult; reasons: RejectCode[]; error?: string }> {
  try {
    const outcome = await adapter.simulate(intent)
    const reasons =
      outcome.rejectReasons.length > 0
        ? outcome.rejectReasons
        : checkSimulation(outcome.simulation, intent)
    return { simulation: outcome.simulation, reasons }
  } catch (thrown) {
    // Without the adapter's message a SIM_FAILED on a live chain leaves nothing to debug from.
    const error = String(redactUrls(thrown instanceof Error ? thrown.message : String(thrown)))
    deps.log.warn({ intentId: intent.id, chain: intent.chain, error }, 'simulation failed')
    return { reasons: ['SIM_FAILED'], error }
  }
}
