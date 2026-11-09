import type { PayIntent } from '@agentguard/shared'
import { pin } from '../db/pins.js'
import { recordOwnerApproval } from '../db/receipts.js'
import type { PaymentDeps } from './payments.js'
import { sendApproved } from './transfer.js'

/**
 * What follows the owner's approval, by Telegram tap or by passkey. A transfer carries everything
 * needed to send it, so it goes now. An x402 payment waits for the agent to repeat the request,
 * because only that request can receive the response; its approval also re-pins the domain, so
 * the repeat and the payments after it are not asked about again.
 */
export async function afterApproval(
  deps: PaymentDeps,
  intent: PayIntent,
  method: 'owner' | 'passkey',
): Promise<PayIntent> {
  recordOwnerApproval(deps.db, intent.id, method)
  if (intent.kind === 'x402') {
    pin(deps.db, intent, deps.now())
    return intent
  }
  return (await sendApproved(deps, intent.id)) ?? intent
}
