import type { ApprovalRequest, IntentEvent } from '@agentguard/shared'
import { type Api, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { Decision, GuardClient } from '../adapters/guard.js'
import { Alerts } from '../domain/alerts.js'
import { type Admission, ApprovalBook, EventLog, type MessageRef } from '../domain/replay.js'
import { approvalText, type Outcome, settledFallback, settledText } from '../domain/text.js'

export interface DeskDeps {
  api: Api
  owners: ReadonlySet<number>
  guard: GuardClient
  notifyAbove: bigint
  log: Logger
  now?: () => Date
}

export interface Owner {
  id: number
  first_name: string
  username?: string
}

export type PostResult = Admission | 'undelivered'

const HTML = { parse_mode: 'HTML' } as const

const ANSWERS: Record<Outcome['kind'], string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Too late: this request expired. Nothing was paid.',
  already_decided: 'Already decided.',
  not_found: 'guard-core does not know this intent.',
}

/** Callback data is capped at 64 bytes by Telegram; an action plus a uuid fits. */
export function approvalKeyboard(intentId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Approve', `approve:${intentId}`)
    .text('Reject', `reject:${intentId}`)
    .row()
    .text('Show full recipient', `recipient:${intentId}`)
}

/** Everything that puts a message in front of the owners or takes one away. */
export class Desk {
  readonly book = new ApprovalBook()
  readonly #events = new EventLog()
  readonly #alerts: Alerts
  readonly #deps: DeskDeps
  readonly #now: () => Date

  constructor(deps: DeskDeps) {
    this.#deps = deps
    this.#now = deps.now ?? (() => new Date())
    this.#alerts = new Alerts(deps.notifyAbove)
  }

  async post(request: ApprovalRequest): Promise<PostResult> {
    const admission = this.book.admit(request, this.#now())
    if (admission !== 'accepted') {
      return admission
    }
    const id = request.intent.id
    const sent = await this.#broadcast(approvalText(request), approvalKeyboard(id))
    if (sent.length === 0) {
      this.book.forget(id)
      return 'undelivered'
    }
    this.book.get(id)?.messages.push(...sent)
    return 'accepted'
  }

  /** Returns the short text shown to the owner who pressed the button. */
  async decide(
    intentId: string,
    decision: Decision,
    owner: Owner,
    pressed: MessageRef & { text: string },
  ): Promise<string> {
    let outcome: Outcome
    try {
      const result = await this.#deps.guard.decide(intentId, decision, owner.id)
      outcome = result.ok
        ? {
            kind: decision === 'approve' ? 'approved' : 'rejected',
            by: nameOf(owner),
            at: this.#now(),
          }
        : { kind: result.reason }
    } catch (err) {
      this.#deps.log.error({ err, intentId }, 'decision call failed')
      return 'guard-core did not answer. Nothing was decided: try again.'
    }
    this.#deps.log.info({ intentId, outcome: outcome.kind, owner: owner.id }, 'owner decision')
    await this.#settle(intentId, outcome, pressed)
    return ANSWERS[outcome.kind]
  }

  recipient(intentId: string): string {
    return this.book.get(intentId)?.request.intent.recipient ?? 'This request is no longer held.'
  }

  /** Runs on a timer: an unanswered request must not keep live buttons past its deadline. */
  async expire(): Promise<void> {
    for (const entry of this.book.closeExpired(this.#now())) {
      await this.#edit(entry.messages, settledText(entry.request, { kind: 'expired' }))
    }
  }

  /** Runs on the same timer: reports attack alerts that were held back. */
  async flushAlerts(): Promise<void> {
    for (const summary of this.#alerts.flush(this.#now())) {
      await this.#broadcast(summary)
    }
  }

  async event({ intent, sentAt }: IntentEvent): Promise<Admission> {
    const admission = this.#events.admit(`${intent.id}:${intent.status}`, sentAt, this.#now())
    if (admission === 'accepted') {
      for (const alert of this.#alerts.for(intent, this.#now())) {
        await this.#broadcast(alert)
      }
    }
    return admission
  }

  async #settle(intentId: string, outcome: Outcome, pressed: MessageRef & { text: string }) {
    const entry = this.book.get(intentId)
    if (entry === undefined) {
      // Posted before a restart: only the pressed message is known, and only as plain text.
      await this.#edit([pressed], settledFallback(pressed.text, outcome))
      return
    }
    // A second owner's press has nothing left to edit: the first one already did it for everyone.
    if (this.book.close(intentId) !== undefined) {
      await this.#edit(entry.messages, settledText(entry.request, outcome))
    }
  }

  async #broadcast(text: string, keyboard?: InlineKeyboard): Promise<MessageRef[]> {
    const options = keyboard === undefined ? HTML : { ...HTML, reply_markup: keyboard }
    const results = await Promise.allSettled(
      [...this.#deps.owners].map((chatId) => this.#deps.api.sendMessage(chatId, text, options)),
    )
    const sent: MessageRef[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        sent.push({ chatId: result.value.chat.id, messageId: result.value.message_id })
      } else {
        // An owner who never opened the bot cannot be messaged; the others still are.
        this.#deps.log.warn({ err: result.reason }, 'owner message failed')
      }
    }
    return sent
  }

  /** Editing without reply_markup is what removes the buttons. */
  async #edit(messages: MessageRef[], text: string): Promise<void> {
    const results = await Promise.allSettled(
      messages.map(({ chatId, messageId }) =>
        this.#deps.api.editMessageText(chatId, messageId, text, HTML),
      ),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        this.#deps.log.warn({ err: result.reason }, 'message edit failed')
      }
    }
  }
}

function nameOf(owner: Owner): string {
  return owner.username === undefined ? owner.first_name : `@${owner.username}`
}
