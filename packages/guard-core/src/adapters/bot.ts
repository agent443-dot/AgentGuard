import type { ApprovalRequest, PayIntent } from '@agentguard/shared'
import type { Config } from '../config.js'
import { signWebhook } from '../domain/auth.js'

/** Body of POST {BOT_URL}/hooks/intent-event (CR-004). `sentAt` lets the bot refuse replays. */
export interface IntentEvent {
  intent: PayIntent
  sentAt: string
}

export interface BotNotifier {
  requestApproval(request: ApprovalRequest): Promise<void>
  intentEvent(event: IntentEvent): Promise<void>
}

export function httpBotNotifier(config: Config, fetchImpl: typeof fetch = fetch): BotNotifier {
  async function post(path: string, payload: ApprovalRequest | IntentEvent) {
    // Signed over the exact bytes sent: re-serialising on either side would change the signature.
    const body = JSON.stringify(payload)
    const response = await fetchImpl(`${config.BOT_URL}/hooks/${path}`, {
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
  }

  return {
    requestApproval: (request) => post('approval-request', request),
    intentEvent: (event) => post('intent-event', event),
  }
}
