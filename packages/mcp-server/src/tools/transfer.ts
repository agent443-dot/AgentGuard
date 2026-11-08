import { CHAINS } from '@agentguard/shared'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CHAIN_NAMES, chainName } from '../domain/chains.js'
import { explainStatus } from '../domain/explain.js'
import { formatUsd, parseUsd } from '../domain/usd.js'
import type { ToolDeps } from './deps.js'
import { failure, guarded, text } from './result.js'

const DESCRIPTION = `Send dollars from the agent's wallet to an address, through AgentGuard. The token is the chain's dollar stablecoin: USDC, or USDG on Robinhood Chain.
Amounts are in USD; one token is one dollar.
AgentGuard checks every transfer against the owner's policy. A transfer may be rejected (for example, a recipient that is not on the allowed list), or may need the owner to approve it on Telegram first.
- If the result says pending_approval: tell the user the transfer is waiting for their approval, then poll check_intent with the intent id. Do not send the same transfer again while it is pending.
- If it was rejected: explain the reasons to the user. Do not retry the same transfer.
The reason you give is shown to the owner. Describe the purpose truthfully.`

const inputSchema = {
  to: z.string().min(1).max(128).describe('Recipient address on the chosen chain.'),
  amountUsd: z
    .string()
    .describe('Amount in USD as a decimal string with at most 6 decimal places, like "2.50".'),
  reason: z.string().min(1).max(500).describe('Why this payment is needed. Shown to the owner.'),
  chain: z
    .enum(Object.values(CHAINS))
    .optional()
    .describe(
      `CAIP-2 chain id: ${Object.entries(CHAIN_NAMES)
        .map(([id, name]) => `${id} (${name})`)
        .join(', ')}. Leave empty to use the configured default chain.`,
    ),
}

export function registerTransfer(
  server: McpServer,
  { guard, log, defaultChain, usd }: ToolDeps,
): void {
  server.registerTool(
    'transfer',
    {
      title: 'Transfer dollars',
      description: DESCRIPTION,
      inputSchema,
      annotations: { openWorldHint: true },
    },
    async ({ to, amountUsd, reason, chain = defaultChain }) => {
      const amount = parseUsd(amountUsd)
      if (!amount.ok) {
        return failure(`amountUsd: ${amount.error}`)
      }
      if (amount.atomic === 0n) {
        return failure('amountUsd: a transfer must be more than zero.')
      }
      const token = usd(chain)
      if (token === undefined) {
        return failure(
          `This server has no dollar token for ${chainName(chain)} (${chain}), so transfers there are not possible. The owner has to configure it.`,
        )
      }
      return guarded(log, async () => {
        const result = await guard.transfer({
          chain,
          token: token.address,
          amount: amount.atomic.toString(),
          recipient: to,
          reason,
        })
        const lines = [
          `Transfer of ${formatUsd(amount.atomic)} ${token.symbol} to ${to} on ${chainName(chain)} (${chain}): ${result.status}.`,
          `Intent id: ${result.intentId}`,
        ]
        if (result.txId !== undefined) {
          lines.push(`Transaction id: ${result.txId}`)
        }
        lines.push(explainStatus(result.status, result.rejectReasons, 'transfer'))
        return text(lines.join('\n'))
      })
    },
  )
}
