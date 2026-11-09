import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  readLimitedText,
} from '@x402/core/http'
import type { PaymentRequired } from '@x402/core/types'
import { z } from 'zod'
import type { X402FetchRequest } from '../http/schemas.js'

/** The paid API's answer, as returned to the agent. The body is untrusted content. */
export interface Upstream {
  status: number
  headers: Record<string, string>
  body: string
}

export class UpstreamError extends Error {}

const TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 1_000_000

// Payment headers are ours to set. An agent that supplies one is trying to pay with something we
// did not sign, or to replay something we did.
const RESERVED_HEADERS = new Set(['payment-signature', 'x-payment', 'host', 'content-length'])

export async function call(
  fetchImpl: typeof fetch,
  request: X402FetchRequest,
  payment: Record<string, string> = {},
): Promise<Upstream> {
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (!RESERVED_HEADERS.has(name.toLowerCase())) {
      headers[name] = value
    }
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: { ...headers, ...payment },
      body: hasBody ? request.body : undefined,
      // A redirect would take the request, and on the retry the signed payment, to a host the
      // domain allowlist never approved.
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await readLimitedText(response, MAX_BODY_BYTES),
    }
  } catch (error) {
    throw new UpstreamError('upstream_unreachable', { cause: error })
  }
}

// Bounded so that whatever an accepted offer puts in an intent fits the audit log and the bot.
const requirements = z.object({
  scheme: z.string().max(32),
  network: z.templateLiteral([z.string(), ':', z.string()]).check(z.maxLength(64)),
  asset: z.string().max(128),
  amount: z.string().max(78),
  payTo: z.string().max(128),
  maxTimeoutSeconds: z.number(),
  extra: z.record(z.string(), z.unknown()).default({}),
})

// Version 2 only: version 1 prices in a different field and names networks differently, and a
// format we accept but do not check is a format an attacker gets to choose.
const paymentRequired = z.object({
  x402Version: z.literal(2),
  error: z.string().optional(),
  resource: z.looseObject({ url: z.string() }),
  accepts: z.array(requirements).max(16),
  extensions: z.record(z.string(), z.unknown()).optional(),
})

/** Undefined for anything that is not a well-formed version 2 PAYMENT-REQUIRED header. */
export function decode402(upstream: Upstream): PaymentRequired | undefined {
  const header = upstream.headers['payment-required']
  if (header === undefined) {
    return undefined
  }
  try {
    return paymentRequired.parse(decodePaymentRequiredHeader(header))
  } catch {
    return undefined
  }
}

// A signature or hash: base58 on Solana, 0x-hex on EVM. Anything else is the paid server's text, and
// it would reach the owner's alert and the agent's tool output under our name.
const TX_ID = /^[A-Za-z0-9]{1,128}$/

/** The settlement transaction the server reports, if it reports one that looks like one. */
export function settledTx(upstream: Upstream): string | undefined {
  const header = upstream.headers['payment-response']
  if (header === undefined) {
    return undefined
  }
  try {
    const { transaction } = decodePaymentResponseHeader(header)
    return typeof transaction === 'string' && TX_ID.test(transaction) ? transaction : undefined
  } catch {
    return undefined
  }
}
