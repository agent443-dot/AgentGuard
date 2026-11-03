import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/**
 * A scripted agent: it does what a model would do with the tool descriptions, without a model.
 * It starts the MCP server over stdio, checks its budget, pays for one API call and, if the payment
 * needs the owner, polls until the owner decides.
 *
 * Against the mock (`pnpm mock-guard` in another terminal) it runs offline. Against a real
 * guard-core, set GUARD_URL, AGENT_ID, AGENT_TOKEN and DEMO_URL to a real x402 test API.
 */
const env = {
  GUARD_URL: process.env['GUARD_URL'] || 'http://127.0.0.1:8787',
  AGENT_ID: process.env['AGENT_ID'] || 'demo-agent',
  AGENT_TOKEN: process.env['AGENT_TOKEN'] || 'demo-token',
  LOG_LEVEL: 'warn',
}
const url = process.env['DEMO_URL'] || 'http://127.0.0.1:8790/weather'
const maxAmountUsd = process.env['DEMO_MAX_USD'] || '2.50'

const say = (line: string) => process.stdout.write(`${line}\n`)

const client = new Client({ name: 'agentguard-demo-agent', version: '0.1.0' })
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', fileURLToPath(new URL('../../src/main.ts', import.meta.url))],
    env: { ...env, PATH: process.env['PATH'] ?? '' },
  }),
)

async function call(name: string, args: Record<string, unknown> = {}): Promise<string> {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult
  const text = result.content.map((item) => (item.type === 'text' ? item.text : '')).join('\n')
  say(`\n> ${name} ${JSON.stringify(args)}\n${text}`)
  return text
}

await call('get_budget')
const fetched = await call('paid_fetch', { url, maxAmountUsd })

const intentId = /Intent id: (\S+)/.exec(fetched)?.[1]
if (fetched.includes('pending_approval') && intentId !== undefined) {
  say('\n[agent] The payment needs the owner. Telling the user and polling check_intent.')
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 15_000))
    const status = await call('check_intent', { intentId })
    if (!status.includes(': pending_approval.')) {
      break
    }
  }
}

await call('get_budget')
await client.close()
