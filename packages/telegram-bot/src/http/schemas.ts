import { z } from 'zod'
import { REJECT_CODES } from '../domain/codes.js'

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
  simulation: z.object({
    summary: z.string().max(1000),
    balanceChanges: z
      .array(z.object({ token: opaque, delta: z.string().regex(/^-?(0|[1-9]\d*)$/) }))
      .max(32),
  }),
  approveBefore: isoTime,
})

/** Proposed in CR-002: guard-core reports intents that reached a final state. */
export const intentEvent = z.object({
  intent: payIntent,
  sentAt: isoTime,
})

export type IntentEvent = z.infer<typeof intentEvent>
