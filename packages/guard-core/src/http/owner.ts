import type { PayIntent } from '@agentguard/shared'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { enrolCodeValid, takeEnrolCode } from '../db/passkeys.js'
import * as repo from '../db/repo.js'
import { decide } from '../service/approvals.js'
import { afterApproval } from '../service/approved.js'
import {
  approvalOptions,
  codeHash,
  enrol,
  enrolmentOptions,
  needsPasskey,
  verifyApproval,
} from '../service/passkeys.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
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
      const options = await approvalOptions(db, deps.passkey, intent)
      return page(
        reply,
        `<h1>Approve a payment</h1>
<p>${escape(intent.amount)} atomic units on ${escape(intent.chain)} to ${escape(intent.recipient)}${
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
      return enrolmentOptions(db, rp, now(), `enrol:${hash}`)
    })

    app.post('/v1/owner/passkeys', async (request, reply) => {
      const { code, response } = ownerEnrolment.parse(request.body)
      if (rp === undefined) {
        throw new HttpError(404, 'not_found')
      }
      const hash = codeHash(code)
      if (!takeEnrolCode(db, hash, now())) {
        throw new HttpError(401, 'code_not_valid')
      }
      // The library checks the whole response; the schema only bounded its size and shape.
      const registration = response as unknown as RegistrationResponseJSON
      if (!(await enrol(db, rp, registration, now(), `enrol:${hash}`))) {
        return reply.code(400).send({ error: 'passkey_not_verified' })
      }
      repo.audit(db, { event: 'passkey_enrolled', detail: { via: 'code' } }, now())
      return { enrolled: true }
    })

    app.post('/v1/owner/approve', async (request) => {
      const { intentId, assertion } = ownerApproval.parse(request.body)
      const intent = awaiting(intentId)
      if (deps.passkey === undefined || intent === undefined) {
        throw new HttpError(404, 'not_found')
      }
      const ok = await verifyApproval(
        db,
        deps.passkey,
        intent,
        // The library checks the whole assertion; the schema only bounded its size and shape.
        assertion as unknown as AuthenticationResponseJSON,
        now(),
      )
      if (!ok) {
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
  }
}

function script(reply: FastifyReply, source: string) {
  return reply
    .header('content-type', 'text/javascript; charset=utf-8')
    .header('x-content-type-options', 'nosniff')
    .header('cache-control', 'no-store')
    .send(source)
}

function page(reply: FastifyReply, body: string) {
  return reply
    .header('content-type', 'text/html; charset=utf-8')
    .header('content-security-policy', CSP)
    .header('x-content-type-options', 'nosniff')
    .header('referrer-policy', 'no-referrer')
    .header('cache-control', 'no-store')
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

const HELPERS = `'use strict'
const fromB64 = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer
const toB64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
const status = document.getElementById('status')
const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
`

const APPROVE_SCRIPT = `${HELPERS}
const data = document.getElementById('options')
const options = JSON.parse(data.textContent)
document.getElementById('approve').addEventListener('click', async () => {
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge: fromB64(options.challenge),
        allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: fromB64(c.id) })),
      },
    })
    const r = credential.response
    const assertion = {
      id: credential.id,
      rawId: toB64(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(r.clientDataJSON),
        authenticatorData: toB64(r.authenticatorData),
        signature: toB64(r.signature),
        ...(r.userHandle ? { userHandle: toB64(r.userHandle) } : {}),
      },
    }
    const res = await post('/v1/owner/approve', { intentId: data.dataset.intent, assertion })
    status.textContent = res.ok ? 'Approved. You can close this page.' : 'Not approved.'
  } catch {
    status.textContent = 'Not approved: the passkey was not used.'
  }
})
`

const ENROL_SCRIPT = `${HELPERS}
const code = new URLSearchParams(location.hash.slice(1)).get('code')
// Out of the address bar and the history once read.
history.replaceState(null, '', location.pathname)
document.getElementById('enrol').addEventListener('click', async () => {
  try {
    const asked = await post('/v1/owner/passkeys/options', { code })
    if (!asked.ok) {
      status.textContent = 'This link is no longer valid. Ask the bot for a new one.'
      return
    }
    const options = await asked.json()
    const credential = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: fromB64(options.challenge),
        user: { ...options.user, id: fromB64(options.user.id) },
        excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: fromB64(c.id) })),
      },
    })
    const r = credential.response
    const response = {
      id: credential.id,
      rawId: toB64(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: toB64(r.clientDataJSON),
        attestationObject: toB64(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : [],
      },
    }
    const res = await post('/v1/owner/passkeys', { code, response })
    status.textContent = res.ok ? 'Passkey enrolled. You can close this page.' : 'Not enrolled.'
  } catch {
    status.textContent = 'Not enrolled: the passkey was not created.'
  }
})
`
