import type { Amount, PayIntent, RejectCode } from '@agentguard/shared'
import { parseAmount, toAmount } from './amount.js'

export interface AgentReport {
  agentId: string
  /**
   * The sum, in base units, of each chain's dollar (USDC, or USDG on Robinhood Chain). They all have
   * 6 decimals, so the sum reads as dollars; a token with other decimals would need its own line.
   */
  spent: Amount
  payments: number
  refused: Partial<Record<RejectCode, number>>
  domains: { domain: string; spent: Amount }[]
}

/**
 * Per agent: what executed payments spent, how many there were, every refusal by code, and the
 * spend per x402 domain, biggest first. An agent with nothing in the period still has a row, so a
 * quiet agent is visible as quiet rather than missing.
 */
export function summarise(agentIds: string[], intents: PayIntent[]): AgentReport[] {
  return agentIds.map((agentId) => {
    let spent = 0n
    let payments = 0
    const refused: Partial<Record<RejectCode, number>> = {}
    const byDomain = new Map<string, bigint>()
    for (const intent of intents) {
      if (intent.agentId !== agentId) {
        continue
      }
      if (intent.status === 'executed') {
        const amount = parseAmount(intent.amount)
        spent += amount
        payments++
        if (intent.domain !== undefined) {
          byDomain.set(intent.domain, (byDomain.get(intent.domain) ?? 0n) + amount)
        }
      } else if (intent.status === 'rejected') {
        for (const code of intent.rejectReasons) {
          refused[code] = (refused[code] ?? 0) + 1
        }
      }
    }
    const domains = [...byDomain]
      .sort(([, a], [, b]) => (a === b ? 0 : a > b ? -1 : 1))
      .map(([domain, amount]) => ({ domain, spent: toAmount(amount) }))
    return { agentId, spent: toAmount(spent), payments, refused, domains }
  })
}
