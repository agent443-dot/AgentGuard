import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { CHAINS } from '@agentguard/shared'
import { pino } from 'pino'
import type { Guard } from '../src/adapters/guard.js'
import { usdTokenFor } from '../src/domain/chains.js'
import { createServer } from '../src/server.js'
import type { ToolDeps } from '../src/tools/deps.js'

export const silent = pino({ level: 'silent' })

// A placeholder, not a real token: only its shape matters to these tests.
export const BASE_USDC = '0x1111111111111111111111111111111111111111'

export function deps(guard: Guard, overrides: Partial<ToolDeps> = {}): ToolDeps {
  return {
    guard,
    log: silent,
    defaultChain: CHAINS.solanaDevnet,
    usd: (chain) => usdTokenFor(chain, BASE_USDC),
    ...overrides,
  }
}

export async function connect(guard: Guard, overrides?: Partial<ToolDeps>): Promise<Client> {
  const server = createServer(deps(guard, overrides))
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test', version: '0' })
  await client.connect(clientSide)
  return client
}

export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult
  const texts = result.content.map((item) => (item.type === 'text' ? item.text : ''))
  return { isError: result.isError === true, texts, text: texts.join('\n') }
}

/** A guard whose every method fails the test unless the test replaces it. */
export function fakeGuard(overrides: Partial<Guard>): Guard {
  const unexpected = () => Promise.reject(new Error('unexpected guard call'))
  return {
    fetch: unexpected,
    transfer: unexpected,
    budget: unexpected,
    intent: unexpected,
    startTask: unexpected,
    ...overrides,
  }
}
