import {
  buildServer as buildGuard,
  createAgent,
  loadConfig,
  migrateDb,
  openDb,
  StubChain,
} from '@agentguard/guard-core'
import { createServer as createMcp, httpGuard } from '@agentguard/mcp-server'
import type { PayIntent, Policy } from '@agentguard/shared'
import { buildServer as buildBotHooks, httpGuardClient } from '@agentguard/telegram-bot'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { pino } from 'pino'
import { SOLANA, type Net } from './paid-api.js'
import { telegram } from './telegram.js'

const ADMIN_TOKEN = 'a'.repeat(64)
const BOT_TOKEN = 'b'.repeat(64)
export const WEBHOOK_SECRET = 'w'.repeat(64)
const AGENT = 'agent-1'

export const START = new Date('2026-11-03T12:00:00.000Z')

/** 2 USDC needs the owner; 5 USDC is the most one payment may be; 10 USDC a day. */
export function policy(
  overrides: Partial<Policy> = {},
  net: Net = SOLANA,
): Omit<Policy, 'agentId'> {
  return {
    chains: [net.chain],
    tokens: [net.token],
    perTxMax: '5000000',
    dailyMax: '10000000',
    approvalThreshold: '2000000',
    allowedRecipients: [],
    allowedDomains: ['127.0.0.1'],
    paused: false,
    ...overrides,
  }
}

/**
 * guard-core, telegram-bot and mcp-server wired together over real HTTP, as `pnpm dev:all` runs
 * them. Only the chain (a stub that signs nothing) and Telegram (recorded, not sent) are fake, and
 * one clock drives all three so expiry can be tested without waiting.
 */
export async function stack(options: { chain?: StubChain; net?: Net } = {}) {
  const net = options.net ?? SOLANA
  const log = pino({ level: 'silent' })
  const clock = { now: START }
  const now = () => clock.now

  // The bot's hooks have to be listening before guard-core is told where they are, and the bot
  // needs guard-core's address: its handlers are bound once both exist.
  const late: { tg?: ReturnType<typeof telegram> } = {}
  const hooks = await buildBotHooks({
    secret: WEBHOOK_SECRET,
    handlers: {
      approvalRequest: (request) => required(late.tg).desk.post(request),
      intentEvent: (event) => required(late.tg).desk.event(event),
    },
    logger: log,
  })
  const botUrl = await hooks.listen({ port: 0, host: '127.0.0.1' })

  const db = openDb(':memory:')
  migrateDb(db)
  const agentToken = createAgent(db, AGENT)
  const chain = options.chain ?? new StubChain(net.chain, 100_000_000n)
  const guard = await buildGuard({
    db,
    config: loadConfig({
      ADMIN_TOKEN,
      BOT_TOKEN,
      BOT_URL: botUrl,
      BOT_WEBHOOK_SECRET: WEBHOOK_SECRET,
      LOG_LEVEL: 'fatal',
    }),
    chains: new Map([[chain.chain, chain]]),
    now,
    sweepMs: 20,
  })
  const guardUrl = await guard.listen({ port: 0, host: '127.0.0.1' })

  const tg = telegram(
    httpGuardClient({ url: guardUrl, botToken: BOT_TOKEN, adminToken: ADMIN_TOKEN }),
    now,
    log,
  )
  late.tg = tg

  const mcp = createMcp({
    guard: httpGuard({ baseUrl: guardUrl, agentId: AGENT, token: agentToken }),
    log,
    defaultChain: net.chain,
  })
  const client = new Client({ name: 'e2e-agent', version: '0.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([mcp.connect(serverSide), client.connect(clientSide)])

  async function admin(method: 'GET' | 'PUT' | 'POST', path: string, body?: object) {
    const response = await fetch(new URL(path, guardUrl), {
      method,
      headers: {
        authorization: `Bearer ${ADMIN_TOKEN}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: (await response.json()) as unknown }
  }

  return {
    clock,
    chain,
    guardUrl,
    botUrl,
    agentToken,
    telegram: tg,
    admin,
    setPolicy: (overrides: Partial<Policy> = {}) =>
      admin('PUT', `/v1/admin/policy/${AGENT}`, policy(overrides, net)),
    /** Calls an MCP tool the way an agent would, and returns the text it reads back. */
    async tool(name: string, args: Record<string, unknown> = {}) {
      const result = (await client.callTool({ name, arguments: args })) as CallToolResult
      return result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n')
    },
    async intent(id: string): Promise<PayIntent> {
      const response = await fetch(new URL(`/v1/agent/intents/${id}`, guardUrl), {
        headers: { authorization: `Bearer ${agentToken}` },
      })
      return (await response.json()) as PayIntent
    },
    async close() {
      await client.close()
      await guard.close()
      await hooks.close()
    },
  }
}

export type Stack = Awaited<ReturnType<typeof stack>>

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('bot hooks called before the bot was built')
  }
  return value
}

/** The intent id an MCP tool result names, as the agent would read it. */
export function intentIdIn(text: string): string {
  const id = /Intent id: ([0-9a-f-]{36})/.exec(text)?.[1]
  if (id === undefined) {
    throw new Error(`no intent id in: ${text}`)
  }
  return id
}
