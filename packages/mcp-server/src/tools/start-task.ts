import type { Mandate } from '@agentguard/shared'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { formatAmount, formatUsd, parseUsd } from '../domain/usd.js'
import type { ToolDeps } from './deps.js'
import { failure, guarded, text } from './result.js'

const DESCRIPTION = `Open a task budget before a task that will need payments: a dollar amount the task may spend, the websites it may pay, and how long it lasts.
Open one budget per task, not one per payment, and pass its mandateId to every paid_fetch and transfer for that task. Payments must also fit the owner's policy; a budget never raises it.
A large budget may need the owner's approval first: if the result says pending_approval, tell the user, then call get_budget until the budget is listed as open. Do not pay with it before then.`

/** A day: long enough for one task, short enough that a forgotten budget does not linger. */
const MAX_MINUTES = 24 * 60

const hostname = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[a-z0-9.-]+$/i, 'expected a bare hostname, like api.example.com')

const inputSchema = {
  budgetUsd: z
    .string()
    .describe('Most the whole task may spend, in USD, as a decimal string like "5.00".'),
  domains: z
    .array(hostname)
    .min(1)
    .max(32)
    .describe('Hostnames the task may pay through paid_fetch, like ["api.example.com"].'),
  minutes: z
    .number()
    .int()
    .min(1)
    .max(MAX_MINUTES)
    .describe(`How long the budget stays open, in minutes, at most ${MAX_MINUTES}.`),
  reason: z.string().min(1).max(500).describe('What the task is. Shown to the owner.'),
}

export function registerStartTask(server: McpServer, { guard, log }: ToolDeps): void {
  server.registerTool(
    'start_task',
    {
      title: 'Start a task budget',
      description: DESCRIPTION,
      inputSchema,
      annotations: { openWorldHint: false },
    },
    async ({ budgetUsd, domains, minutes, reason }) => {
      const budget = parseUsd(budgetUsd)
      if (!budget.ok) {
        return failure(`budgetUsd: ${budget.error}`)
      }
      if (budget.atomic === 0n) {
        return failure('budgetUsd: a task budget must be more than zero.')
      }
      return guarded(log, async () => {
        const mandate = await guard.startTask({
          budget: budget.atomic.toString(),
          domains,
          ttlSeconds: minutes * 60,
          reason,
        })
        return text(describeMandate(mandate, formatUsd(budget.atomic)))
      })
    },
  )
}

const NEXT_STEP: Record<Mandate['status'], string> = {
  active: 'Pass this mandateId to every paid_fetch and transfer for this task.',
  pending_approval:
    'The owner must approve this budget on Telegram first. Tell the user, then call get_budget ' +
    'until it is listed as open. Do not pay with it before then.',
  exhausted: 'This budget is already spent. Open a new one only if the user asks for more.',
  expired: 'This budget has expired. Open a new one for the remaining work.',
  revoked: 'The owner closed this budget. Stop the task and tell the user.',
}

function describeMandate(mandate: Mandate, asked: string): string {
  return [
    `Task budget ${mandate.id}: ${mandate.status}.`,
    `mandateId: ${mandate.id}`,
    `Budget: ${formatAmount(mandate.budget)} (asked for ${asked}), for ${listOf(mandate.domains)}.`,
    `Expires ${mandate.expiresAt}.`,
    NEXT_STEP[mandate.status],
  ].join('\n')
}

/** guard-core's echo of agent-supplied values is still shown bounded, never in full. */
export function listOf(values: readonly string[], max = 10): string {
  const shown = values.slice(0, max).map((value) => value.slice(0, 253))
  const more = values.length > max ? ` and ${values.length - max} more` : ''
  return shown.length === 0 ? 'no websites' : `${shown.join(', ')}${more}`
}
