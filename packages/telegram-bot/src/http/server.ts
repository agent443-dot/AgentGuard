import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import type { Logger } from 'pino'
import type { z } from 'zod'
import type { PostResult } from '../bot/desk.js'
import { signatureValid, wellFormed } from '../domain/signature.js'
import { approvalRequest, intentEvent } from './schemas.js'

export interface HookHandlers {
  approvalRequest(request: z.infer<typeof approvalRequest>): Promise<PostResult>
  intentEvent(event: z.infer<typeof intentEvent>): Promise<PostResult>
}

export interface ServerDeps {
  secret: string
  handlers: HookHandlers
  logger: Logger
  /** Per client address. Only guard-core should be calling, so anything near this is not it. */
  rateLimitPerMinute?: number
}

const STATUS: Record<PostResult, number> = {
  accepted: 200,
  duplicate: 409,
  stale: 410,
  undelivered: 502,
}

export async function buildServer({
  secret,
  handlers,
  logger,
  rateLimitPerMinute = 300,
}: ServerDeps) {
  const app = Fastify({ loggerInstance: logger, bodyLimit: 64 * 1024 })

  await app.register(rateLimit, { max: rateLimitPerMinute, timeWindow: '1 minute' })

  // onRequest runs before the body is read: a request with no usable signature never gets that far.
  // A well-formed one still needs the bytes for the HMAC, but they reach no parser until it holds.
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/hooks/') && !wellFormed(request.headers['x-guard-signature'])) {
      return reply.code(401).send({ error: 'bad_signature' })
    }
  })

  // The signature covers the bytes on the wire, so the body must reach the handler unparsed.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) =>
    done(null, body),
  )

  function hook<T>(schema: z.ZodType<T>, handle: (value: T) => Promise<PostResult>) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const raw = typeof request.body === 'string' ? request.body : ''
      // Nothing is parsed before the signature holds: unauthenticated bytes reach no parser.
      if (!signatureValid(raw, secret, request.headers['x-guard-signature'])) {
        return reply.code(401).send({ error: 'bad_signature' })
      }
      const parsed = schema.safeParse(parseJson(raw))
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request' })
      }
      const result = await handle(parsed.data)
      if (result !== 'accepted') {
        request.log.warn({ result }, 'webhook refused')
      }
      return reply.code(STATUS[result]).send({ result })
    }
  }

  app.post('/hooks/approval-request', hook(approvalRequest, handlers.approvalRequest))
  app.post('/hooks/intent-event', hook(intentEvent, handlers.intentEvent))
  app.get('/health', async () => ({ status: 'ok' }))

  return app
}

function parseJson(raw: string): unknown {
  try {
    // eslint-disable-next-line no-restricted-properties -- the result goes straight into zod
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
