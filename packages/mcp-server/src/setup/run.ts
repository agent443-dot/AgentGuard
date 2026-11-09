import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { GuardError, httpGuard } from '../adapters/guard.js'
import { guardUrl } from '../config.js'
import { formatAmount } from '../domain/usd.js'
import { CLIENTS, type Client, type Launch, renderClient } from './clients.js'

export interface SetupIo {
  ask: (question: string) => Promise<string>
  askSecret: (question: string) => Promise<string>
  writeSecretFile: (path: string, content: string) => void
  out: (text: string) => void
  err: (text: string) => void
  home: string
  launch: Launch
  fetch?: typeof globalThis.fetch
}

const USAGE = `Usage: agentguard-mcp setup <${CLIENTS.join('|')}> [--guard-url URL] [--agent-id ID] [--check]

Prints the command or config block that adds AgentGuard to that MCP client. The agent token is read
from a hidden prompt (or the first line of stdin) and saved to a file only you can read; the config
names that file, never the token. --check calls AgentGuard with these values before printing.`

const agentId = z.string().regex(/^[\w-]{1,64}$/, 'letters, digits, _ and -, at most 64')
const token = z
  .string()
  .regex(/^\S{1,512}$/, 'expected the token guard-core printed, with no spaces')

export async function runSetup(argv: string[], io: SetupIo): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        'guard-url': { type: 'string' },
        'agent-id': { type: 'string' },
        name: { type: 'string', default: 'agentguard' },
        check: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
    })
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  const client = positionals[0]
  if (values.help || !isClient(client) || positionals.length > 1) {
    io.err(USAGE)
    return values.help ? 0 : 2
  }

  const url = guardUrl.safeParse(values['guard-url'] ?? (await io.ask('AgentGuard URL: ')))
  if (!url.success) {
    io.err(`AgentGuard URL: ${url.error.issues[0]?.message ?? 'invalid'}`)
    return 2
  }
  const id = agentId.safeParse(values['agent-id'] ?? (await io.ask('Agent id: ')))
  if (!id.success) {
    io.err(`Agent id: ${id.error.issues[0]?.message ?? 'invalid'}`)
    return 2
  }
  const secret = token.safeParse(await io.askSecret('Agent token (hidden): '))
  if (!secret.success) {
    io.err(`Agent token: ${secret.error.issues[0]?.message ?? 'invalid'}`)
    return 2
  }

  if (values.check) {
    const ok = await check(url.data, id.data, secret.data, io)
    if (!ok) {
      return 1
    }
  }

  const tokenFile = join(io.home, '.agentguard', 'mcp', `${id.data}.token`)
  io.writeSecretFile(tokenFile, secret.data)
  io.err(`Saved the token to ${tokenFile}, readable by you only.`)
  io.out(
    renderClient(client, {
      name: values.name,
      guardUrl: url.data,
      agentId: id.data,
      tokenFile,
      launch: io.launch,
    }),
  )
  return 0
}

function isClient(value: string | undefined): value is Client {
  return CLIENTS.some((client) => client === value)
}

async function check(baseUrl: string, agentId: string, token: string, io: SetupIo) {
  const guard = httpGuard({ baseUrl, agentId, token, fetch: io.fetch, timeoutMs: 15_000 })
  try {
    const budget = await guard.budget()
    io.err(
      `AgentGuard answered: payments ${budget.paused ? 'PAUSED' : 'active'}, ` +
        `${formatAmount(budget.spentToday)} of ${formatAmount(budget.dailyMax)} spent today.`,
    )
    return true
  } catch (error) {
    const reason =
      error instanceof GuardError && error.code === 'unreachable'
        ? `AgentGuard did not answer at ${baseUrl}.`
        : error instanceof GuardError
          ? error.message
          : 'an unexpected error.'
    io.err(`Check failed: ${reason} Nothing was saved.`)
    return false
  }
}
