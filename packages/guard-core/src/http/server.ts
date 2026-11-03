import type { ChainAdapter } from '@agentguard/onchain'
import type { ChainId } from '@agentguard/shared'
import rateLimit from '@fastify/rate-limit'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import { z } from 'zod'
import { httpBotNotifier, type BotNotifier } from '../adapters/bot.js'
import type { Config } from '../config.js'
import type { Db } from '../db/client.js'
import { parseBearer, tokenMatches } from '../domain/auth.js'
import { sweep } from '../service/payments.js'
import { serial } from '../service/serial.js'
import type { X402Deps } from '../service/x402.js'
import { adminRoutes } from './admin.js'
import { agentRoutes } from './agent.js'
import { botRoutes } from './bot.js'

declare module 'fastify' {
  interface FastifyRequest {
    agentId?: string
  }
}

export interface ServerDeps {
  db: Db
  config: Config
  chains?: ReadonlyMap<ChainId, ChainAdapter>
  bot?: BotNotifier
  fetch?: typeof fetch
  now?: () => Date
  /** Runs the expiry sweep on this interval. Off when unset, as in tests that drive it directly. */
  sweepMs?: number
}

export async function buildServer(options: ServerDeps) {
  const { db, config } = options
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // A bearer token in a log file is the same as a bearer token in a repository.
      redact: ['req.headers.authorization', 'req.headers["x-guard-signature"]'],
    },
  })

  const deps: X402Deps = {
    db,
    chains: options.chains ?? new Map(),
    bot: options.bot ?? httpBotNotifier(config),
    fetch: options.fetch ?? fetch,
    now: options.now ?? (() => new Date()),
    serial: serial(),
    log: app.log,
  }

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

  function requireToken(expected: string) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const presented = parseBearer(request.headers.authorization)
      if (presented === undefined || !tokenMatches(presented, expected)) {
        return reply.code(401).send({ error: 'unauthorized' })
      }
    }
  }

  app.register(agentRoutes(deps), { prefix: '/v1/agent' })
  app.register(
    async (admin) => {
      admin.addHook('preHandler', requireToken(config.ADMIN_TOKEN))
      await admin.register(adminRoutes(deps))
    },
    { prefix: '/v1/admin' },
  )
  app.register(
    async (bot) => {
      bot.addHook('preHandler', requireToken(config.BOT_TOKEN))
      await bot.register(botRoutes(deps))
    },
    { prefix: '/v1/bot' },
  )

  app.get('/health', async () => ({ status: 'ok' }))

  if (options.sweepMs !== undefined) {
    const timer = setInterval(() => {
      const expired = sweep(deps)
      if (expired > 0) {
        app.log.info({ expired }, 'expired pending intents')
      }
    }, options.sweepMs)
    app.addHook('onClose', async () => clearInterval(timer))
  }

  return app
}

function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

export type Server = FastifyInstance
