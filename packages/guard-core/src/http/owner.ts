import type { PayIntent } from '@agentguard/shared'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import type { FastifyInstance, FastifyReply } from 'fastify'
import * as repo from '../db/repo.js'
import { decide } from '../service/approvals.js'
import { afterApproval } from '../service/approved.js'
import { approvalOptions, needsPasskey, verifyApproval } from '../service/passkeys.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
import { idParam, ownerApproval } from './schemas.js'

// Nothing but this origin's own script and its own API: no inline code, no styles, no frames.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/** The owner approves an intent above PASSKEY_ABOVE here, with the passkey they enrolled. */
export function ownerRoutes(deps: PaymentDeps) {
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

    app.get('/owner/approve.js', async (_request, reply) =>
      reply
        .header('content-type', 'text/javascript; charset=utf-8')
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', 'no-store')
        .send(SCRIPT),
    )

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

const SCRIPT = `'use strict'
const fromB64 = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer
const toB64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
const data = document.getElementById('options')
const options = JSON.parse(data.textContent)
const status = document.getElementById('status')
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
    const res = await fetch('/v1/owner/approve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentId: data.dataset.intent, assertion }),
    })
    status.textContent = res.ok ? 'Approved. You can close this page.' : 'Not approved.'
  } catch {
    status.textContent = 'Not approved: the passkey was not used.'
  }
})
`
