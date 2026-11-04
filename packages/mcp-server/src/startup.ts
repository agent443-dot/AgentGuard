import type { Logger } from 'pino'
import type { Guard } from './adapters/guard.js'
import { chainName } from './domain/chains.js'

/**
 * Warns, never fails: refusing to start would take the agent's tools away over a setting that only
 * affects transfers without an explicit chain, and guard-core may simply be down at startup.
 */
export async function checkDefaultChain(
  guard: Guard,
  chain: string,
  usdc: string | undefined,
  log: Logger,
): Promise<void> {
  if (usdc === undefined) {
    log.warn(
      { chain },
      `no USDC address for DEFAULT_CHAIN (${chainName(chain)}): set BASE_USDC, or transfer will refuse every call there`,
    )
  }
  try {
    const { chains } = await guard.budget()
    if (chains === undefined) {
      log.info('guard-core does not report its chains, so DEFAULT_CHAIN is not checked')
    } else if (!chains.includes(chain)) {
      log.warn(
        { chain, allowed: chains },
        'DEFAULT_CHAIN is not a chain guard-core runs and this agent may pay on: transfers without a chain will be rejected',
      )
    }
  } catch (error) {
    log.warn({ err: error }, 'could not read the budget from guard-core at startup')
  }
}
