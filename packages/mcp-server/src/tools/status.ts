import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Budget, Intent } from '../adapters/guard.js'
import { explainStatus } from '../domain/explain.js'
import { formatAmount } from '../domain/usd.js'
import type { ToolDeps } from './deps.js'
import { guarded, text } from './result.js'

const BUDGET_DESCRIPTION = `Show how much this agent has spent today, its daily and per-payment limits, and whether the owner has paused payments.
Use it before a payment to see if it can fit, and after an error whose outcome is unclear. The limits are set by the owner; a payment within them can still be rejected or need approval.`

const INTENT_DESCRIPTION = `Check the current status of a payment by its intent id (from paid_fetch or transfer).
Use it to poll a payment that is pending_approval, every 15 to 30 seconds, until it is executed, rejected, failed or expired. Tell the user the outcome.`

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
    ({ intentId }) => guarded(log, async () => text(describeIntent(await guard.intent(intentId)))),
  )
}

function describeBudget(budget: Budget): string {
  const lines = [
    budget.paused
      ? 'Payments are PAUSED by the owner. Every payment will be rejected until they resume them.'
      : 'Payments are active.',
    `Spent today: ${formatAmount(budget.spentToday)} of ${formatAmount(budget.dailyMax)} (daily limit, resets at 00:00 UTC).`,
    `Per-payment limit: ${formatAmount(budget.perTxMax)}.`,
  ]
  const balances = Object.entries(budget.hotWalletBalances)
  if (balances.length > 0) {
    lines.push(
      'Hot wallet balances:',
      ...balances.map(([chain, amount]) => `- ${chain}: ${formatAmount(amount)}`),
    )
  }
  return lines.join('\n')
}

function describeIntent(intent: Intent): string {
  const target =
    intent.kind === 'x402'
      ? `x402 payment to ${intent.domain ?? intent.recipient}`
      : `transfer to ${intent.recipient}`
  const lines = [
    `Intent ${intent.id}: ${intent.status}.`,
    `${formatAmount(intent.amount)} USDC, ${target}, on ${intent.chain}.`,
    `Created ${intent.createdAt}, expires ${intent.expiresAt}.`,
  ]
  if (intent.txId !== undefined) {
    lines.push(`Transaction id: ${intent.txId}`)
  }
  lines.push(explainStatus(intent.status, intent.rejectReasons))
  return lines.join('\n')
}
