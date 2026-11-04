import { createHash, timingSafeEqual } from 'node:crypto'
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Logger } from 'pino'
import { hostOf, isLoopback } from './domain/loopback.js'
import type { RateLimiter } from './domain/rate-limit.js'

export interface HttpOptions {
  host: string
  port: number
  token: string
  log: Logger
  /** Checked per client address before anything else, failed logins included. */
  limit: RateLimiter
  /** A fresh MCP server per request: stateless mode shares nothing between callers. */
  newServer: () => McpServer
}

export function startHttp(options: HttpOptions): Promise<Server> {
  const { host, port, token, log, limit, newServer } = options
  const http = createHttpServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      log.error({ err: error }, 'mcp http request failed')
      if (!res.headersSent) {
        reply(res, 500, 'internal_error')
      }
    })
  })

  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (new URL(req.url ?? '/', 'http://local').pathname !== '/mcp') {
      return reply(res, 404, 'not_found')
    }
    // The socket address, never X-Forwarded-For: any client can write that header. Behind a proxy
    // every request shares the proxy's address, so the proxy needs its own limit.
    const decision = limit(req.socket.remoteAddress ?? 'unknown')
    if (!decision.ok) {
      res.setHeader('retry-after', String(decision.retryAfterSeconds))
      return reply(res, 429, 'rate_limited')
    }
    // A browser page can reach a loopback port; checking Host defeats DNS rebinding.
    if (isLoopback(host) && !isLoopback(hostOf(req.headers.host))) {
      return reply(res, 403, 'forbidden_host')
    }
    if (!bearerMatches(req.headers.authorization, token)) {
      return reply(res, 401, 'unauthorized')
    }
    // Stateless: there is no session to stream to or to delete.
    if (req.method !== 'POST') {
      return reply(res, 405, 'method_not_allowed')
    }
    const server = newServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  }

  return new Promise((resolve) => http.listen(port, host, () => resolve(http)))
}

function reply(res: ServerResponse, status: number, error: string) {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({ error }))
}

function bearerMatches(header: string | undefined, expected: string): boolean {
  const presented = /^Bearer (.+)$/.exec(header ?? '')?.[1]
  if (presented === undefined) {
    return false
  }
  // Hashing first gives equal lengths, which timingSafeEqual requires.
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(presented), digest(expected))
}
