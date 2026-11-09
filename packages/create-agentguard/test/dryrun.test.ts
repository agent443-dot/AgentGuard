import { describe, expect, it } from 'vitest'
import { dryFiles } from '../src/adapters/files.js'
import { dryRunner } from '../src/adapters/runner.js'
import { doctor } from '../src/steps/doctor.js'
import { setup } from '../src/steps/wizard.js'
import { checkoutSeed, fakeHttp, HOME, makeCtx, memoryFiles, scriptedPrompter } from './fakes.js'

function dry(seed = checkoutSeed()) {
  const memory = memoryFiles(seed)
  const said: string[] = []
  const say = (line = '') => void said.push(line)
  const http = fakeHttp(() => ({}))
  const prompt = scriptedPrompter(['acme', '', '', 'solana', '', '', 'standard', '111', ''])
  const { ctx } = makeCtx({
    dry: true,
    files: dryFiles(memory.api, say, HOME),
    run: dryRunner(say, HOME),
    prompt: prompt.prompter,
    http: http.http,
    say,
  })
  return { ctx, said, memory, http, prompt }
}

describe('--dry-run', () => {
  it('prints every command in order, with secrets shown as where they come from', async () => {
    const { ctx, said } = dry()
    await setup(ctx)
    const commands = said.filter((line) => line.startsWith('$ '))
    expect(commands).toEqual([
      '$ git --version',
      '$ fly version',
      '$ fly auth whoami',
      '$ npx --yes vercel whoami',
      '$ fly apps create acme-guard-core --org personal',
      '$ fly apps create acme-bot --org personal',
      '$ fly volumes create guard_data --size 1 --region gru --app acme-guard-core --yes',
      '$ fly secrets import --app acme-guard-core --stage',
      '$ fly secrets import --app acme-bot --stage',
      '$ npx --yes vercel link --yes --project acme-signing-page --cwd packages/onchain/web   (in ~/AgentGuard)',
      '$ npx --yes vercel env add SOLANA_HOT_WALLET_MAINNET production --force --cwd packages/onchain/web   (in ~/AgentGuard)',
      '$ npx --yes vercel env add SOLANA_MAINNET_RPC production --force --cwd packages/onchain/web   (in ~/AgentGuard)',
      '$ npx --yes vercel pull --yes --environment=production --cwd packages/onchain/web   (in ~/AgentGuard)',
      '$ npx --yes vercel build --prod --cwd packages/onchain/web   (in ~/AgentGuard)',
      '$ npx --yes vercel deploy --prebuilt --prod --cwd packages/onchain/web   (in ~/AgentGuard)',
      "$ grep -qx '\\*\\*/.env' .dockerignore   (in ~/AgentGuard)",
      '$ fly secrets import --app acme-guard-core --stage',
      '$ fly secrets import --app acme-bot --stage',
      '$ fly deploy . --config ~/.agentguard/fly/acme-guard-core.toml --dockerfile packages/guard-core/Dockerfile --ha=false   (in ~/AgentGuard)',
      '$ fly deploy . --config ~/.agentguard/fly/acme-bot.toml --dockerfile packages/telegram-bot/Dockerfile --ha=false   (in ~/AgentGuard)',
      '$ fly proxy 18787:8787 --app acme-guard-core',
    ])
    const text = said.join('\n')
    expect(text).toContain('    stdin: ADMIN_TOKEN=<from ~/.agentguard/acme.env>')
    expect(text).toContain(
      '           SOLANA_HOT_WALLET_KEYPAIR_JSON=<from ~/.agentguard/acme-solana-mainnet-hot.json>',
    )
    expect(text).toContain('    stdin: <from ~/.agentguard/acme.env>')
    expect(text).toContain('           SQUADS_MULTISIG=<your Squads multisig>')
    expect(text).toContain(
      '  https://acme-signing-page.vercel.app/?action=add-limit&cluster=mainnet-beta&multisig=%3Cyour+Squads+multisig%3E&amount=20000000',
    )
    expect(text).toMatch(
      /→ PUT http:\/\/127\.0\.0\.1:18787\/v1\/admin\/policy\/agent-1 .*"mode":"shadow"/,
    )
  })

  it('writes nothing, calls nothing, and asks no secret', async () => {
    const { ctx, said, memory, http, prompt } = dry()
    const before = new Map(memory.files)
    await setup(ctx)
    expect(memory.files).toEqual(before)
    expect(memory.dirs.size).toBe(0)
    expect(http.calls).toEqual([])
    expect(prompt.asked.some((question) => question.hidden)).toBe(false)
    expect(said).toContain('  would write ~/.agentguard/acme.env (0600)')
    expect(said).toContain('  would write ~/.agentguard/acme-solana-mainnet-hot.json (0600)')
    expect(said).toContain('  would create ~/.agentguard/ (0700)')
  })

  it('prints the clone when there is no checkout yet', async () => {
    const { ctx, said } = dry({})
    ctx.cwd = '/tmp/elsewhere'
    ctx.prompt = scriptedPrompter([
      '',
      'acme',
      '',
      '',
      'robinhood',
      'yes',
      '1',
      '',
      '111',
      '',
    ]).prompter
    await setup(ctx)
    expect(said).toContain(
      '$ git clone https://github.com/agent443-dot/AgentGuard.git ~/AgentGuard',
    )
    expect(said.join('\n')).toContain('ROBINHOOD_CHAIN=eip155:46630')
  })

  it('finds the checkout above the folder it runs in', async () => {
    const { ctx, said } = dry()
    ctx.cwd = '/home/owner/AgentGuard/packages/create-agentguard'
    await setup(ctx)
    expect(said.some((line) => line.startsWith('$ git clone'))).toBe(false)
    expect(said.some((line) => line.endsWith('   (in ~/AgentGuard)'))).toBe(true)
  })

  it('prints the doctor calls without reading a token', async () => {
    const { ctx, said } = dry({ [`${HOME}/.agentguard/acme.state.json`]: '{"version":1}' })
    expect(await doctor(ctx)).toBe(0)
    expect(said).toContain('$ fly proxy 18787:8787 --app acme-guard-core')
  })
})
