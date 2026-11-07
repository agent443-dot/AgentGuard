import type { ChainAdapter } from '@agentguard/onchain'
import type { ChainId } from '@agentguard/shared'
import rateLimit from '@fastify/rate-limit'
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify'
import { isIP } from 'node:net'
import { z } from 'zod'
import { httpBotNotifier, type BotNotifier } from '../adapters/bot.js'
import type { Config } from '../config.js'
import type { Db } from '../db/client.js'
import { usdcFor } from '../chains.js'
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

/**
 * Which routes a listener serves. `all` is the one listener of a local run. A deployment splits
 * them: `public` faces the internet behind Fly's TLS and serves only the agent routes, `private`
 * sits on Fly's private network and serves the admin and bot routes to the bot.
 */
export type Surface = 'all' | 'public' | 'private'

/** Every route on one listener, as a local run and the tests use it. */
export async function buildServer(options: ServerDeps): Promise<Server> {
  const [app] = await buildServers(options, ['all'])
  return app
}

/**
 * One app per surface over one set of deps. They must share them: the bot's approval on the
 * private listener and the agent's request on the public one take the same per-agent lock.
 */
export async function buildServers(
  options: ServerDeps,
  surfaces: readonly [Surface, ...Surface[]],
): Promise<[Server, ...Server[]]> {
  const { config } = options
  const apps: Server[] = surfaces.map(() =>
    Fastify({
      logger: {
        level: config.LOG_LEVEL,
        // A bearer token in a log file is the same as a bearer token in a repository.
        redact: ['req.headers.authorization', 'req.headers["x-guard-signature"]'],
      },
    }),
  )
  const [first] = apps as [Server, ...Server[]]
  const deps = paymentDeps(options, first.log)
  for (const [i, surface] of surfaces.entries()) {
    await serve(apps[i] as Server, surface, deps, config)
  }

  if (options.sweepMs !== undefined) {
    const timer = setInterval(() => {
      const expired = sweep(deps)
      if (expired > 0) {
        first.log.info({ expired }, 'expired pending intents')
      }
    }, options.sweepMs)
    first.addHook('onClose', async () => clearInterval(timer))
  }
  return apps as [Server, ...Server[]]
}

function paymentDeps(options: ServerDeps, log: FastifyBaseLogger): X402Deps {
  const chains = options.chains ?? new Map<ChainId, ChainAdapter>()
  const usdc = new Map<ChainId, string>()
  for (const chain of chains.keys()) {
    const address = usdcFor(options.config, chain)
    if (address !== undefined) {
      usdc.set(chain, address)
    }
  }
  return {
    db: options.db,
    chains,
    usdc,
    bot: options.bot ?? httpBotNotifier(options.config),
    fetch: options.fetch ?? fetch,
    now: options.now ?? (() => new Date()),
    serial: serial(),
    log,
  }
}

/**
 * Behind Fly's proxy every request comes from the proxy, so the per-IP limit would be one limit
 * for the whole internet. Fly sets Fly-Client-IP to the real address. Only the public listener
 * sits behind that proxy, so only there is the header believed.
 */
function clientIp(surface: Surface): (request: FastifyRequest) => string {
  if (surface !== 'public') {
    return (request) => request.ip
  }
  return (request) => {
    const header = request.headers['fly-client-ip']
    return typeof header === 'string' && isIP(header) !== 0 ? header : request.ip
  }
}

async function serve(app: FastifyInstance, surface: Surface, deps: X402Deps, config: Config) {
  const ipOf = clientIp(surface)
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_PER_IP,
    timeWindow: '1 minute',
    keyGenerator: ipOf,
  })

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

  if (surface !== 'private') {
    app.register(
      agentRoutes(deps, {
        perIp: config.RATE_LIMIT_PER_IP,
        perAgent: config.RATE_LIMIT_PER_AGENT,
        ipOf,
      }),
      { prefix: '/v1/agent' },
    )
  }
  if (surface !== 'public') {
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
  }

  app.get('/health', async () => ({ status: 'ok' }))
}

function issuesOf(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
}

export type Server = FastifyInstance
