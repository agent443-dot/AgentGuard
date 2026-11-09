import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { setup } from '../src/steps/wizard.js'
import {
  checkoutSeed,
  fakeHttp,
  fakeRunner,
  fakeVault,
  HOME,
  makeCtx,
  memoryFiles,
  MULTISIG,
  RH_HOT,
  SAFE,
  scriptedPrompter,
  SOL_HOT,
  type Route,
} from './fakes.js'

const SERVICE = 'f'.repeat(64)
const AGENT = 'c'.repeat(64)
const SECRETS = [SERVICE, AGENT, '123:telegram-secret', 'SOLKEY', 'PAGEKEY', '7,7,7', 'abab']
const page = 'https://acme-signing-page.vercel.app'

const answers = () => [
  ...['acme', '', '', '', '', '', '3', '', '111', ''],
  // The bot token, the two Solana RPC URLs, and the public Robinhood RPC.
  ...['123:telegram-secret', 'https://sol.example/?api-key=SOLKEY'],
  ...['https://page.example/?api-key=PAGEKEY', ''],
  ...['', MULTISIG, SAFE],
]

const route: Route = (method, url) => {
  if (url === `${page}/app.js`) {
    return { text: `const HOT_WALLETS={"mainnet-beta":"${SOL_HOT}"};hot:"${RH_HOT}"` }
  }
  if (method === 'POST' && url.endsWith('/v1/admin/agents')) {
    return { json: { agentId: 'agent-1', token: AGENT } }
  }
  if (method === 'PUT') {
    return { json: { agentId: 'agent-1', mode: 'shadow' } }
  }
  if (url.endsWith('/v1/admin/doctor')) {
    return { json: { checks: [{ id: 'db', status: 'ok', message: 'The database is writable' }] } }
  }
  return {}
}

const caps = (network: string) => (network === 'solana-mainnet' ? 20_000_000n : 3_000_000n)

function wizard(memory = memoryFiles(checkoutSeed()), script = answers()) {
  const runner = fakeRunner(memory.api)
  const prompt = scriptedPrompter(script)
  const http = fakeHttp(route)
  const { ctx, out } = makeCtx({
    files: memory.api,
    run: runner.runner,
    prompt: prompt.prompter,
    http: http.http,
    vault: fakeVault(caps),
  })
  return { ctx, out, memory, runner, prompt, http }
}

const line = (ran: { command: { cmd: string; args: string[] } }) =>
  [ran.command.cmd, ...ran.command.args].join(' ')

describe('the wizard, against fakes', () => {
  it('runs every step in order and deploys only once the vault addresses are staged', async () => {
    const { ctx, runner, prompt } = wizard()
    await setup(ctx)
    expect(prompt.refused).toEqual([])
    const lines = runner.ran.map(line)
    const at = (prefix: string) => lines.findIndex((l) => l.startsWith(prefix))
    expect(at('fly apps create acme-guard-core')).toBeGreaterThan(at('fly auth whoami'))
    expect(at('npx --yes vercel link')).toBeGreaterThan(at('fly secrets import --app acme-bot'))
    const vaultSecrets = lines.lastIndexOf('fly secrets import --app acme-bot --stage')
    expect(at('grep -qx')).toBeGreaterThan(at('npx --yes vercel deploy'))
    expect(at('fly deploy . --config /home/owner/.agentguard/fly/acme-guard-core.toml')).toBe(
      vaultSecrets + 1,
    )
    expect(lines.filter((l) => l.startsWith('fly deploy'))).toHaveLength(2)
    expect(runner.started.map((command) => command.args[0])).toEqual(['proxy'])
    expect(runner.stopped()).toBe(1)
  })

  it('never puts a secret in argv, and pipes each one on stdin', async () => {
    const { ctx, runner } = wizard()
    await setup(ctx)
    for (const ran of runner.ran) {
      for (const secret of SECRETS) {
        expect(line(ran)).not.toContain(secret)
      }
    }
    const guard = runner.ran.find(
      (ran) => line(ran) === 'fly secrets import --app acme-guard-core --stage',
    )
    expect(guard?.stdin).toContain(`ADMIN_TOKEN=${SERVICE}\n`)
    expect(guard?.stdin).toContain(`SOLANA_CHAIN=${CHAINS.solanaMainnet}\n`)
    expect(guard?.stdin).toContain('SOLANA_RPC_URL=https://sol.example/?api-key=SOLKEY\n')
    expect(guard?.stdin).toContain(
      `SOLANA_HOT_WALLET_KEYPAIR_JSON=[${Array(64).fill(7).join(',')}]\n`,
    )
    expect(guard?.stdin).toContain(`ROBINHOOD_HOT_WALLET_KEY=0x${'ab'.repeat(32)}\n`)
    expect(guard?.stdin).toContain('ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com\n')
    const pageRpc = runner.ran.find((ran) => ran.command.args.includes('SOLANA_MAINNET_RPC'))
    expect(pageRpc?.stdin).toBe('https://page.example/?api-key=PAGEKEY')
  })

  it('keeps keys and secrets 0600 in ~/.agentguard and the state free of them', async () => {
    const { ctx, memory, out } = wizard()
    await setup(ctx)
    const dir = `${HOME}/.agentguard`
    expect(memory.dirs.get(dir)).toBe(0o700)
    for (const name of [
      'acme-solana-mainnet-hot.json',
      'acme-robinhood-mainnet-hot.key',
      'acme.env',
    ]) {
      expect(memory.files.get(`${dir}/${name}`)?.mode).toBe(0o600)
    }
    expect(memory.files.get(`${dir}/acme-agent-agent-1.token`)?.contents).toBe(`${AGENT}\n`)
    const state = memory.files.get(`${dir}/acme.state.json`)?.contents ?? ''
    expect(state).toContain(MULTISIG)
    for (const secret of SECRETS) {
      expect(state).not.toContain(secret)
      expect(out.join('\n')).not.toContain(secret)
    }
    expect(out).toContain(`Solana hot wallet: ${SOL_HOT}`)
    expect(out).toContain('  npx @agentguard/mcp-server setup claude-code')
  })

  it('creates the agent and puts the preset policy in shadow mode, within the smallest cap', async () => {
    const { ctx, http } = wizard()
    await setup(ctx)
    const admin = http.calls.filter((call) => call.url.includes('/v1/admin/'))
    expect(admin.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST http://127.0.0.1:18787/v1/admin/agents',
      'PUT http://127.0.0.1:18787/v1/admin/policy/agent-1',
      'GET http://127.0.0.1:18787/v1/admin/doctor',
    ])
    expect(admin.every((call) => call.token === SERVICE)).toBe(true)
    expect(admin[1]?.body).toMatchObject({
      mode: 'shadow',
      perTxMax: '1000000',
      dailyMax: '3000000',
    })
  })

  it('continues where it stopped, without asking or running a done step again', async () => {
    const first = wizard()
    await setup(first.ctx)
    const again = wizard(first.memory, [''])
    await setup(again.ctx)
    expect(again.prompt.asked).toHaveLength(1)
    const lines = again.runner.ran.map(line)
    expect(lines.some((l) => l.startsWith('fly apps create') || l.startsWith('fly deploy'))).toBe(
      false,
    )
    expect(again.http.calls.filter((call) => call.method !== 'GET')).toEqual([])
  })

  it('stops at a page that does not name the hot wallets, and redeploys it on the rerun', async () => {
    const memory = memoryFiles(checkoutSeed())
    const { ctx } = wizard(memory)
    ctx.http = fakeHttp(() => ({ text: 'someone else' })).http
    await expect(setup(ctx)).rejects.toThrow(/does not name the hot wallet/)
    const state = memory.files.get(`${HOME}/.agentguard/acme.state.json`)?.contents ?? ''
    expect(state).not.toContain('vercel:deploy')
    expect(state).toContain('fly:secrets:acme-bot')
  })

  it('times out with a clear message when the cap never shows', async () => {
    const memory = memoryFiles(checkoutSeed())
    const { ctx } = wizard(memory)
    ctx.vault = fakeVault(() => null)
    await expect(setup(ctx)).rejects.toThrow(/no cap showed on the chain within 10 minutes/)
    expect(memory.files.get(`${HOME}/.agentguard/acme.state.json`)?.contents).not.toContain(
      MULTISIG,
    )
  })

  it('refuses a cap that differs from the one chosen', async () => {
    const { ctx } = wizard()
    ctx.vault = fakeVault(() => 1_000_000n)
    await expect(setup(ctx)).rejects.toThrow(/shows a cap of 1 USDC, not 20/)
  })

  it('falls back to create-agent.ts over ssh on a guard-core without the agents route', async () => {
    const memory = memoryFiles(checkoutSeed())
    const runner = fakeRunner(memory.api, (command) =>
      command.args[0] === 'ssh'
        ? `agent agent-1 created. Token, shown once:\n${'d'.repeat(64)}\n`
        : '',
    )
    const { ctx } = wizard(memory)
    ctx.run = runner.runner
    ctx.http = fakeHttp((method, url) =>
      method === 'POST'
        ? { status: 404 }
        : method === 'PUT'
          ? { json: { agentId: 'agent-1' } }
          : route(method, url, undefined),
    ).http
    const out: string[] = []
    ctx.say = (l = '') => void out.push(l)
    await setup(ctx)
    expect(runner.ran.some((ran) => ran.command.args[0] === 'ssh')).toBe(true)
    expect(memory.files.get(`${HOME}/.agentguard/acme-agent-agent-1.token`)?.contents).toBe(
      `${'d'.repeat(64)}\n`,
    )
    expect(out.some((l) => l.includes('predates shadow mode'))).toBe(true)
  })
})
