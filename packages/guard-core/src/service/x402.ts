import { SigningRefused, type ChainAdapter } from '@agentguard/onchain'
import type { IntentStatus, PayIntent, Policy, RejectCode } from '@agentguard/shared'
import { x402Client } from '@x402/core/client'
import { encodePaymentSignatureHeader } from '@x402/core/http'
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from '@x402/core/types'
import { pin } from '../db/pins.js'
import * as repo from '../db/repo.js'
import { chooseAccept, refusedTerms, requirementsChanged } from '../domain/x402.js'
import { call, decode402, settledTx, type Upstream } from '../adapters/upstream.js'
import type { X402FetchRequest } from '../http/schemas.js'
import {
  clear,
  finish,
  fund,
  newIntent,
  recordSpend,
  reject,
  type PaymentDeps,
} from './payments.js'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface X402Deps extends PaymentDeps {
  fetch: typeof fetch
}

/** SPEC: POST /v1/agent/x402/fetch. No intent when the resource asked for no payment. */
export interface FetchOutcome {
  intentId?: string
  status?: IntentStatus
  response?: Upstream
  rejectReasons: RejectCode[]
}

export async function paidFetch(
  deps: X402Deps,
  request: X402FetchRequest,
  policy: Policy,
): Promise<FetchOutcome> {
  const url = new URL(request.url)
  // Checked before the first request, not only before paying: the guard should not be a proxy that
  // agents can point at hosts the owner never approved, internal ones included. Over plain http
  // anyone on the path could rewrite the 402 and its payTo, so http is for this machine only.
  const secure = url.protocol === 'https:' || LOOPBACK.has(url.hostname)
  if (!secure || !policy.allowedDomains.includes(url.hostname)) {
    repo.audit(
      deps.db,
      {
        event: 'x402_refused',
        agentId: request.agentId,
        reasons: ['DOMAIN_NOT_ALLOWED'],
        detail: { domain: url.hostname, protocol: url.protocol },
      },
      deps.now(),
    )
    return { status: 'rejected', rejectReasons: ['DOMAIN_NOT_ALLOWED'] }
  }

  const first = await call(deps.fetch, request)
  if (first.status !== 402) {
    return { response: first, rejectReasons: [] }
  }

  const terms = {
    agentId: request.agentId,
    kind: 'x402' as const,
    domain: url.hostname,
    ...(request.mandateId === undefined ? {} : { mandateId: request.mandateId }),
    // The query string is left out: it often carries the API's own credentials, and this text goes
    // to the owner's Telegram.
    reason: `${request.method} ${url.origin}${url.pathname}`.slice(0, 500),
  }
  const required = decode402(first)
  const choice = required
    ? chooseAccept(required.accepts, policy, request.maxAmount)
    : { reasons: ['INVALID_402' as const] }
  if (required === undefined || choice.chosen === undefined) {
    const intent = newIntent({ ...terms, ...refusedTerms(required?.accepts[0]) }, deps.now())
    return view(reject(deps, intent, choice.reasons))
  }

  const chosen = choice.chosen
  const intent = newIntent(
    {
      ...terms,
      chain: chosen.network,
      token: chosen.asset,
      amount: chosen.amount,
      recipient: chosen.payTo,
    },
    deps.now(),
  )
  // Signing, the retry and the final status all happen under the lock: until the intent leaves
  // `approved`, a second request with the same terms could otherwise redeem it again.
  return deps.serial(request.agentId, () => pay(deps, request, first, required, chosen, intent))
}

async function pay(
  deps: X402Deps,
  request: X402FetchRequest,
  quote: Upstream,
  required: PaymentRequired,
  chosen: PaymentRequirements,
  fresh: PayIntent,
): Promise<FetchOutcome> {
  // An approval the owner already gave for exactly these terms is redeemed here, once.
  const approved = repo.findApprovedX402(deps.db, fresh, deps.now())
  const clearance = await clear(deps, approved ?? fresh, approved !== undefined)
  if (!clearance.cleared) {
    // Shadow mode pays nothing, so the agent gets the unpaid 402 it would have had to pay.
    return clearance.intent.status === 'shadowed'
      ? view(clearance.intent, quote)
      : view(clearance.intent)
  }
  const { intent, adapter } = clearance

  try {
    await fund(deps, adapter, intent)
  } catch (error) {
    deps.log.error({ err: error, intentId: intent.id }, 'hot wallet top-up failed')
    return view(finish(deps, intent, { status: 'failed' }))
  }

  const signed = await sign(deps, adapter, intent, required, chosen)
  if ('refused' in signed) {
    return view(reject(deps, intent, signed.refused))
  }
  if ('failed' in signed) {
    return view(finish(deps, intent, { status: 'failed' }))
  }
  recordSpend(deps, intent)
  repo.audit(deps.db, { event: 'signed', intentId: intent.id, agentId: intent.agentId }, deps.now())

  let retry: Upstream
  try {
    retry = await call(deps.fetch, request, {
      'PAYMENT-SIGNATURE': encodePaymentSignatureHeader(signed.payload),
    })
  } catch (error) {
    deps.log.warn({ err: error, intentId: intent.id }, 'paid retry failed')
    return view(finish(deps, intent, { status: 'failed' }))
  }

  if (retry.status === 402) {
    // Terms that moved between the quote and the retry are a server changing the deal after we
    // agreed to it. The same terms again mean it simply refused the payment.
    const again = decode402(retry)?.accepts ?? []
    const moved = !again.some((offer) => !requirementsChanged(chosen, offer))
    const reasons: RejectCode[] = moved ? ['INVALID_402'] : []
    return view(finish(deps, intent, { status: 'failed', reasons }), retry)
  }
  if (retry.status < 200 || retry.status >= 300) {
    return view(finish(deps, intent, { status: 'failed' }), retry)
  }
  const txId = settledTx(retry)
  pin(deps.db, intent, deps.now())
  return view(finish(deps, intent, { status: 'executed', ...(txId ? { txId } : {}) }), retry)
}

type Signed = { payload: PaymentPayload } | { refused: RejectCode[] } | { failed: true }

async function sign(
  deps: X402Deps,
  adapter: ChainAdapter,
  intent: PayIntent,
  required: PaymentRequired,
  chosen: PaymentRequirements,
): Promise<Signed> {
  try {
    // The SDK's own spend control, set to exactly this payment, as a second lock behind ours.
    const client = new x402Client()
      .register(chosen.network, adapter.x402Scheme(intent, chosen))
      .setSpendControls({
        maxAmountPerPayment: false,
        allowedAssets: [
          { network: chosen.network, asset: chosen.asset, maxAmountPerPayment: intent.amount },
        ],
      })
    return { payload: await client.createPaymentPayload({ ...required, accepts: [chosen] }) }
  } catch (error) {
    if (error instanceof SigningRefused) {
      return { refused: error.reasons }
    }
    deps.log.error({ err: error, intentId: intent.id }, 'payment signing failed')
    return { failed: true }
  }
}

function view(intent: PayIntent, response?: Upstream): FetchOutcome {
  return {
    intentId: intent.id,
    status: intent.status,
    rejectReasons: intent.rejectReasons,
    ...(response === undefined ? {} : { response }),
  }
}
