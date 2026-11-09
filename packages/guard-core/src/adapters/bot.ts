import type {
  Address,
  AlertEvent,
  Amount,
  ApprovalFlag,
  ApprovalRequest,
  IntentEvent,
} from '@agentguard/shared'
import type { Config } from '../config.js'
import { signWebhook } from '../domain/auth.js'

/**
 * The approval-request body: why it goes to the owner even below the threshold, and whether it can
 * be approved only with a passkey. Shared's ApprovalRequest does not carry these two fields yet, so
 * they are optional here; requestApproval always sends both.
 */
export type ApprovalRequestBody = ApprovalRequest & {
  flags?: ApprovalFlag[]
  passkey?: boolean
  /** The domain's last executed payment, sent with any flag so the owner can compare. */
  pinned?: { recipient: Address; amount: Amount }
}

export interface BotNotifier {
  requestApproval(request: ApprovalRequestBody): Promise<void>
  intentEvent(event: IntentEvent): Promise<void>
  alert(event: AlertEvent): Promise<void>
}

export function httpBotNotifier(config: Config, fetchImpl: typeof fetch = fetch): BotNotifier {
  async function post(path: string, payload: ApprovalRequestBody | IntentEvent | AlertEvent) {
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
