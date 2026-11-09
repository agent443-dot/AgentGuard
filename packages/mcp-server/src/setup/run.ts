import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { CHAINS } from '@agentguard/shared'
import { z } from 'zod'
import { GuardError, httpGuard } from '../adapters/guard.js'
import { guardUrl } from '../config.js'
import { formatAmount } from '../domain/usd.js'
import { CLIENTS, type Client, type Launch, renderClient } from './clients.js'

export interface SetupIo {
  ask: (question: string) => Promise<string>
  askSecret: (question: string) => Promise<string>
  /** False when stdin is a pipe: then only the token comes from it, and nothing is asked. */
  interactive: boolean
  exists: (path: string) => boolean
  writeSecretFile: (path: string, content: string) => void
  out: (text: string) => void
  err: (text: string) => void
  home: string
  launch: Launch
  fetch?: typeof globalThis.fetch
}

const USAGE = `Usage: pnpm --filter @agentguard/mcp-server run setup <${CLIENTS.join('|')}>
  [--guard-url URL] [--agent-id ID] [--chain CAIP-2] [--name NAME] [--check] [--replace]

Prints the command or config block that adds AgentGuard to that MCP client. The agent token is read
from a hidden prompt, or from the first line of stdin with --guard-url and --agent-id given, and
saved to a file only you can read; the config names that file, never the token. --check calls
AgentGuard with these values before saving. --replace overwrites a token already saved for this
agent without asking.`

const agentId = z.string().regex(/^[\w-]{1,64}$/, 'letters, digits, _ and -, at most 64')
// A leading "-" would read as a flag to `claude mcp add`.
const serverName = z
  .string()
  .regex(/^[A-Za-z0-9][\w.-]{0,63}$/, 'letters, digits, _, . and -, not starting with -')
const chain = z.enum(Object.values(CHAINS))
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
        chain: { type: 'string', default: CHAINS.solanaDevnet },
        name: { type: 'string', default: 'agentguard' },
        check: { type: 'boolean', default: false },
        replace: { type: 'boolean', default: false },
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
  if (!io.interactive && (values['guard-url'] === undefined || values['agent-id'] === undefined)) {
    io.err('With the token piped in, pass --guard-url and --agent-id too.')
    return 2
  }

  const name = serverName.safeParse(values.name)
  if (!name.success) {
    io.err(`--name: ${name.error.issues[0]?.message ?? 'invalid'}`)
    return 2
  }
  const defaultChain = chain.safeParse(values.chain)
  if (!defaultChain.success) {
    io.err(`--chain: expected one of ${Object.values(CHAINS).join(', ')}`)
    return 2
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

  const tokenFile = join(io.home, '.agentguard', 'mcp', `${id.data}.token`)
  if (io.exists(tokenFile) && !values.replace && !(await replace(tokenFile, io))) {
    io.err('Kept the saved token. Nothing was changed.')
    return 1
  }

  const secret = token.safeParse(await io.askSecret('Agent token (hidden): '))
  if (!secret.success) {
    io.err(`Agent token: ${secret.error.issues[0]?.message ?? 'invalid'}`)
    return 2
  }
  if (values.check && !(await check(url.data, id.data, secret.data, io))) {
    return 1
  }

  try {
    io.writeSecretFile(tokenFile, secret.data)
  } catch (error) {
    io.err(`Could not save the token: ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }
  io.err(`Saved the token to ${tokenFile}, readable by you only.`)
  io.out(
    renderClient(client, {
      name: name.data,
      guardUrl: url.data,
      agentId: id.data,
      tokenFile,
      defaultChain: defaultChain.data,
      launch: io.launch,
    }),
  )
  return 0
}

function isClient(value: string | undefined): value is Client {
  return CLIENTS.some((client) => client === value)
}

async function replace(tokenFile: string, io: SetupIo): Promise<boolean> {
  if (!io.interactive) {
    io.err(`A token is already saved at ${tokenFile}. Pass --replace to overwrite it.`)
    return false
  }
  const answer = await io.ask(`A token is already saved at ${tokenFile}. Replace it? [y/N] `)
  return /^y(es)?$/i.test(answer)
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
