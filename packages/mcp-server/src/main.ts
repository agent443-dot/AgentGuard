#!/usr/bin/env node
import { homedir } from 'node:os'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { destination, pino } from 'pino'
import { httpGuard } from './adapters/guard.js'
import { loadConfig } from './config.js'
import { rateLimiter } from './domain/rate-limit.js'
import { startHttp } from './http.js'
import { usdTokenFor } from './domain/chains.js'
import { createServer } from './server.js'
import { checkDefaultChain } from './startup.js'
import { runSetup } from './setup/run.js'
import { launchCommand } from './setup/launch.js'
import { ask, askSecret, writeSecretFile } from './setup/terminal.js'
import { withTokenFile } from './token-file.js'

if (process.argv[2] === 'setup') {
  const code = await runSetup(process.argv.slice(3), {
    ask,
    askSecret,
    writeSecretFile,
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    home: homedir(),
    launch: launchCommand(import.meta.url),
  })
  process.exit(code)
}

const config = loadConfig(withTokenFile(process.env))
// stdout carries the MCP protocol in stdio mode, so logs always go to stderr.
const log = pino({ level: config.LOG_LEVEL }, destination(2))

const deps = {
  guard: httpGuard({
    baseUrl: config.GUARD_URL,
    agentId: config.AGENT_ID,
    token: config.AGENT_TOKEN,
  }),
  log,
  defaultChain: config.DEFAULT_CHAIN,
  usd: (chain: string) => usdTokenFor(chain, config.BASE_USDC),
}

await checkDefaultChain(deps.guard, config.DEFAULT_CHAIN, deps.usd(config.DEFAULT_CHAIN), log)

if (config.MCP_TRANSPORT === 'stdio') {
  await createServer(deps).connect(new StdioServerTransport())
  log.info({ agentId: config.AGENT_ID }, 'agentguard mcp server on stdio')
} else {
  const token = config.MCP_HTTP_TOKEN
  if (token === undefined) {
    throw new Error('MCP_HTTP_TOKEN is required when MCP_TRANSPORT=http')
  }
  await startHttp({
    host: config.MCP_HTTP_HOST,
    port: config.MCP_HTTP_PORT,
    token,
    log,
    limit: rateLimiter({ limit: config.MCP_HTTP_RATE_LIMIT, windowMs: 60_000 }),
    newServer: () => createServer(deps),
  })
  log.info(
    { agentId: config.AGENT_ID, port: config.MCP_HTTP_PORT },
    'agentguard mcp server on http',
  )
}
