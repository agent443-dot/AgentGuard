import type { ChainStatus } from '@agentguard/shared'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import type { FastifyInstance } from 'fastify'
import { createAgent, listAgents, revokeAgent } from '../db/agents.js'
import { clearWindow } from '../db/breaker.js'
import { revokeMandate } from '../db/mandates.js'
import { receiptsBetween } from '../db/receipts.js'
import * as repo from '../db/repo.js'
import { summarise } from '../domain/report.js'
import { budget } from '../service/budget.js'
import { doctor } from '../service/doctor.js'
import { enrol, enrolmentOptions } from '../service/passkeys.js'
import { openMandate } from '../service/mandates.js'
import type { PaymentDeps } from '../service/payments.js'
import { HttpError } from './errors.js'
import { mandateReply } from './mandates.js'
import {
  agentIdParam,
  agentRouteParam,
  idParam,
  mandateRequest,
  newAgentRequest,
  passkeyEnrolment,
  policyBody,
  REPORT_DEFAULT_SPAN_MS,
  REPORT_MAX_SPAN_MS,
  reportQuery,
} from './schemas.js'

/**
 * A report or receipt period: the last seven days by default, a year at most. Checked once both
 * ends are known, so a lone `from` cannot ask for ten years.
 */
function period(query: unknown, now: () => Date) {
  const parsed = reportQuery.parse(query)
  const to = parsed.to === undefined ? now() : new Date(parsed.to)
  const from =
    parsed.from === undefined
      ? new Date(to.getTime() - REPORT_DEFAULT_SPAN_MS)
      : new Date(parsed.from)
  if (from >= to || to.getTime() - from.getTime() > REPORT_MAX_SPAN_MS) {
    throw new HttpError(400, 'invalid_request')
  }
  return { from, to }
}

export function adminRoutes(
  deps: PaymentDeps & { fetch: typeof fetch },
  setup: { botUrl: string; databaseUrl: string; passkeyRpId?: string; passkeyOrigin?: string },
) {
  const { db, now } = deps

  function passkeyAddress() {
    if (setup.passkeyRpId === undefined || setup.passkeyOrigin === undefined) {
      throw new HttpError(409, 'passkeys_not_configured')
    }
    return { rpId: setup.passkeyRpId, origin: setup.passkeyOrigin }
  }

  return async (app: FastifyInstance) => {
    // A new agent pays nothing: its policy denies everything and it starts in shadow mode.
    app.post('/agents', async (request, reply) => {
      const { agentId } = newAgentRequest.parse(request.body)
      if (repo.agentExists(db, agentId)) {
        return reply.code(409).send({ error: 'exists' })
      }
      const token = createAgent(db, agentId, now())
      repo.audit(db, { event: 'agent_created', agentId }, now())
      return { agentId, token }
    })

    app.get('/agents', async () => ({ agents: listAgents(db) }))

    app.post('/agents/:id/revoke', async (request) => {
      const { id } = agentRouteParam.parse(request.params)
      const result = revokeAgent(db, id, now())
      if (result === 'not_found') {
        throw new HttpError(404, 'not_found')
      }
      if (result === 'revoked') {
        repo.audit(db, { event: 'agent_revoked', agentId: id }, now())
      }
      return { agentId: id, revoked: true }
    })

    // The passkey is bound to guard-core's public address, so enrolment needs it configured.
    app.post('/passkeys/options', async () => {
      const setup = passkeyAddress()
      return enrolmentOptions(db, setup, now())
    })

    app.post('/passkeys', async (request, reply) => {
      const { response } = passkeyEnrolment.parse(request.body)
      // The library checks the whole response; the schema only bounded its size and outer shape.
      const registration = response as unknown as RegistrationResponseJSON
      if (!(await enrol(db, passkeyAddress(), registration, now()))) {
        return reply.code(400).send({ error: 'passkey_not_verified' })
      }
      repo.audit(db, { event: 'passkey_enrolled' }, now())
      return { enrolled: true }
    })

    app.get('/doctor', async () => ({ checks: await doctor({ ...deps, ...setup }) }))

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
      const { from, to } = period(request.query, now)
      return { agents: summarise(repo.agentIds(db), repo.intentsBetween(db, from, to)) }
    })

    app.get('/receipts', async (request) => {
      const { from, to } = period(request.query, now)
      return { receipts: receiptsBetween(db, from, to) }
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
