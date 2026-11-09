import { z } from 'zod'

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
  mandateId: z.uuid().optional(),
})

export const transferRequest = z.object({
  agentId,
  chain: caip2,
  token: address,
  amount: atomicAmount,
  recipient: address,
  reason,
  mandateId: z.uuid().optional(),
})

/** A task budget. Its lists are bounded like the policy's, and it lives between a minute and a day. */
export const mandateRequest = z.object({
  agentId,
  budget: atomicAmount.refine((value) => value !== '0', 'a budget of zero pays nothing'),
  domains: z.array(z.string().min(1).max(253)).max(64),
  recipients: z.array(address).max(64).default([]),
  ttlSeconds: z.number().int().min(60).max(86_400),
  reason,
})

export const mandateDecision = z.object({
  decision: z.enum(['approve', 'reject']),
  telegramUserId: z.string().min(1).max(32),
})

export const botDecisionRequest = z.object({
  intentId: z.uuid(),
  decision: z.enum(['approve', 'reject']),
  telegramUserId: z.string().min(1).max(32),
})

export const agentIdParam = z.object({ agentId })

/** The same ids create-agent accepts: they end up in URLs and in the owner's Telegram. */
const newAgentId = z.string().regex(/^[\w-]{1,64}$/, 'letters, digits, _ and -, up to 64')
export const newAgentRequest = z.object({ agentId: newAgentId })
export const agentRouteParam = z.object({ id: agentId })
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
  // Optional with no default: a client that does not know them leaves the stored values alone.
  mode: z.enum(['live', 'shadow']).optional(),
  priceIncreaseMaxPct: z.number().int().min(0).max(10_000).optional(),
  maxPaymentsPerMinute: z.number().int().min(1).max(1_000).optional(),
  requireMandate: z.boolean().optional(),
})

export type X402FetchRequest = z.infer<typeof x402FetchRequest>
export type TransferRequest = z.infer<typeof transferRequest>
export type BotDecisionRequest = z.infer<typeof botDecisionRequest>
export type PolicyBody = z.infer<typeof policyBody>

const DAY_MS = 86_400_000

export const reportQuery = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})

/** The last seven days by default. A year at most, so one request cannot read the whole log. */
export const REPORT_DEFAULT_SPAN_MS = 7 * DAY_MS
export const REPORT_MAX_SPAN_MS = 366 * DAY_MS

/** For ids that are not intents, such as mandates. */
export const idParam = z.object({ id: z.uuid() })

/**
 * A WebAuthn response is checked in full by the library; here only its outer shape and size, so
 * nothing unbounded reaches it.
 */
const webAuthnResponse = z
  .object({ id: z.string().min(1).max(1024), type: z.literal('public-key') })
  .loose()
  .refine((value) => JSON.stringify(value).length <= 16_384, 'response too large')

export const passkeyEnrolment = z.object({ response: webAuthnResponse })
export const ownerApproval = z.object({ intentId: z.uuid(), assertion: webAuthnResponse })

const enrolCode = z.string().regex(/^[A-Za-z0-9_-]{32}$/, 'not an enrolment code')
export const enrolCodeBody = z.object({ code: enrolCode })
export const ownerEnrolment = z.object({
  code: enrolCode,
  response: webAuthnResponse,
  /** From an enrolled passkey, once there is one: it vouches for the new one. */
  assertion: webAuthnResponse.optional(),
})
