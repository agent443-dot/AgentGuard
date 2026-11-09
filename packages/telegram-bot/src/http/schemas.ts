import type { IntentEvent } from '@agentguard/shared'
import { z } from 'zod'
import { isKnownFlag, REJECT_CODES } from '../domain/codes.js'

/**
 * Bodies from guard-core. Signed, so not hostile in transport, but the strings inside started with an
 * agent and are bounded here because they end up in a Telegram message.
 */

const atomic = z.string().regex(/^(0|[1-9]\d*)$/)
const isoTime = z.iso.datetime({ offset: true })
const opaque = z.string().min(1).max(128)

export const payIntent = z.object({
  id: z.uuid(),
  agentId: z.string().min(1).max(64),
  kind: z.enum(['x402', 'transfer']),
  chain: z.string().min(3).max(64),
  token: opaque,
  amount: atomic,
  recipient: opaque,
  domain: z.string().min(1).max(253).optional(),
  reason: z.string().max(500),
  status: z.enum(['approved', 'pending_approval', 'rejected', 'executed', 'failed', 'expired']),
  rejectReasons: z.array(z.enum(REJECT_CODES)).max(32),
  txId: z.string().min(1).max(256).optional(),
  createdAt: isoTime,
  expiresAt: isoTime,
})

export const approvalRequest = z
  .object({
    intent: payIntent,
    // A guard-core older than the flags sends none, which reads as no flag. A flag this bot does not
    // know yet is still shown, generically: refusing the request would hide the payment.
    flags: z.array(z.string().min(1).max(64)).max(8).default([]),
    // The last executed payment to this domain, sent with any flag.
    pinned: z.object({ recipient: opaque, amount: atomic }).optional(),
    // Approved only on guard-core's passkey page, never by a Telegram tap.
    passkey: z.boolean().default(false),
    simulation: z.object({
      summary: z.string().max(1000),
      balanceChanges: z
        .array(z.object({ token: opaque, delta: z.string().regex(/^-?(0|[1-9]\d*)$/) }))
        .max(32),
    }),
    approveBefore: isoTime,
  })
  .transform(({ flags, ...request }) => ({
    ...request,
    flags: flags.filter(isKnownFlag),
    unknownFlags: flags.filter((flag) => !isKnownFlag(flag)),
  }))

export const mandate = z.object({
  id: z.uuid(),
  agentId: z.string().min(1).max(64),
  budget: atomic,
  spent: atomic,
  domains: z.array(z.string().min(1).max(253)).max(64),
  recipients: z.array(opaque).max(64),
  reason: z.string().max(500),
  status: z.enum(['pending_approval', 'active', 'exhausted', 'expired', 'revoked']),
  createdAt: isoTime,
  expiresAt: isoTime,
})

/** An agent asks the owner for a task budget: the same body as a payment's, with a mandate instead. */
export const mandateRequest = z.object({
  mandate,
  /** How long the budget lasts once approved; a guard-core that predates it leaves it out. */
  ttlSeconds: z.number().int().min(1).max(86_400).optional(),
  simulation: z.object({ summary: z.string().max(1000) }),
  approveBefore: isoTime,
})
export type MandateRequest = z.infer<typeof mandateRequest>

/**
 * An x402 offer guard-core refused is reported with whatever the 402 server sent: an empty chain,
 * an amount that is not atomic units, a payTo that is not even a string. Refusing the event would
 * hide the refusal from the owner, and nothing here moves money, so these fields become bounded
 * display text. A payment that settled keeps the strict shape.
 */
const offered = (max: number) =>
  z.unknown().transform((value) => (typeof value === 'string' ? value.slice(0, max) : ''))

const refusedIntent = payIntent.extend({
  status: z.enum(['rejected', 'failed', 'expired']),
  chain: offered(64),
  token: offered(128),
  amount: offered(78),
  recipient: offered(128),
})

/** A payment shadow mode evaluated and would have sent. Nothing moved, so it is never an alert. */
const shadowedIntent = payIntent.extend({ status: z.literal('shadowed') })
export type ShadowedEvent = { intent: z.infer<typeof shadowedIntent>; sentAt: string }

/** Guard-core reports intents that reached a final state. */
export const intentEvent: z.ZodType<IntentEvent | ShadowedEvent> = z.union([
  z.object({ intent: z.union([payIntent, refusedIntent]), sentAt: isoTime }),
  z.object({ intent: shadowedIntent, sentAt: isoTime }),
])

/** Guard-core tells the owner something that is not about one payment. */
export const alertEvent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('breaker_tripped'),
    agentId: z.string().min(1).max(64),
    detail: z.string().max(500),
    sentAt: isoTime,
  }),
  z.object({ kind: z.literal('passkey_enrolled'), detail: z.string().max(500), sentAt: isoTime }),
])
