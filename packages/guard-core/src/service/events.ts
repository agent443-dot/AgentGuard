import type { AlertEvent, PayIntent } from '@agentguard/shared'
import type { PaymentDeps } from './payments.js'

// About 21 seconds in all: enough to ride out a bot restart, short enough that the alert still
// means something when it lands. The bot deduplicates on intent id and status, so a retry after a
// send that actually arrived costs nothing.
const RETRY_MS = [1_000, 4_000, 16_000]

/**
 * Tells the bot an intent reached a final state (CR-004); the bot decides what the owner sees.
 * Never awaited: a bot that is down must not hold up or fail a payment that already happened.
 */
export function notify(deps: Deps, intent: PayIntent): void {
  void deliver(
    deps,
    // Stamped per attempt: the bot refuses events older than five minutes.
    () => deps.bot.intentEvent({ intent, sentAt: deps.now().toISOString() }),
    { intentId: intent.id, status: intent.status },
  )
}

/** An alert as the caller builds it; the time is stamped per attempt. */
export type AlertBody = AlertEvent extends infer A
  ? A extends AlertEvent
    ? Omit<A, 'sentAt'>
    : never
  : never

/**
 * Tells the bot something the owner must act on now, such as a tripped breaker or a new passkey.
 * Never awaited.
 */
export function alert(deps: Deps, event: AlertBody): void {
  void deliver(
    deps,
    () => deps.bot.alert({ ...event, sentAt: deps.now().toISOString() } as AlertEvent),
    'agentId' in event ? { kind: event.kind, agentId: event.agentId } : { kind: event.kind },
  )
}

type Deps = Pick<PaymentDeps, 'bot' | 'now' | 'log'>

async function deliver(deps: Deps, send: () => Promise<void>, about: Record<string, string>) {
  for (let attempt = 0; ; attempt++) {
    try {
      await send()
      return
    } catch (error) {
      const wait = RETRY_MS[attempt]
      if (wait === undefined) {
        deps.log.error({ err: error, ...about, attempts: attempt + 1 }, 'bot event given up')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}
