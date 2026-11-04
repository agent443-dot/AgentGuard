import type { Logger } from 'pino'
import type { Guard } from './adapters/guard.js'
import { chainName } from './domain/chains.js'

/**
 * Warns, never fails: guard-core lists a chain in the budget only when it could read the hot wallet
 * balance there, so a missing chain may be a passing RPC failure rather than a misconfiguration.
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
    const { hotWalletBalances } = await guard.budget()
    if (!(chain in hotWalletBalances)) {
      log.warn(
        { chain, reported: Object.keys(hotWalletBalances) },
        'guard-core reports no hot wallet balance on DEFAULT_CHAIN: check it matches the chains guard-core runs',
      )
    }
  } catch (error) {
    log.warn({ err: error }, 'could not read the budget from guard-core at startup')
  }
}
