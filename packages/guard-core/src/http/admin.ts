import type { FastifyInstance } from 'fastify'
import * as repo from '../db/repo.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
import { agentIdParam, policyBody } from './schemas.js'

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

    app.put('/policy/:agentId', async (request) => {
      const { agentId } = agentIdParam.parse(request.params)
      const policy = { agentId, ...policyBody.parse(request.body) }
      if (!repo.agentExists(db, agentId)) {
        throw new HttpError(404, 'not_found')
      }
      repo.putPolicy(db, policy, now().toISOString())
      repo.audit(db, { event: 'policy_updated', agentId, detail: { policy } }, now())
      return policy
    })

    for (const paused of [true, false]) {
      app.post(paused ? '/pause' : '/resume', async (request) => {
        const { agentId } = agentIdParam.parse(request.body)
        if (!repo.setPaused(db, agentId, paused, now().toISOString())) {
          throw new HttpError(404, 'not_found')
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
            return { chain: adapter.chain, error: 'build_failed' }
          }
        }),
      )
      repo.audit(
        db,
        {
          event: 'killed',
          detail: {
            pausedAgents,
            chains: ownerTransactions.map((tx) => ({ chain: tx.chain, built: !('error' in tx) })),
          },
        },
        now(),
      )
      return { pausedAgents, ownerTransactions }
    })
  }
}
