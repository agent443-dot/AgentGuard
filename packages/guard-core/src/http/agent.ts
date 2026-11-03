import type { Amount, ChainId } from '@agentguard/shared'
import { getAddress } from '@agentguard/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import * as repo from '../db/repo.js'
import { parseBearer } from '../domain/auth.js'
import { UpstreamError } from '../adapters/upstream.js'
import { transfer } from '../service/transfer.js'
import { paidFetch, type X402Deps } from '../service/x402.js'
import { HttpError } from './errors.js'
import { agentIdParam, intentIdParam, transferRequest, x402FetchRequest } from './schemas.js'

export function agentRoutes(deps: X402Deps) {
  const { db, now } = deps

  async function requireAgent(request: FastifyRequest, reply: FastifyReply) {
    const presented = parseBearer(request.headers.authorization)
    const agent = presented === undefined ? undefined : repo.findAgentByToken(db, presented)
    if (agent === undefined) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    request.agentId = agent.id
  }

  /** An agent acts only as itself. A token for one agent naming another is refused outright. */
  function ownPolicy(request: FastifyRequest, agentId: string) {
    if (agentId !== request.agentId) {
      throw new HttpError(403, 'forbidden')
    }
    const policy = repo.getPolicy(db, agentId)
    if (policy === undefined) {
      throw new HttpError(404, 'not_found')
    }
    return policy
  }

  return async (app: FastifyInstance) => {
    app.addHook('preHandler', requireAgent)

    app.post('/transfer', async (request) => {
      const body = transferRequest.parse(request.body)
      const policy = ownPolicy(request, body.agentId)
      const intent = await transfer(deps, body, policy)
      return {
        intentId: intent.id,
        status: intent.status,
        rejectReasons: intent.rejectReasons,
        ...(intent.txId === undefined ? {} : { txId: intent.txId }),
      }
    })

    app.post('/x402/fetch', async (request, reply) => {
      const body = x402FetchRequest.parse(request.body)
      const policy = ownPolicy(request, body.agentId)
      try {
        return await paidFetch(deps, body, policy)
      } catch (error) {
        if (error instanceof UpstreamError) {
          return reply.code(502).send({ error: error.message })
        }
        throw error
      }
    })

    app.get('/intents/:id', async (request, reply) => {
      const { id } = intentIdParam.parse(request.params)
      const intent = repo.getIntent(db, id)
      // An intent belonging to another agent is reported as missing, not as forbidden: otherwise
      // the response confirms that the id exists.
      if (!intent || intent.agentId !== request.agentId) {
        return reply.code(404).send({ error: 'not_found' })
      }
      return intent
    })

    app.get('/budget/:agentId', async (request) => {
      const { agentId } = agentIdParam.parse(request.params)
      const policy = ownPolicy(request, agentId)
      return {
        spentToday: repo.spentToday(db, agentId, repo.utcDay(now())),
        dailyMax: policy.dailyMax,
        perTxMax: policy.perTxMax,
        hotWalletBalances: await hotWalletBalances(deps, policy.chains),
        paused: policy.paused,
      }
    })
  }
}

/** USDC per chain. A chain that cannot answer is left out rather than reported as empty. */
async function hotWalletBalances(deps: X402Deps, chains: ChainId[]) {
  const balances: Record<ChainId, Amount> = {}
  await Promise.all(
    chains.map(async (chain) => {
      const adapter = deps.chains.get(chain)
      const usdc = getAddress(chain, 'usdc')
      if (adapter === undefined || usdc === undefined) {
        return
      }
      try {
        balances[chain] = await adapter.getHotWalletBalance(usdc)
      } catch (error) {
        deps.log.warn({ err: error, chain }, 'balance read failed')
      }
    }),
  )
  return balances
}
