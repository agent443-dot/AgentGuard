import type { Amount, BudgetView, ChainId, Policy } from '@agentguard/shared'
import * as repo from '../db/repo.js'
import type { PaymentDeps } from './payments.js'

export async function budget(deps: PaymentDeps, policy: Policy): Promise<BudgetView> {
  return {
    spentToday: repo.spentToday(deps.db, policy.agentId, repo.utcDay(deps.now())),
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
