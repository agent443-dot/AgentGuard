import type { PayIntent } from '@agentguard/shared'
import { type AttackCode, attackCodesIn } from './codes.js'
import { attackText, executedText, heldBackText } from './text.js'

/** After an attack alert, the same agent and code stay quiet this long and are only counted. */
export const ATTACK_WINDOW_MS = 5 * 60_000

interface Window {
  agentId: string
  code: AttackCode
  opened: number
  repeats: number
}

/**
 * Decides which events become messages. An attacker can make an agent send malicious payments in a
 * loop, and every one is rejected with an attack code: alerting on each would bury the owner's chat,
 * including the approval requests in it. So the first alert per agent and code goes out at once and
 * the rest of its window is summed into one message when the window closes. Large payments are not
 * throttled: each one moved real money.
 */
export class Alerts {
  readonly #windows = new Map<string, Window>()

  readonly #notifyAbove: bigint

  constructor(notifyAbove: bigint) {
    this.#notifyAbove = notifyAbove
  }

  for(intent: PayIntent, now: Date): string[] {
    // A window that ran out between timer ticks is reported before a new one replaces it.
    const alerts = this.flush(now)
    if (intent.status === 'executed' && BigInt(intent.amount) >= this.#notifyAbove) {
      alerts.push(executedText(intent))
    }
    const fresh = attackCodesIn(intent.rejectReasons).filter((code) =>
      this.#open(intent.agentId, code, now),
    )
    if (fresh.length > 0) {
      alerts.push(attackText(intent, fresh))
    }
    return alerts
  }

  /** Runs on a timer, so repeats are reported even after the attack stops. */
  flush(now: Date): string[] {
    const summaries: string[] = []
    for (const [key, window] of this.#windows) {
      if (now.getTime() - window.opened >= ATTACK_WINDOW_MS) {
        this.#windows.delete(key)
        if (window.repeats > 0) {
          summaries.push(heldBackText(window.agentId, window.code, window.repeats, window.opened))
        }
      }
    }
    return summaries
  }

  /** True when this agent and code have no open window: the alert goes out and opens one. */
  #open(agentId: string, code: AttackCode, now: Date): boolean {
    const key = `${agentId}\u0000${code}`
    const window = this.#windows.get(key)
    if (window !== undefined && now.getTime() - window.opened < ATTACK_WINDOW_MS) {
      window.repeats += 1
      return false
    }
    this.#windows.set(key, { agentId, code, opened: now.getTime(), repeats: 0 })
    return true
  }
}
