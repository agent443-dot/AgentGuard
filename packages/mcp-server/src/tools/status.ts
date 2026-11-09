import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Budget, Intent } from '../adapters/guard.js'
import { chainName, usdSymbolFor } from '../domain/chains.js'
import { explainStatus } from '../domain/explain.js'
import { formatAmount } from '../domain/usd.js'
import { listOf } from './start-task.js'
import type { ToolDeps } from './deps.js'
import { guarded, text } from './result.js'

const BUDGET_DESCRIPTION = `Show how much this agent has spent today, its daily and per-payment limits, and whether the owner has paused payments.
Use it before a payment to see if it can fit and which chains you can pay on, and after an error whose outcome is unclear. The limits are set by the owner; a payment within them can still be rejected or need approval.`

const INTENT_DESCRIPTION = `Check the current status of a payment by its intent id (from paid_fetch or transfer).
Use it to poll a payment that is pending_approval, every 15 to 30 seconds, until its status changes. Tell the user the outcome.
For a paid_fetch payment, "approved" means the owner said yes: call paid_fetch again with exactly the same request to receive the response.`

export function registerStatusTools(server: McpServer, { guard, log }: ToolDeps): void {
  server.registerTool(
    'get_budget',
    {
      title: 'Get budget',
      description: BUDGET_DESCRIPTION,
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => guarded(log, async () => text(describeBudget(await guard.budget()))),
  )

  server.registerTool(
    'check_intent',
    {
      title: 'Check payment',
      description: INTENT_DESCRIPTION,
      inputSchema: {
        intentId: z.uuid().describe('The intent id returned by paid_fetch or transfer.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    ({ intentId }) =>
      guarded(log, async () => {
        const intent = await guard.intent(intentId)
        const receipt = intent.status === 'executed' && (await receiptExists(intentId))
        return text(describeIntent(intent, receipt))
      }),
  )

  /** A receipt is a footnote: if guard-core cannot say, the intent's own outcome still stands. */
  async function receiptExists(intentId: string): Promise<boolean> {
    try {
      return await guard.hasReceipt(intentId)
    } catch (error) {
      log.warn({ err: error }, 'could not check for a receipt')
      return false
    }
  }
}

function describeBudget(budget: Budget): string {
  const lines = [
    budget.paused
      ? 'Payments are PAUSED by the owner. Every payment will be rejected until they resume them.'
      : 'Payments are active.',
    `Spent today: ${formatAmount(budget.spentToday)} of ${formatAmount(budget.dailyMax)} (daily limit, resets at 00:00 UTC).`,
    `Per-payment limit: ${formatAmount(budget.perTxMax)}.`,
  ]
  if (budget.shadowSpentToday !== undefined && budget.shadowSpentToday !== '0') {
    lines.push(
      `Shadow mode would have spent ${formatAmount(budget.shadowSpentToday)} today. Nothing of that was paid.`,
    )
  }
  if (budget.mandates !== undefined) {
    lines.push(
      budget.mandates.length === 0
        ? 'Open task budgets: none. Open one with start_task before a task that needs payments.'
        : 'Open task budgets:',
      ...budget.mandates
        .slice(0, 20)
        .map(
          (mandate) =>
            `- ${mandate.id}: ${formatAmount(mandate.spent)} of ${formatAmount(mandate.budget)} spent, for ${listOf(mandate.domains, 5)}, expires ${mandate.expiresAt}.`,
        ),
    )
  }
  if (budget.chains !== undefined) {
    lines.push(
      budget.chains.length === 0
        ? 'Chains you can pay on: none. Every payment will be rejected.'
        : `Chains you can pay on: ${budget.chains.map((chain) => `${chainName(chain)} (${chain})`).join(', ')}.`,
    )
  }
  const balances = Object.entries(budget.hotWalletBalances)
  if (balances.length > 0) {
    lines.push(
      'Hot wallet balances:',
      ...balances.map(
        ([chain, amount]) =>
          `- ${chainName(chain)} (${chain}): ${formatAmount(amount)} ${usdSymbolFor(chain)}`,
      ),
    )
  }
  return lines.join('\n')
}

function describeIntent(intent: Intent, receipt: boolean): string {
  const target =
    intent.kind === 'x402'
      ? `x402 payment to ${intent.domain ?? intent.recipient}`
      : `transfer to ${intent.recipient}`
  const lines = [
    `Intent ${intent.id}: ${intent.status}.`,
    `${formatAmount(intent.amount)} ${usdSymbolFor(intent.chain)}, ${target}, on ${chainName(intent.chain)} (${intent.chain}).`,
    `Created ${intent.createdAt}, expires ${intent.expiresAt}.`,
  ]
  if (intent.txId !== undefined) {
    lines.push(`Transaction id: ${intent.txId}`)
  }
  lines.push(explainStatus(intent.status, intent.rejectReasons, intent.kind))
  if (receipt) {
    lines.push(
      `AgentGuard holds a signed receipt for this payment (intent ${intent.id}). It is for the owner's records; you do not need it.`,
    )
  }
  return lines.join('\n')
}
