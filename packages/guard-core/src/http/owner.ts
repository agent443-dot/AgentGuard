import type { PayIntent } from '@agentguard/shared'
import { getAddress, usdSymbol } from '@agentguard/shared'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { countPasskeys, enrolCodeValid, getPasskey, takeEnrolCode } from '../db/passkeys.js'
import * as repo from '../db/repo.js'
import { formatDollars } from '../domain/amount.js'
import { decide } from '../service/approvals.js'
import { afterApproval } from '../service/approved.js'
import { alert } from '../service/events.js'
import {
  approvalOptions,
  codeHash,
  enrol,
  enrolmentOptions,
  needsPasskey,
  stepUpOptions,
  verifyAssertion,
} from '../service/passkeys.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
import { APPROVE_SCRIPT, ENROL_SCRIPT } from './owner-scripts.js'
import { enrolCodeBody, idParam, ownerApproval, ownerEnrolment } from './schemas.js'

// Nothing but this origin's own script and its own API: no inline code, no styles, no frames.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/**
 * The owner approves an intent above PASSKEY_ABOVE here, with the passkey they enrolled, and
 * enrols one from a phone with a one-time code. `rp` is guard-core's public address, which every
 * passkey is bound to; without it neither page exists.
 */
export function ownerRoutes(deps: PaymentDeps, rp?: { rpId: string; origin: string }) {
  const { db, now } = deps

  /** An intent this page may approve: still waiting for the owner, and above the passkey amount. */
  function awaiting(id: string): PayIntent | undefined {
    const intent = repo.getIntent(db, id)
    return intent?.status === 'pending_approval' &&
      new Date(intent.expiresAt).getTime() > now().getTime() &&
      needsPasskey(deps.passkey, intent)
      ? intent
      : undefined
  }

  return async (app: FastifyInstance) => {
    app.get('/owner/approve/:id', async (request, reply) => {
      const { id } = idParam.parse(request.params)
      const intent = awaiting(id)
      if (deps.passkey === undefined || intent === undefined) {
        return page(reply.code(404), '<p>There is nothing to approve here.</p>')
      }
      const options = await approvalOptions(db, deps.passkey, intent, now())
      return page(
        reply,
        `<h1>Approve a payment</h1>
<p>${escape(amountText(intent))} on ${escape(intent.chain)} to ${escape(intent.recipient)}${
          intent.domain === undefined ? '' : ` for ${escape(intent.domain)}`
        }.</p>
<p>The agent says: ${escape(intent.reason)}</p>
<button id="approve" type="button">Approve with passkey</button>
<p id="status"></p>
<script id="options" type="application/json" data-intent="${escape(intent.id)}">${json(options)}</script>
<script src="/owner/approve.js"></script>`,
      )
    })

    app.get('/owner/approve.js', async (_request, reply) => script(reply, APPROVE_SCRIPT))

    app.post('/v1/owner/approve', async (request) => {
      const { intentId, assertion } = ownerApproval.parse(request.body)
      const intent = awaiting(intentId)
      if (deps.passkey === undefined || intent === undefined) {
        throw new HttpError(404, 'not_found')
      }
      // The library checks the whole assertion; the schema only bounded its size and shape.
      const answer = assertion as unknown as AuthenticationResponseJSON
      if ((await verifyAssertion(db, deps.passkey, intent.id, answer, now())) === undefined) {
        repo.audit(db, { event: 'passkey_refused', intentId, agentId: intent.agentId }, now())
        throw new HttpError(401, 'passkey_not_verified')
      }
      const result = decide(db, intentId, 'approve', now())
      if (!result.ok) {
        throw new HttpError(result.reason === 'expired' ? 410 : 409, result.reason)
      }
      repo.audit(
        db,
        {
          event: 'owner_decision',
          intentId,
          agentId: intent.agentId,
          detail: { decision: 'approve', method: 'passkey' },
        },
        now(),
      )
      return afterApproval(deps, result.intent, 'passkey')
    })

    // The code travels in the link's fragment, which the browser never sends, so it stays out of
    // every request line and log; the page's script reads it and posts it.
    app.get('/owner/enrol', async (_request, reply) =>
      rp === undefined
        ? page(reply.code(404), '<p>Passkeys are not set up on this AgentGuard.</p>')
        : page(
            reply,
            `<h1>Enrol a passkey</h1>
<p>This passkey will be the only way to approve the largest payments.</p>
<button id="enrol" type="button">Create passkey</button>
<p id="status"></p>
<script src="/owner/enrol.js"></script>`,
          ),
    )

    app.get('/owner/enrol.js', async (_request, reply) => script(reply, ENROL_SCRIPT))

    app.post('/v1/owner/passkeys/options', async (request) => {
      const { code } = enrolCodeBody.parse(request.body)
      if (rp === undefined) {
        throw new HttpError(404, 'not_found')
      }
      const hash = codeHash(code)
      if (!enrolCodeValid(db, hash, now())) {
        throw new HttpError(401, 'code_not_valid')
      }
      const registration = await enrolmentOptions(db, rp, now(), `enrol:${hash}`)
      // A code alone adds only the first passkey. After that, one already enrolled must vouch for
      // the new one, or whoever holds the owner's Telegram could add their own.
      return countPasskeys(db) === 0
        ? { registration }
        : { registration, stepUp: await stepUpOptions(db, rp, `step-up:${hash}`, now()) }
    })

    app.post('/v1/owner/passkeys', async (request) => {
      const { code, response, assertion } = ownerEnrolment.parse(request.body)
      if (rp === undefined) {
        throw new HttpError(404, 'not_found')
      }
      const hash = codeHash(code)
      if (!enrolCodeValid(db, hash, now())) {
        throw new HttpError(401, 'code_not_valid')
      }
      // Checked before the code is used, so a passkey sent twice does not cost the owner the link.
      if (getPasskey(db, response.id) !== undefined) {
        throw new HttpError(409, 'passkey_exists')
      }
      // With none enrolled yet, the code alone may add one, but only if it is still the first
      // when it is saved; otherwise an enrolled passkey must vouch for it.
      const first = countPasskeys(db) === 0
      const voucher =
        first || assertion === undefined
          ? undefined
          : await verifyAssertion(
              db,
              rp,
              `step-up:${hash}`,
              assertion as unknown as AuthenticationResponseJSON,
              now(),
            )
      if (!first && voucher === undefined) {
        repo.audit(db, { event: 'passkey_step_up_refused' }, now())
        throw new HttpError(401, 'step_up_required')
      }
      if (!takeEnrolCode(db, hash, now())) {
        throw new HttpError(401, 'code_not_valid')
      }
      // The library checks the whole response; the schema only bounded its size and shape.
      const registration = response as unknown as RegistrationResponseJSON
      const enrolled = await enrol(db, rp, registration, now(), {
        purpose: `enrol:${hash}`,
        firstOnly: first,
      })
      if (!enrolled.ok) {
        throw refusal(enrolled.reason)
      }
      enrolledNotice(deps, enrolled.id, 'code', voucher)
      return { enrolled: true }
    })
  }
}

/** Every new passkey is audited and told to the owner at once: an unexpected one is an attack. */
export function enrolledNotice(
  deps: PaymentDeps,
  id: string,
  via: 'code' | 'admin',
  voucher?: string,
): void {
  const prefix = id.slice(0, 8)
  const detail = {
    via,
    id: prefix,
    ...(voucher === undefined ? {} : { voucher: voucher.slice(0, 8) }),
  }
  repo.audit(deps.db, { event: 'passkey_enrolled', detail }, deps.now())
  alert(deps, { kind: 'passkey_enrolled', detail: prefix })
}

export function refusal(reason: 'exists' | 'not_verified' | 'step_up_required'): HttpError {
  return reason === 'exists'
    ? new HttpError(409, 'passkey_exists')
    : reason === 'step_up_required'
      ? new HttpError(409, 'step_up_required')
      : new HttpError(400, 'passkey_not_verified')
}

/** "3.00 USDC" for the chain's dollar; any other token in plain base units. */
function amountText(intent: PayIntent): string {
  const symbol = usdSymbol(intent.chain)
  return symbol !== undefined && getAddress(intent.chain, 'usd') === intent.token
    ? `${formatDollars(intent.amount)} ${symbol}`
    : `${intent.amount} base units of ${intent.token}`
}

function security(reply: FastifyReply) {
  return reply
    .header('x-content-type-options', 'nosniff')
    .header('x-frame-options', 'DENY')
    .header('strict-transport-security', 'max-age=31536000; includeSubDomains')
    .header('cache-control', 'no-store')
}

function script(reply: FastifyReply, source: string) {
  return security(reply).header('content-type', 'text/javascript; charset=utf-8').send(source)
}

function page(reply: FastifyReply, body: string) {
  return security(reply)
    .header('content-type', 'text/html; charset=utf-8')
    .header('content-security-policy', CSP)
    .header('referrer-policy', 'no-referrer')
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AgentGuard</title></head><body>${body}</body></html>`,
    )
}

/** The agent's text and the recipient are untrusted: shown as text, never as markup. */
function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** JSON inside a script element: `<` escaped so no value can close the element. */
function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
