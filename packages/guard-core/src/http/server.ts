import rateLimit from '@fastify/rate-limit'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import type { Db } from '../db/client.js'
import * as repo from '../db/repo.js'
import { parseBearer, tokenMatches } from '../domain/auth.js'
import { decide } from '../service/approvals.js'
import { agentIdParam, botDecisionRequest, intentIdParam, policyBody } from './schemas.js'

declare module 'fastify' {
  interface FastifyRequest {
    agentId?: string
  }
}

export interface ServerDeps {
  db: Db
  config: Config
  now?: () => Date
}

export async function buildServer({ db, config, now = () => new Date() }: ServerDeps) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // A bearer token in a log file is the same as a bearer token in a repository.
      redact: ['req.headers.authorization', 'req.headers["x-guard-signature"]'],
    },
  })

  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })

  app.setErrorHandler((error: FastifyError | z.ZodError, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'invalid_request', issues: issuesOf(error) })
    }
    if (error.statusCode !== undefined && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    request.log.error({ err: error }, 'unhandled error')
    return reply.code(500).send({ error: 'internal_error' })
  })

  function requireFixedToken(expected: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const presented = parseBearer(request.headers.authorization)
      if (presented === undefined || !tokenMatches(presented, expected)) {
        return reply.code(401).send({ error: 'unauthorized' })
      }
    }
  }

  async function requireAgent(request: FastifyRequest, reply: FastifyReply) {
    const presented = parseBearer(request.headers.authorization)
    const agent = presented === undefined ? undefined : repo.findAgentByToken(db, presented)
    if (agent === undefined) {
      return reply.code(401).send({ error: 'unauthorized' })
    }
    request.agentId = agent.id
  }

  app.register(
    async (agentRoutes) => {
      agentRoutes.addHook('preHandler', requireAgent)

      agentRoutes.get('/intents/:id', async (request, reply) => {
        const { id } = intentIdParam.parse(request.params)
        const intent = repo.getIntent(db, id)
        // An intent belonging to another agent is reported as missing, not as forbidden: otherwise
        // the response confirms that the id exists.
        if (!intent || intent.agentId !== request.agentId) {
          return reply.code(404).send({ error: 'not_found' })
        }
        return intent
      })

      agentRoutes.get('/budget/:agentId', async (request, reply) => {
        const { agentId } = agentIdParam.parse(request.params)
        if (agentId !== request.agentId) {
          return reply.code(403).send({ error: 'forbidden' })
        }
        const policy = repo.getPolicy(db, agentId)
        if (!policy) {
          return reply.code(404).send({ error: 'not_found' })
        }
        return {
          spentToday: repo.spentToday(db, agentId, repo.utcDay(now())),
          dailyMax: policy.dailyMax,
          perTxMax: policy.perTxMax,
          hotWalletBalances: {},
          paused: policy.paused,
        }
      })
    },
    { prefix: '/v1/agent' },
  )

  app.register(
    async (adminRoutes) => {
      adminRoutes.addHook('preHandler', requireFixedToken(config.ADMIN_TOKEN))

      adminRoutes.get('/policy/:agentId', async (request, reply) => {
        const { agentId } = agentIdParam.parse(request.params)
        const policy = repo.getPolicy(db, agentId)
        return policy ?? reply.code(404).send({ error: 'not_found' })
      })

      adminRoutes.put('/policy/:agentId', async (request) => {
        const { agentId } = agentIdParam.parse(request.params)
        const body = policyBody.parse(request.body)
        repo.putPolicy(db, { agentId, ...body }, now().toISOString())
        return { agentId, ...body }
      })

      adminRoutes.post('/pause', pauseRoute(true))
      adminRoutes.post('/resume', pauseRoute(false))

      adminRoutes.post('/kill', async () => {
        const paused = repo.pauseAll(db, now().toISOString())
        // Each chain's owner transaction comes from its adapter; none are wired yet.
        return { pausedAgents: paused, ownerTransactions: [] }
      })

      function pauseRoute(paused: boolean) {
        return async (request: FastifyRequest, reply: FastifyReply) => {
          const { agentId } = agentIdParam.parse(request.body)
          if (!repo.setPaused(db, agentId, paused, now().toISOString())) {
            return reply.code(404).send({ error: 'not_found' })
          }
          return { agentId, paused }
        }
      }
    },
    { prefix: '/v1/admin' },
  )

  app.register(
    async (botRoutes) => {
      botRoutes.addHook('preHandler', requireFixedToken(config.BOT_TOKEN))

      botRoutes.post('/decision', async (request, reply) => {
        const { intentId, decision } = botDecisionRequest.parse(request.body)
        const result = decide(db, intentId, decision, now())
        if (!result.ok) {
          // A decision on something already settled is a conflict, not a bad request: the caller
          // was right about the id and only lost the race.
          return reply
            .code(result.reason === 'not_found' ? 404 : 409)
            .send({ error: result.reason })
        }
        return result.intent
      })
    },
    { prefix: '/v1/bot' },
  )

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}

function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

export type Server = FastifyInstance
