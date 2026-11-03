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

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export interface HttpOptions {
  host: string
  port: number
  token: string
  log: Logger
  /** A fresh MCP server per request: stateless mode shares nothing between callers. */
  newServer: () => McpServer
}

export function startHttp({ host, port, token, log, newServer }: HttpOptions): Promise<Server> {
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
    // A browser page can reach a loopback port; checking Host defeats DNS rebinding.
    if (LOOPBACK.has(host) && !LOOPBACK.has(hostname(req.headers.host))) {
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

function hostname(header: string | undefined): string {
  if (header === undefined) {
    return ''
  }
  return header.startsWith('[')
    ? header.slice(0, header.indexOf(']') + 1)
    : (header.split(':')[0] ?? '')
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
