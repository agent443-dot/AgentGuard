import type { ApprovalRequest } from '@agentguard/shared'
import type { Config } from '../config.js'
import { signWebhook } from '../domain/auth.js'

export interface BotNotifier {
  requestApproval(request: ApprovalRequest): Promise<void>
}

export function httpBotNotifier(config: Config, fetchImpl: typeof fetch = fetch): BotNotifier {
  return {
    async requestApproval(request) {
      // Signed over the exact bytes sent: re-serialising on either side would change the signature.
      const body = JSON.stringify(request)
      const response = await fetchImpl(`${config.BOT_URL}/hooks/approval-request`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-guard-signature': signWebhook(body, config.BOT_WEBHOOK_SECRET),
        },
        body,
      })
      if (!response.ok) {
        throw new Error(`bot_webhook_failed: ${response.status}`)
      }
    },
  }
}
