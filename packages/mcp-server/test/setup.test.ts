import { describe, expect, it } from 'vitest'
import { CLIENTS, quote, renderClient, type SetupValues } from '../src/setup/clients.js'
import { launchCommand } from '../src/setup/launch.js'
import { runSetup, type SetupIo } from '../src/setup/run.js'

const TOKEN = 'agt_secret-token'

const values: SetupValues = {
  name: 'agentguard',
  guardUrl: 'https://guard.example.com',
  agentId: 'agent-1',
  tokenFile: '/home/me/.agentguard/mcp/agent-1.token',
  defaultChain: 'eip155:84532',
  launch: { command: '/repo/node_modules/.bin/tsx', args: ['/repo/src/main.ts'] },
}

describe('renderClient', () => {
  it('prints the claude mcp add command', () => {
    expect(renderClient('claude-code', values)).toContain(
      'claude mcp add agentguard --scope user -e GUARD_URL=https://guard.example.com ' +
        '-e AGENT_ID=agent-1 -e AGENT_TOKEN_FILE=/home/me/.agentguard/mcp/agent-1.token ' +
        '-e DEFAULT_CHAIN=eip155:84532 -- /repo/node_modules/.bin/tsx /repo/src/main.ts',
    )
  })

  it.each(['claude-desktop', 'cursor'] as const)('prints a JSON block for %s', (client) => {
    const text = renderClient(client, values)
    const config: unknown = JSON.parse(text.slice(text.indexOf('{')))
    expect(config).toEqual({
      mcpServers: {
        agentguard: {
          command: '/repo/node_modules/.bin/tsx',
          args: ['/repo/src/main.ts'],
          env: {
            GUARD_URL: 'https://guard.example.com',
            AGENT_ID: 'agent-1',
            AGENT_TOKEN_FILE: '/home/me/.agentguard/mcp/agent-1.token',
            DEFAULT_CHAIN: 'eip155:84532',
          },
        },
      },
    })
  })

  it('names the config files', () => {
    expect(renderClient('claude-desktop', values)).toContain('claude_desktop_config.json')
    expect(renderClient('cursor', values)).toContain('~/.cursor/mcp.json')
  })

  it('prints env assignments and the command for any other client', () => {
    expect(renderClient('generic', values)).toContain(
      'GUARD_URL=https://guard.example.com AGENT_ID=agent-1 ' +
        'AGENT_TOKEN_FILE=/home/me/.agentguard/mcp/agent-1.token DEFAULT_CHAIN=eip155:84532 ' +
        '/repo/node_modules/.bin/tsx /repo/src/main.ts',
    )
  })

  it('quotes paths with spaces for the shell', () => {
    const spaced = { ...values, tokenFile: '/Users/Jo Doe/t' }
    expect(renderClient('claude-code', spaced)).toContain("-e 'AGENT_TOKEN_FILE=/Users/Jo Doe/t'")
    expect(renderClient('generic', spaced)).toContain("AGENT_TOKEN_FILE='/Users/Jo Doe/t'")
  })
})

describe('quote', () => {
  it('leaves plain words alone and single-quotes the rest', () => {
    expect(quote('@agentguard/mcp-server')).toBe('@agentguard/mcp-server')
    expect(quote('a b')).toBe("'a b'")
    expect(quote("it's $HOME")).toBe(`'it'\\''s $HOME'`)
  })
})

describe('launchCommand', () => {
  it('runs a built entry point with node, never a package fetched by name', () => {
    expect(launchCommand('file:///x/dist/main.js')).toEqual({
      command: 'node',
      args: ['/x/dist/main.js'],
    })
  })

  it('uses the checkout tsx and entry point from source', () => {
    expect(launchCommand('file:///repo/pkg/src/main.ts')).toEqual({
      command: '/repo/pkg/node_modules/.bin/tsx',
      args: ['/repo/pkg/src/main.ts'],
    })
  })
})

interface Fake {
  io: SetupIo
  out: string[]
  err: string[]
  files: Map<string, string>
  asked: string[]
}

interface FakeOptions {
  answers?: string[]
  secret?: string
  fetch?: typeof globalThis.fetch
  interactive?: boolean
  saved?: boolean
  failWrite?: boolean
}

function fake({
  answers = [],
  secret = TOKEN,
  fetch,
  interactive = true,
  saved = false,
  failWrite = false,
}: FakeOptions = {}): Fake {
  const out: string[] = []
  const err: string[] = []
  const files = new Map<string, string>()
  const asked: string[] = []
  const io: SetupIo = {
    ask: async (question) => {
      asked.push(question)
      return answers.shift() ?? ''
    },
    askSecret: async () => secret,
    interactive,
    exists: () => saved,
    writeSecretFile: (path, content) => {
      if (failWrite) {
        throw new Error('/home/me/.agentguard is open to other users: run chmod 700 on it')
      }
      files.set(path, content)
    },
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    home: '/home/me',
    launch: values.launch,
    fetch,
  }
  return { io, out, err, files, asked }
}

const flags = ['--guard-url', 'https://guard.example.com', '--agent-id', 'agent-1']

function budgetFetch(status: number): typeof globalThis.fetch {
  return async () =>
    new Response(
      JSON.stringify({ spentToday: '1500000', dailyMax: '20000000', perTxMax: '1', paused: false }),
      { status },
    )
}

describe('runSetup', () => {
  it('saves the token to a file and prints a config that names only the file', async () => {
    const f = fake()
    expect(await runSetup(['cursor', ...flags], f.io)).toBe(0)
    expect(f.files.get('/home/me/.agentguard/mcp/agent-1.token')).toBe(TOKEN)
    expect(f.out.join('\n')).toContain(
      '"AGENT_TOKEN_FILE": "/home/me/.agentguard/mcp/agent-1.token"',
    )
    expect([...f.out, ...f.err].join('\n')).not.toContain(TOKEN)
    expect(f.asked).toEqual([])
  })

  it('asks for what the flags leave out', async () => {
    const f = fake({ answers: ['https://guard.example.com', 'agent-1'] })
    expect(await runSetup(['claude-code'], f.io)).toBe(0)
    expect(f.asked).toEqual(['AgentGuard URL: ', 'Agent id: '])
    expect(f.out.join('\n')).toContain('claude mcp add agentguard')
  })

  it('uses --name for the server entry', async () => {
    const f = fake()
    await runSetup(['claude-code', ...flags, '--name', 'pay'], f.io)
    expect(f.out.join('\n')).toContain('claude mcp add pay ')
  })

  it.each([
    [['vscode', ...flags], 'unknown client'],
    [['cursor', 'extra', ...flags], 'two positionals'],
    [['cursor', '--nope'], 'unknown flag'],
  ])('prints usage and exits 2 on %j (%s)', async (argv) => {
    const f = fake()
    expect(await runSetup(argv, f.io)).toBe(2)
    expect(f.err.join('\n')).toContain('Usage: pnpm --filter @agentguard/mcp-server run setup')
    expect(f.files.size).toBe(0)
  })

  it('exits 0 on --help', async () => {
    expect(await runSetup(['--help'], fake().io)).toBe(0)
  })

  it.each([
    [['cursor', '--guard-url', 'http://guard.example.com', '--agent-id', 'a'], 'AgentGuard URL'],
    [['cursor', '--guard-url', 'https://g.example.com', '--agent-id', 'a b'], 'Agent id'],
  ])('refuses %j', async (argv, field) => {
    const f = fake()
    expect(await runSetup(argv, f.io)).toBe(2)
    expect(f.err.join('\n')).toContain(field)
    expect(f.files.size).toBe(0)
  })

  it('refuses an empty or spaced token without echoing it', async () => {
    for (const secret of ['', 'two words']) {
      const f = fake({ secret })
      expect(await runSetup(['cursor', ...flags], f.io)).toBe(2)
      expect(f.err.join('\n')).toContain('Agent token')
      expect(f.files.size).toBe(0)
    }
  })

  it('--check reports the budget before saving', async () => {
    const f = fake({ fetch: budgetFetch(200) })
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(0)
    expect(f.err.join('\n')).toContain('AgentGuard answered: payments active, $1.50 of $20.00')
    expect(f.files.size).toBe(1)
  })

  it('--check saves nothing when AgentGuard refuses the token', async () => {
    const f = fake({ fetch: budgetFetch(401) })
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(1)
    expect(f.err.join('\n')).toMatch(/Check failed: .* Nothing was saved\./)
    expect(f.files.size).toBe(0)
    expect(f.out).toEqual([])
  })

  it('asks before replacing a saved token, and keeps it on no', async () => {
    const no = fake({ saved: true, answers: ['n'] })
    expect(await runSetup(['cursor', ...flags], no.io)).toBe(1)
    expect(no.asked[0]).toMatch(/already saved .* Replace it\? \[y\/N\]/)
    expect(no.files.size).toBe(0)
    const yes = fake({ saved: true, answers: ['y'] })
    expect(await runSetup(['cursor', ...flags], yes.io)).toBe(0)
    expect(yes.files.size).toBe(1)
  })

  it('needs --replace to overwrite a saved token when piped', async () => {
    const piped = fake({ saved: true, interactive: false })
    expect(await runSetup(['cursor', ...flags], piped.io)).toBe(1)
    expect(piped.err.join('\n')).toContain('Pass --replace')
    const forced = fake({ saved: true, interactive: false })
    expect(await runSetup(['cursor', ...flags, '--replace'], forced.io)).toBe(0)
    expect(forced.files.size).toBe(1)
  })

  it('needs both flags when the token is piped', async () => {
    const f = fake({ interactive: false })
    expect(await runSetup(['cursor', '--agent-id', 'agent-1'], f.io)).toBe(2)
    expect(f.err.join('\n')).toContain('pass --guard-url and --agent-id')
    expect(f.asked).toEqual([])
  })

  it('reports a save that fails and prints no config', async () => {
    const f = fake({ failWrite: true })
    expect(await runSetup(['cursor', ...flags], f.io)).toBe(1)
    expect(f.err.join('\n')).toContain('Could not save the token: /home/me/.agentguard is open')
    expect(f.out).toEqual([])
  })

  it.each([
    [['--name', '-x'], '--name'],
    [['--chain', 'eip155:1'], '--chain'],
  ])('refuses %j', async (extraFlags, field) => {
    const f = fake()
    expect(await runSetup(['claude-code', ...flags, ...extraFlags], f.io)).toBe(2)
    expect(f.err.join('\n')).toContain(field)
  })

  it('defaults the chain to Solana devnet and takes --chain', async () => {
    const f = fake()
    await runSetup(['generic', ...flags], f.io)
    expect(f.out.join('\n')).toContain('DEFAULT_CHAIN=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1')
    const base = fake()
    await runSetup(['generic', ...flags, '--chain', 'eip155:84532'], base.io)
    expect(base.out.join('\n')).toContain('DEFAULT_CHAIN=eip155:84532')
  })

  it('--check names the URL when AgentGuard does not answer', async () => {
    const down: typeof globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    const f = fake({ fetch: down })
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(1)
    expect(f.err.join('\n')).toContain('AgentGuard did not answer at https://guard.example.com.')
  })
})

it('covers every client', () => {
  for (const client of CLIENTS) {
    expect(renderClient(client, values)).toContain('agent-1.token')
  }
})
