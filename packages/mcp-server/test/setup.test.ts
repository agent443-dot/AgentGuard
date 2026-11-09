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
  launch: { command: 'npx', args: ['-y', '@agentguard/mcp-server'] },
}

describe('renderClient', () => {
  it('prints the claude mcp add command', () => {
    expect(renderClient('claude-code', values)).toContain(
      'claude mcp add agentguard --scope user -e GUARD_URL=https://guard.example.com ' +
        '-e AGENT_ID=agent-1 -e AGENT_TOKEN_FILE=/home/me/.agentguard/mcp/agent-1.token ' +
        '-- npx -y @agentguard/mcp-server',
    )
  })

  it.each(['claude-desktop', 'cursor'] as const)('prints a JSON block for %s', (client) => {
    const text = renderClient(client, values)
    const config: unknown = JSON.parse(text.slice(text.indexOf('{')))
    expect(config).toEqual({
      mcpServers: {
        agentguard: {
          command: 'npx',
          args: ['-y', '@agentguard/mcp-server'],
          env: {
            GUARD_URL: 'https://guard.example.com',
            AGENT_ID: 'agent-1',
            AGENT_TOKEN_FILE: '/home/me/.agentguard/mcp/agent-1.token',
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
        'AGENT_TOKEN_FILE=/home/me/.agentguard/mcp/agent-1.token npx -y @agentguard/mcp-server',
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
  it('uses npx from the published package', () => {
    expect(launchCommand('file:///x/dist/main.js')).toEqual({
      command: 'npx',
      args: ['-y', '@agentguard/mcp-server'],
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

function fake(answers: string[] = [], secret = TOKEN, fetch?: typeof globalThis.fetch): Fake {
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
    writeSecretFile: (path, content) => files.set(path, content),
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
    const f = fake(['https://guard.example.com', 'agent-1'])
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
    expect(f.err.join('\n')).toContain('Usage: agentguard-mcp setup')
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
      const f = fake([], secret)
      expect(await runSetup(['cursor', ...flags], f.io)).toBe(2)
      expect(f.err.join('\n')).toContain('Agent token')
      expect(f.files.size).toBe(0)
    }
  })

  it('--check reports the budget before saving', async () => {
    const f = fake([], TOKEN, budgetFetch(200))
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(0)
    expect(f.err.join('\n')).toContain('AgentGuard answered: payments active, $1.50 of $20.00')
    expect(f.files.size).toBe(1)
  })

  it('--check saves nothing when AgentGuard refuses the token', async () => {
    const f = fake([], TOKEN, budgetFetch(401))
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(1)
    expect(f.err.join('\n')).toMatch(/Check failed: .* Nothing was saved\./)
    expect(f.files.size).toBe(0)
    expect(f.out).toEqual([])
  })

  it('--check names the URL when AgentGuard does not answer', async () => {
    const down: typeof globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    const f = fake([], TOKEN, down)
    expect(await runSetup(['generic', ...flags, '--check'], f.io)).toBe(1)
    expect(f.err.join('\n')).toContain('AgentGuard did not answer at https://guard.example.com.')
  })
})

it('covers every client', () => {
  for (const client of CLIENTS) {
    expect(renderClient(client, values)).toContain('agent-1.token')
  }
})
