import type { PayIntent } from '@agentguard/shared'
import type { PaymentDeps } from './payments.js'

// About 21 seconds in all: enough to ride out a bot restart, short enough that the alert still
// means something when it lands. The bot deduplicates on intent id and status, so a retry after a
// send that actually arrived costs nothing.
const RETRY_MS = [1_000, 4_000, 16_000]

/**
 * Tells the bot an intent reached a final state (CR-004); the bot decides what the owner sees.
 * Never awaited: a bot that is down must not hold up or fail a payment that already happened.
 */
export function notify(deps: Pick<PaymentDeps, 'bot' | 'now' | 'log'>, intent: PayIntent): void {
  void deliver(deps, intent)
}

async function deliver(deps: Pick<PaymentDeps, 'bot' | 'now' | 'log'>, intent: PayIntent) {
  for (let attempt = 0; ; attempt++) {
    try {
      // Stamped per attempt: the bot refuses events older than five minutes.
      await deps.bot.intentEvent({ intent, sentAt: deps.now().toISOString() })
      return
    } catch (error) {
      const wait = RETRY_MS[attempt]
      if (wait === undefined) {
        deps.log.error(
          { err: error, intentId: intent.id, status: intent.status, attempts: attempt + 1 },
          'intent event given up',
        )
        return
      }
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}
