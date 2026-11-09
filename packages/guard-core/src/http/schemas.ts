import { z } from 'zod'
import { POLICY_DEFAULTS } from '../domain/policy.js'

/**
 * Every external input is parsed here before it reaches anything else. Addresses stay opaque: only a
 * chain adapter knows whether base58 or hex is right, so the boundary checks shape and size, not
 * format.
 */

const atomicAmount = z.string().regex(/^(0|[1-9]\d*)$/, 'expected atomic units as a decimal string')

const caip2 = z.string().regex(/^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/, 'expected a CAIP-2 chain id')

const address = z.string().min(1).max(128)

const agentId = z.string().min(1).max(64)

/** Shown to the owner on Telegram, so it is bounded: an unbounded field is a message-flood vector. */
const reason = z.string().max(500)

// One check that cannot throw. Chaining .url() before this would not help: zod still runs the refine
// on an input that already failed, so a malformed URL would escape as a TypeError and a 500.
const httpUrl = z.string().refine((value) => {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}, 'expected an http(s) url')

export const x402FetchRequest = z.object({
  agentId,
  url: httpUrl,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z
    .record(z.string().max(256), z.string().max(8192))
    .refine((value) => Object.keys(value).length <= 64, 'too many headers')
    .optional(),
  body: z.string().max(1_000_000).optional(),
  /** The agent's own ceiling for this call. The tighter of this and the policy applies. */
  maxAmount: atomicAmount.optional(),
})

export const transferRequest = z.object({
  agentId,
  chain: caip2,
  token: address,
  amount: atomicAmount,
  recipient: address,
  reason,
})

export const botDecisionRequest = z.object({
  intentId: z.uuid(),
  decision: z.enum(['approve', 'reject']),
  telegramUserId: z.string().min(1).max(32),
})

export const agentIdParam = z.object({ agentId })
export const intentIdParam = z.object({ id: z.uuid() })

export const policyBody = z.object({
  chains: z.array(caip2).max(16),
  tokens: z.array(address).max(32),
  perTxMax: atomicAmount,
  dailyMax: atomicAmount,
  approvalThreshold: atomicAmount,
  allowedRecipients: z.array(address).max(256),
  allowedDomains: z.array(z.string().min(1).max(253)).max(256),
  paused: z.boolean(),
  mode: z.enum(['live', 'shadow']).default(POLICY_DEFAULTS.mode),
  priceIncreaseMaxPct: z
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(POLICY_DEFAULTS.priceIncreaseMaxPct),
  maxPaymentsPerMinute: z
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(POLICY_DEFAULTS.maxPaymentsPerMinute),
  requireMandate: z.boolean().default(POLICY_DEFAULTS.requireMandate),
})

export type X402FetchRequest = z.infer<typeof x402FetchRequest>
export type TransferRequest = z.infer<typeof transferRequest>
export type BotDecisionRequest = z.infer<typeof botDecisionRequest>
export type PolicyBody = z.infer<typeof policyBody>
