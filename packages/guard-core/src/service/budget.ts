import type { Amount, BudgetView, ChainId, Mandate, Policy } from '@agentguard/shared'
import * as repo from '../db/repo.js'
import type { PaymentDeps } from './payments.js'

/**
 * `chains` is what guard-core runs intersected with what this agent's policy allows (CR-006): an
 * agent learns where it can pay, not the rest of the operator's setup.
 */
export async function budget(
  deps: PaymentDeps,
  policy: Policy,
): Promise<BudgetView & { shadowSpentToday: Amount; mandates: Mandate[] }> {
  const day = repo.utcDay(deps.now())
  return {
    chains: policy.chains.filter((chain) => deps.chains.has(chain)),
    spentToday: repo.spentToday(deps.db, policy.agentId, day),
    // What shadow mode would have paid, so the owner sees an agent's habits before funding it.
    shadowSpentToday: repo.shadowSpentToday(deps.db, policy.agentId, day),
    mandates: [],
    dailyMax: policy.dailyMax,
    perTxMax: policy.perTxMax,
    hotWalletBalances: await hotWalletBalances(deps, policy.chains),
    paused: policy.paused,
  }
}

/** USDC per chain. A chain that cannot answer is left out rather than reported as empty. */
async function hotWalletBalances(deps: PaymentDeps, chains: ChainId[]) {
  const balances: Record<ChainId, Amount> = {}
  await Promise.all(
    chains.map(async (chain) => {
      const adapter = deps.chains.get(chain)
      const usdc = deps.usdc.get(chain)
      if (adapter === undefined || usdc === undefined) {
        return
      }
      try {
        balances[chain] = await adapter.getHotWalletBalance(usdc)
      } catch (error) {
        deps.log.warn({ err: error, chain }, 'balance read failed')
      }
    }),
  )
  return balances
}
