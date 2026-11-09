import type { FastifyInstance } from 'fastify'
import { decideMandate } from '../db/mandates.js'
import { pin } from '../db/pins.js'
import * as repo from '../db/repo.js'
import { decide } from '../service/approvals.js'
import { notify } from '../service/events.js'
import type { PaymentDeps } from '../service/payments.js'
import { sendApproved } from '../service/transfer.js'
import { HttpError } from './errors.js'
import { botDecisionRequest, idParam, mandateDecision } from './schemas.js'

export function botRoutes(deps: PaymentDeps) {
  const { db, now } = deps

  return async (app: FastifyInstance) => {
    app.post('/mandates/:id/decision', async (request) => {
      const { id } = idParam.parse(request.params)
      const { decision, telegramUserId } = mandateDecision.parse(request.body)
      const result = decideMandate(db, id, decision, now())
      if (!result.ok) {
        const code = { not_found: 404, already_decided: 409, expired: 410 }[result.reason]
        throw new HttpError(code, result.reason)
      }
      repo.audit(
        db,
        {
          event: 'mandate_decision',
          agentId: result.mandate.agentId,
          detail: { mandateId: id, decision, telegramUserId },
        },
        now(),
      )
      return result.mandate
    })

    app.post('/decision', async (request) => {
      const { intentId, decision, telegramUserId } = botDecisionRequest.parse(request.body)
      const result = decide(db, intentId, decision, now())
      if (!result.ok) {
        const late = result.reason === 'expired' ? repo.getIntent(db, intentId) : undefined
        if (late !== undefined) {
          notify(deps, late)
        }
        // A decision on something already settled is a conflict, not a bad request: the caller
        // was right about the id and only lost the race.
        throw new HttpError(result.reason === 'not_found' ? 404 : 409, result.reason)
      }
      repo.audit(
        db,
        {
          event: 'owner_decision',
          intentId,
          agentId: result.intent.agentId,
          reasons: result.intent.rejectReasons,
          detail: { decision, telegramUserId },
        },
        now(),
      )
      // A transfer carries everything needed to send it, so it goes now. An x402 payment waits for
      // the agent to repeat the request, because only that request can receive the response.
      // An approval also tells guard-core what this domain now charges and who it pays, so the
      // agent's repeat and the payments after it are not asked about again. A rejection keeps the
      // old pin, so the same request stays flagged.
      if (decision === 'reject') {
        notify(deps, result.intent)
      } else if (result.intent.kind === 'x402') {
        pin(db, result.intent, now())
      } else {
        return (await sendApproved(deps, intentId)) ?? result.intent
      }
      return result.intent
    })
  }
}
