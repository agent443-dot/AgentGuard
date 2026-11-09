import type { IntentEvent } from '@agentguard/shared'
import { z } from 'zod'
import { APPROVAL_FLAGS, REJECT_CODES } from '../domain/codes.js'

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

export const approvalRequest = z.object({
  intent: payIntent,
  // A guard-core older than the flags sends none, which reads as no flag.
  flags: z.array(z.enum(APPROVAL_FLAGS)).max(APPROVAL_FLAGS.length).default([]),
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
export const alertEvent = z.object({
  kind: z.literal('breaker_tripped'),
  agentId: z.string().min(1).max(64),
  detail: z.string().max(500),
  sentAt: isoTime,
})
