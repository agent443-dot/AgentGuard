import type { FastifyInstance } from 'fastify'
import { pin } from '../db/pins.js'
import * as repo from '../db/repo.js'
import { decide } from '../service/approvals.js'
import { notify } from '../service/events.js'
import type { PaymentDeps } from '../service/payments.js'
import { sendApproved } from '../service/transfer.js'
import { HttpError } from './errors.js'
import { botDecisionRequest } from './schemas.js'

export function botRoutes(deps: PaymentDeps) {
  const { db, now } = deps

  return async (app: FastifyInstance) => {
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
