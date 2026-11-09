import type { ChainStatus } from '@agentguard/shared'
import type { FastifyInstance } from 'fastify'
import { clearWindow } from '../db/breaker.js'
import { revokeMandate } from '../db/mandates.js'
import * as repo from '../db/repo.js'
import { summarise } from '../domain/report.js'
import { budget } from '../service/budget.js'
import { openMandate } from '../service/mandates.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
import { mandateReply } from './mandates.js'
import {
  agentIdParam,
  idParam,
  mandateRequest,
  policyBody,
  REPORT_DEFAULT_SPAN_MS,
  REPORT_MAX_SPAN_MS,
  reportQuery,
} from './schemas.js'

export function adminRoutes(deps: PaymentDeps) {
  const { db, now } = deps

  return async (app: FastifyInstance) => {
    app.get('/policy/:agentId', async (request) => {
      const { agentId } = agentIdParam.parse(request.params)
      const policy = repo.getPolicy(db, agentId)
      if (policy === undefined) {
        throw new HttpError(404, 'not_found')
      }
      return policy
    })

    app.get('/budget/:agentId', async (request) => {
      const { agentId } = agentIdParam.parse(request.params)
      const policy = repo.getPolicy(db, agentId)
      if (policy === undefined) {
        throw new HttpError(404, 'not_found')
      }
      return budget(deps, policy)
    })

    // CR-006. A chain whose allowance cannot be read stays listed with null, like a kill payload:
    // the bot still has to show the owner that the chain exists.
    app.get('/chains', async (request) => ({
      chains: await Promise.all(
        [...deps.chains.values()].map(async (adapter): Promise<ChainStatus> => {
          try {
            return { chain: adapter.chain, allowance: await adapter.getAllowanceState() }
          } catch (error) {
            request.log.warn({ err: error, chain: adapter.chain }, 'allowance read failed')
            return { chain: adapter.chain, allowance: null }
          }
        }),
      ),
    }))

    // The owner's own mandates start active: there is nobody else to ask.
    app.post('/mandates', async (request, reply) =>
      mandateReply(reply, await openMandate(deps, mandateRequest.parse(request.body), true)),
    )

    app.post('/mandates/:id/revoke', async (request) => {
      const { id } = idParam.parse(request.params)
      const result = revokeMandate(db, id)
      if (!result.ok) {
        throw new HttpError(result.reason === 'not_found' ? 404 : 409, result.reason)
      }
      const { mandate } = result
      repo.audit(
        db,
        { event: 'mandate_revoked', agentId: mandate.agentId, detail: { mandateId: id } },
        now(),
      )
      return mandate
    })

    app.get('/report', async (request) => {
      const query = reportQuery.parse(request.query)
      const to = query.to === undefined ? now() : new Date(query.to)
      const from =
        query.from === undefined
          ? new Date(to.getTime() - REPORT_DEFAULT_SPAN_MS)
          : new Date(query.from)
      // Checked once both ends are known, so a lone `from` cannot ask for ten years.
      if (from >= to || to.getTime() - from.getTime() > REPORT_MAX_SPAN_MS) {
        throw new HttpError(400, 'invalid_request')
      }
      return { agents: summarise(repo.agentIds(db), repo.intentsBetween(db, from, to)) }
    })

    app.put('/policy/:agentId', async (request) => {
      const { agentId } = agentIdParam.parse(request.params)
      const policy = { agentId, ...policyBody.parse(request.body) }
      if (!repo.agentExists(db, agentId)) {
        throw new HttpError(404, 'not_found')
      }
      repo.putPolicy(db, policy, now().toISOString())
      // Read back, so the answer shows the fields this request left as they were.
      const stored = repo.getPolicy(db, agentId)
      repo.audit(db, { event: 'policy_updated', agentId, detail: { policy: stored } }, now())
      return stored
    })

    for (const paused of [true, false]) {
      app.post(paused ? '/pause' : '/resume', async (request) => {
        const { agentId } = agentIdParam.parse(request.body)
        if (!repo.setPaused(db, agentId, paused, now().toISOString())) {
          throw new HttpError(404, 'not_found')
        }
        // A resumed agent starts a fresh minute: the payments that tripped the breaker are not
        // counted against it again.
        if (!paused) {
          clearWindow(db, agentId)
        }
        repo.audit(db, { event: paused ? 'paused' : 'resumed', agentId }, now())
        return { agentId, paused }
      })
    }

    // Pausing comes first and cannot fail on a chain: whatever happens to the owner transactions,
    // guard-core has stopped signing.
    app.post('/kill', async (request) => {
      const pausedAgents = repo.pauseAll(db, now().toISOString())
      const ownerTransactions = await Promise.all(
        [...deps.chains.values()].map(async (adapter) => {
          try {
            return { chain: adapter.chain, ...(await adapter.buildKillTx()) }
          } catch (error) {
            request.log.error({ err: error, chain: adapter.chain }, 'kill tx build failed')
            // The owner still has to act on this chain, so it stays in the list, saying so.
            return {
              chain: adapter.chain,
              description: `Could not build the kill transaction for ${adapter.chain}. Remove the hot wallet's spend limit on this chain by hand.`,
              payload: null,
            }
          }
        }),
      )
      repo.audit(
        db,
        {
          event: 'killed',
          detail: {
            pausedAgents,
            chains: ownerTransactions.map((tx) => ({
              chain: tx.chain,
              built: tx.payload !== null,
            })),
          },
        },
        now(),
      )
      return { pausedAgents, ownerTransactions }
    })
  }
}
