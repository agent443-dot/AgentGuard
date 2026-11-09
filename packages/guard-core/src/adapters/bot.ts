import type {
  AlertEvent,
  ApprovalRequest,
  IntentEvent,
  MandateApprovalRequest,
} from '@agentguard/shared'
import type { Config } from '../config.js'
import { signWebhook } from '../domain/auth.js'

/**
 * What the owner must hear about at once. Shared's AlertEvent gains `passkey_enrolled` in the next
 * SPEC; until then guard-core adds it here.
 */
export type GuardAlert = AlertEvent | { kind: 'passkey_enrolled'; detail: string; sentAt: string }

export interface BotNotifier {
  /** A payment, or a mandate, for the owner to decide; both go to the same hook. */
  requestApproval(request: ApprovalRequest | MandateApprovalRequest): Promise<void>
  intentEvent(event: IntentEvent): Promise<void>
  alert(event: GuardAlert): Promise<void>
}

export function httpBotNotifier(config: Config, fetchImpl: typeof fetch = fetch): BotNotifier {
  async function post(
    path: string,
    payload: ApprovalRequest | MandateApprovalRequest | IntentEvent | GuardAlert,
  ) {
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
    alert: (event) => post('alert', event),
  }
}
