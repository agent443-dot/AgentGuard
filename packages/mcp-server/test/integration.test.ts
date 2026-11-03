import { request, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { CHAINS } from '@agentguard/shared'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startMockGuard, type MockGuard } from '../examples/mock-guard/server.js'
import { startTestApi } from '../examples/test-api/server.js'
import { httpGuard } from '../src/adapters/guard.js'
import { startHttp } from '../src/http.js'
import { createServer } from '../src/server.js'
import { call, connect, silent } from './support.js'

const RECIPIENT = 'Allowed1111111111111111111111111111111111111'
const MCP_TOKEN = 'm'.repeat(40)

let guard: MockGuard
let api: { url: string; server: Server }
let clock = new Date('2026-11-03T10:00:00Z')

beforeAll(async () => {
  guard = await startMockGuard({
    agentId: 'agent-1',
    token: 'agent-token',
    allowedRecipients: [RECIPIENT],
    approveAfterMs: 60_000,
    now: () => clock,
  })
  api = await startTestApi()
})

afterAll(async () => {
  await guard.close()
  api.server.close()
})

function client() {
  return connect(httpGuard({ baseUrl: guard.url, agentId: 'agent-1', token: 'agent-token' }))
}

describe('against the mock guard-core', () => {
  it('pays for an x402 resource and returns its fenced body', async () => {
    const result = await call(await client(), 'paid_fetch', {
      url: `${api.url}/weather`,
      maxAmountUsd: '0.05',
    })
    expect(result.texts[0]).toMatch(/: executed\./)
    expect(result.texts[1]).toContain('"forecast":"sunny"')
    expect(guard.requests.at(-1)?.body).toMatchObject({
      agentId: 'agent-1',
      maxAmount: '50000',
      method: 'GET',
    })
  })

  it('reports a rejection when the call costs more than the agent allowed', async () => {
    const result = await call(await client(), 'paid_fetch', {
      url: `${api.url}/weather`,
      maxAmountUsd: '0.001',
    })
    expect(result.text).toMatch(/: rejected\./)
    expect(result.text).toMatch(/PER_TX_EXCEEDED/)
  })

  it('follows a transfer from pending_approval to executed', async () => {
    const mcp = await client()
    const sent = await call(mcp, 'transfer', {
      to: RECIPIENT,
      amountUsd: '1.5',
      reason: 'hosting bill',
    })
    const intentId = /Intent id: (\S+)/.exec(sent.text)?.[1] ?? ''
    expect(sent.text).toMatch(/: pending_approval\./)
    expect(guard.intents.get(intentId)).toMatchObject({
      amount: '1500000',
      chain: CHAINS.solanaDevnet,
    })

    expect((await call(mcp, 'check_intent', { intentId })).text).toMatch(/: pending_approval\./)
    clock = new Date(clock.getTime() + 60_000)
    const settled = await call(mcp, 'check_intent', { intentId })
    expect(settled.text).toMatch(/: executed\./)
    expect(settled.text).toMatch(/Transaction id: mock-tx-/)
  })

  it('shows the budget', async () => {
    expect((await call(await client(), 'get_budget')).text).toMatch(
      /Spent today: \$1\.51 of \$5\.00/,
    )
  })

  it('reports bad credentials without leaking them', async () => {
    const mcp = await connect(
      httpGuard({ baseUrl: guard.url, agentId: 'agent-1', token: 'wrong-token' }),
    )
    const result = await call(mcp, 'get_budget')
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/credentials/)
    expect(result.text).not.toContain('wrong-token')
  })
})

describe('streamable HTTP transport', () => {
  let http: Server
  let base: string

  beforeAll(async () => {
    const remote = httpGuard({ baseUrl: guard.url, agentId: 'agent-1', token: 'agent-token' })
    http = await startHttp({
      host: '127.0.0.1',
      port: 0,
      token: MCP_TOKEN,
      log: silent,
      newServer: () =>
        createServer({ guard: remote, log: silent, defaultChain: CHAINS.solanaDevnet }),
    })
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`
  })

  afterAll(() => {
    http.close()
  })

  it('serves the tools to a client with the token', async () => {
    const mcp = new Client({ name: 'http-test', version: '0' })
    await mcp.connect(
      new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${MCP_TOKEN}` } },
      }),
    )
    const { tools } = await mcp.listTools()
    expect(tools).toHaveLength(4)
    expect((await call(mcp, 'get_budget')).text).toMatch(/Payments are active/)
    await mcp.close()
  })

  const init = { jsonrpc: '2.0', id: 1, method: 'ping' }

  it.each([
    ['no token', {}, 401],
    ['a wrong token', { authorization: 'Bearer nope' }, 401],
  ])('refuses a request with %s', async (_name, headers, status) => {
    const response = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(init),
    })
    expect(response.status).toBe(status)
  })

  it('refuses a foreign Host header, which is what DNS rebinding sends', async () => {
    const { port } = http.address() as AddressInfo
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const headers = { host: 'evil.example', authorization: `Bearer ${MCP_TOKEN}` }
      request({ port, method: 'POST', path: '/mcp', headers }, (res) => resolve(res.statusCode))
        .on('error', reject)
        .end(JSON.stringify(init))
    })
    expect(status).toBe(403)
  })

  it('refuses GET in stateless mode and unknown paths', async () => {
    const headers = { authorization: `Bearer ${MCP_TOKEN}` }
    expect((await fetch(`${base}/mcp`, { headers })).status).toBe(405)
    expect((await fetch(`${base}/other`, { headers })).status).toBe(404)
  })
})
