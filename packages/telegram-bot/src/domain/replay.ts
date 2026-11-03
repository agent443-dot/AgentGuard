import type { ApprovalRequest } from '@agentguard/shared'
import { APPROVAL_TTL_MS } from '@agentguard/shared'

export type Admission = 'accepted' | 'stale' | 'duplicate'

export interface MessageRef {
  chatId: number
  messageId: number
}

export interface Pending {
  request: ApprovalRequest
  deadline: number
  messages: MessageRef[]
  open: boolean
}

/** Tolerated disagreement between guard-core's clock and ours. */
export const CLOCK_SKEW_MS = 60_000

/** How long an intent event stays valid after guard-core sent it. */
export const EVENT_WINDOW_MS = 5 * 60_000

/**
 * Approval requests the bot has posted, keyed by intent id. The signature proves guard-core wrote a
 * body, not that it is sending it now, so a captured request is refused once its window has passed
 * (stale) and while it is still open (duplicate). An entry is dropped only after its deadline, when
 * the stale check alone covers it.
 */
export class ApprovalBook {
  readonly #entries = new Map<string, Pending>()

  admit(request: ApprovalRequest, now: Date): Admission {
    this.#prune(now)
    const deadline = Date.parse(request.approveBefore)
    const left = deadline - now.getTime()
    // Further out than guard-core ever sets is not a request guard-core made.
    if (Number.isNaN(deadline) || left <= 0 || left > APPROVAL_TTL_MS + CLOCK_SKEW_MS) {
      return 'stale'
    }
    if (this.#entries.has(request.intent.id)) {
      return 'duplicate'
    }
    this.#entries.set(request.intent.id, { request, deadline, messages: [], open: true })
    return 'accepted'
  }

  /** For a request that never reached anyone: guard-core may send it again. */
  forget(intentId: string): void {
    this.#entries.delete(intentId)
  }

  get(intentId: string): Pending | undefined {
    return this.#entries.get(intentId)
  }

  /** Returns the entry only to the first caller, so two owners pressing at once edit once. */
  close(intentId: string): Pending | undefined {
    const entry = this.#entries.get(intentId)
    if (!entry?.open) {
      return undefined
    }
    entry.open = false
    return entry
  }

  open(): Pending[] {
    return [...this.#entries.values()].filter((entry) => entry.open)
  }

  closeExpired(now: Date): Pending[] {
    const expired = this.open().filter((entry) => entry.deadline <= now.getTime())
    for (const entry of expired) {
      entry.open = false
    }
    this.#prune(now)
    return expired
  }

  #prune(now: Date): void {
    for (const [id, entry] of this.#entries) {
      if (!entry.open && entry.deadline <= now.getTime()) {
        this.#entries.delete(id)
      }
    }
  }
}

/** Replay protection for intent events, which carry their send time instead of a deadline. */
export class EventLog {
  readonly #seen = new Map<string, number>()

  admit(key: string, sentAt: string, now: Date): Admission {
    for (const [seenKey, at] of this.#seen) {
      if (now.getTime() - at > EVENT_WINDOW_MS) {
        this.#seen.delete(seenKey)
      }
    }
    const at = Date.parse(sentAt)
    const age = now.getTime() - at
    if (Number.isNaN(at) || age > EVENT_WINDOW_MS || age < -CLOCK_SKEW_MS) {
      return 'stale'
    }
    if (this.#seen.has(key)) {
      return 'duplicate'
    }
    this.#seen.set(key, at)
    return 'accepted'
  }
}
