import type { AlertEvent, IntentEvent } from '@agentguard/shared'
import type { Api, InlineKeyboard } from 'grammy'
import type { Logger } from 'pino'
import type { Decision, GuardClient, Settled } from '../adapters/guard.js'
import { Alerts } from '../domain/alerts.js'
import { mandateSettledText, mandateText } from '../domain/mandate.js'
import { breakerText } from '../domain/notices.js'
import {
  type Admission,
  ApprovalBook,
  EventLog,
  intentBook,
  type MessageRef,
} from '../domain/replay.js'
import {
  approvalText,
  type FlaggedRequest,
  type Outcome,
  settledFallback,
  settledText,
} from '../domain/text.js'
import type { MandateRequest, ShadowedEvent } from '../http/schemas.js'
import { approvalKeyboard, mandateKeyboard } from './keyboards.js'

export interface DeskDeps {
  api: Api
  owners: ReadonlySet<number>
  guard: GuardClient
  notifyAbove: bigint
  log: Logger
  now?: () => Date
  /** Where owners open guard-core's passkey page; without it a passkey request has no approve link. */
  guardPublicUrl?: string
}

export interface Owner {
  id: number
  first_name: string
  username?: string
}

export type PostResult = Admission | 'undelivered'

type Pressed = MessageRef & { text: string }

const HTML = { parse_mode: 'HTML' } as const

const ANSWERS: Record<Outcome['kind'], string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Too late: this request expired. Nothing was paid.',
  already_decided: 'Already decided.',
  not_found: 'guard-core does not know this request.',
}

/** One kind of thing the owner approves: a payment, or a task budget. */
interface Counter<R extends { approveBefore: string }> {
  book: ApprovalBook<R>
  id(request: R): string
  post(request: R): [string, InlineKeyboard]
  settled(request: R, outcome: Outcome): string
  decide(id: string, decision: Decision, owner: number): Promise<Settled>
}

/** Everything that puts a message in front of the owners or takes one away. */
export class Desk {
  readonly book = intentBook()
  readonly #mandates = new ApprovalBook<MandateRequest>((request) => request.mandate.id)
  readonly #events = new EventLog()
  readonly #alerts: Alerts
  readonly #deps: DeskDeps
  readonly #now: () => Date

  constructor(deps: DeskDeps) {
    this.#deps = deps
    this.#now = deps.now ?? (() => new Date())
    this.#alerts = new Alerts(deps.notifyAbove)
  }

  readonly #payments: Counter<FlaggedRequest> = {
    book: this.book,
    id: (request) => request.intent.id,
    post: (request) => {
      const id = request.intent.id
      const page = request.passkey === true ? this.#passkeyPage(id) : undefined
      return [approvalText(request, page !== null), approvalKeyboard(id, page)]
    },
    settled: settledText,
    decide: (id, decision, owner) => this.#deps.guard.decide(id, decision, owner),
  }

  readonly #tasks: Counter<MandateRequest> = {
    book: this.#mandates,
    id: (request) => request.mandate.id,
    post: (request) => [mandateText(request), mandateKeyboard(request.mandate.id)],
    settled: mandateSettledText,
    decide: (id, decision, owner) => this.#deps.guard.decideMandate(id, decision, owner),
  }

  pendingTasks(): number {
    return this.#mandates.open().length
  }

  async post(request: FlaggedRequest | MandateRequest): Promise<PostResult> {
    return 'mandate' in request
      ? this.#post(this.#tasks, request)
      : this.#post(this.#payments, request)
  }

  /** Returns the short text shown to the owner who pressed the button. */
  async decide(intentId: string, decision: Decision, owner: Owner, pressed: Pressed) {
    // guard-core refuses it too; an old or forged Approve button should not even ask.
    if (decision === 'approve' && this.book.get(intentId)?.request.passkey === true) {
      return 'This one needs your passkey: use Approve with passkey.'
    }
    return this.#decide(this.#payments, intentId, decision, owner, pressed)
  }

  async decideMandate(mandateId: string, decision: Decision, owner: Owner, pressed: Pressed) {
    return this.#decide(this.#tasks, mandateId, decision, owner, pressed)
  }

  async #post<R extends { approveBefore: string }>(counter: Counter<R>, request: R) {
    const admission = counter.book.admit(request, this.#now())
    if (admission !== 'accepted') {
      return admission
    }
    const id = counter.id(request)
    const sent = await this.#broadcast(...counter.post(request))
    if (sent.length === 0) {
      counter.book.forget(id)
      return 'undelivered'
    }
    counter.book.get(id)?.messages.push(...sent)
    return 'accepted'
  }

  async #decide<R extends { approveBefore: string }>(
    counter: Counter<R>,
    id: string,
    decision: Decision,
    owner: Owner,
    pressed: Pressed,
  ): Promise<string> {
    let outcome: Outcome
    try {
      const result = await counter.decide(id, decision, owner.id)
      outcome = result.ok
        ? {
            kind: decision === 'approve' ? 'approved' : 'rejected',
            by: nameOf(owner),
            at: this.#now(),
          }
        : { kind: result.reason }
    } catch (err) {
      this.#deps.log.error({ err, id }, 'decision call failed')
      return 'guard-core did not answer. Nothing was decided: try again.'
    }
    this.#deps.log.info({ id, outcome: outcome.kind, owner: owner.id }, 'owner decision')
    await this.#settle(counter, id, outcome, pressed)
    return ANSWERS[outcome.kind]
  }

  recipient(intentId: string): string {
    return this.book.get(intentId)?.request.intent.recipient ?? 'This request is no longer held.'
  }

  /** Runs on a timer: an unanswered request must not keep live buttons past its deadline. */
  async expire(): Promise<void> {
    await this.#expire(this.#payments)
    await this.#expire(this.#tasks)
  }

  async #expire<R extends { approveBefore: string }>(counter: Counter<R>) {
    for (const entry of counter.book.closeExpired(this.#now())) {
      await this.#edit(entry.messages, counter.settled(entry.request, { kind: 'expired' }))
    }
  }

  /** Runs on the same timer: reports attack alerts that were held back. */
  async flushAlerts(): Promise<void> {
    for (const summary of this.#alerts.flush(this.#now())) {
      await this.#broadcast(summary)
    }
  }

  async event({ intent, sentAt }: IntentEvent | ShadowedEvent): Promise<Admission> {
    const admission = this.#events.admit(`${intent.id}:${intent.status}`, sentAt, this.#now())
    // Shadow mode signs nothing: guard-core sums what it would have spent, the chat stays quiet.
    if (admission === 'accepted' && intent.status !== 'shadowed') {
      await this.#settledElsewhere(intent)
      for (const alert of this.#alerts.for(intent, this.#now())) {
        await this.#broadcast(alert)
      }
    }
    return admission
  }

  /**
   * A request still open here was decided without a Telegram press: on the passkey page, or by
   * guard-core itself. Its messages take the real outcome instead of later reading "expired".
   */
  async #settledElsewhere(intent: IntentEvent['intent']) {
    const entry = this.book.get(intent.id)
    if (entry === undefined || this.book.close(intent.id) === undefined) {
      return
    }
    const outcome: Outcome =
      intent.status === 'expired'
        ? { kind: 'expired' }
        : intent.status === 'rejected'
          ? { kind: 'rejected', by: 'guard-core', at: this.#now() }
          : { kind: 'approved', by: 'passkey', at: this.#now() }
    await this.#edit(entry.messages, settledText(entry.request, outcome))
  }

  /** Null when the bot was not told where guard-core's public page is. */
  #passkeyPage(intentId: string): string | null {
    const base = this.#deps.guardPublicUrl
    return base === undefined
      ? null
      : `${base.replace(/\/+$/, '')}/owner/approve/${encodeURIComponent(intentId)}`
  }

  /** A message for every owner that needs no answer; resolves to how many it reached. */
  async announce(text: string, keyboard?: InlineKeyboard): Promise<number> {
    return (await this.#broadcast(text, keyboard)).length
  }

  /** A tripped breaker has already paused the agent; the owner only needs to know and look. */
  async alert(event: AlertEvent) {
    const key = `${event.kind}:${event.agentId}:${event.sentAt}`
    const admission = this.#events.admit(key, event.sentAt, this.#now())
    if (admission !== 'accepted') {
      return admission
    }
    const sent = await this.#broadcast(breakerText(event.agentId, event.detail))
    return sent.length > 0 ? admission : 'undelivered'
  }

  async #settle<R extends { approveBefore: string }>(
    counter: Counter<R>,
    id: string,
    outcome: Outcome,
    pressed: Pressed,
  ) {
    const entry = counter.book.get(id)
    if (entry === undefined) {
      // Posted before a restart: only the pressed message is known, and only as plain text.
      await this.#edit([pressed], settledFallback(pressed.text, outcome))
      return
    }
    // A second owner's press has nothing left to edit: the first one already did it for everyone.
    if (counter.book.close(id) !== undefined) {
      await this.#edit(entry.messages, counter.settled(entry.request, outcome))
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
