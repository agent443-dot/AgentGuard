import type { ApprovalRequest } from '@agentguard/shared'
import { APPROVAL_TTL_MS } from '@agentguard/shared'

/** Anything the owner approves within a window guard-core sets. */
interface Approvable {
  approveBefore: string
}

export type Admission = 'accepted' | 'stale' | 'duplicate'

export interface MessageRef {
  chatId: number
  messageId: number
}

export interface Pending<R extends Approvable = ApprovalRequest> {
  request: R
  deadline: number
  messages: MessageRef[]
  open: boolean
}

/** Tolerated disagreement between guard-core's clock and ours. */
export const CLOCK_SKEW_MS = 60_000

/** How long an intent event stays valid after guard-core sent it. */
export const EVENT_WINDOW_MS = 5 * 60_000

/**
 * Approval requests the bot has posted, keyed by intent id (or mandate id). The signature proves guard-core wrote a
 * body, not that it is sending it now, so a captured request is refused once its window has passed
 * (stale) and while it is still open (duplicate). An entry is dropped only after its deadline, when
 * the stale check alone covers it.
 */
export class ApprovalBook<R extends Approvable = ApprovalRequest> {
  readonly #entries = new Map<string, Pending<R>>()
  readonly #key: (request: R) => string

  constructor(key: (request: R) => string) {
    this.#key = key
  }

  admit(request: R, now: Date): Admission {
    this.#prune(now)
    const deadline = Date.parse(request.approveBefore)
    const left = deadline - now.getTime()
    // Further out than guard-core ever sets is not a request guard-core made.
    if (Number.isNaN(deadline) || left <= 0 || left > APPROVAL_TTL_MS + CLOCK_SKEW_MS) {
      return 'stale'
    }
    const id = this.#key(request)
    if (this.#entries.has(id)) {
      return 'duplicate'
    }
    this.#entries.set(id, { request, deadline, messages: [], open: true })
    return 'accepted'
  }

  /** For a request that never reached anyone: guard-core may send it again. */
  forget(id: string): void {
    this.#entries.delete(id)
  }

  get(id: string): Pending<R> | undefined {
    return this.#entries.get(id)
  }

  /** Returns the entry only to the first caller, so two owners pressing at once edit once. */
  close(id: string): Pending<R> | undefined {
    const entry = this.#entries.get(id)
    if (!entry?.open) {
      return undefined
    }
    entry.open = false
    return entry
  }

  open(): Pending<R>[] {
    return [...this.#entries.values()].filter((entry) => entry.open)
  }

  closeExpired(now: Date): Pending<R>[] {
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

export const intentBook = () => new ApprovalBook<ApprovalRequest>((request) => request.intent.id)

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
