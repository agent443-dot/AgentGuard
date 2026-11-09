import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import type { Answers } from '../src/domain/answers.js'
import type { Source } from '../src/domain/env.js'
import {
  cloneCommand,
  dockerignoreGuard,
  finishTasks,
  flyTasks,
  pageTasks,
  pathsFor,
  proxyCommand,
  sshCreateAgent,
  type Setup,
} from '../src/domain/plan.js'
import { HOME, MULTISIG, REPO, RH_HOT, SAFE, SOL_HOT } from './fakes.js'

const answers: Answers = {
  prefix: 'acme',
  org: 'personal',
  region: 'gru',
  networks: ['solana-mainnet', 'robinhood-mainnet'],
  caps: { 'solana-mainnet': '20000000', 'robinhood-mainnet': '5000000' },
  preset: 'careful',
  ownerIds: '111,222',
  agentId: 'agent-1',
}

function setupFor(overrides: Partial<Setup> = {}): Setup {
  return {
    answers,
    paths: pathsFor(HOME, REPO, 'acme'),
    hot: { 'solana-mainnet': SOL_HOT, 'robinhood-mainnet': RH_HOT },
    vaults: { 'solana-mainnet': MULTISIG, 'robinhood-mainnet': SAFE },
    pageUrl: 'https://acme-signing-page.vercel.app',
    ...overrides,
  }
}

const env = (task: { command: { stdin?: unknown } }) => {
  const stdin = task.command.stdin as { env: [string, Source][] }
  return Object.fromEntries(stdin.env)
}

describe('flyTasks', () => {
  const tasks = flyTasks(setupFor())

  it('creates both apps and the volume, then stages the secrets, and deploys nothing', () => {
    expect(tasks.map((task) => [task.command.cmd, ...task.command.args].join(' '))).toEqual([
      'fly apps create acme-guard-core --org personal',
      'fly apps create acme-bot --org personal',
      'fly volumes create guard_data --size 1 --region gru --app acme-guard-core --yes',
      'fly secrets import --app acme-guard-core --stage',
      'fly secrets import --app acme-bot --stage',
    ])
  })

  it("gives guard-core its tokens, each chain's RPC and its hot key by reference", () => {
    expect(env(tasks[3]!)).toEqual({
      ADMIN_TOKEN: { secret: 'ADMIN_TOKEN', from: `${HOME}/.agentguard/acme.env` },
      BOT_TOKEN: { secret: 'BOT_TOKEN', from: `${HOME}/.agentguard/acme.env` },
      BOT_WEBHOOK_SECRET: { secret: 'BOT_WEBHOOK_SECRET', from: `${HOME}/.agentguard/acme.env` },
      SOLANA_CHAIN: { value: CHAINS.solanaMainnet },
      SOLANA_RPC_URL: { secret: 'SOLANA_RPC_URL', from: `${HOME}/.agentguard/acme.env` },
      SOLANA_HOT_WALLET_KEYPAIR_JSON: {
        file: `${HOME}/.agentguard/acme-solana-mainnet-hot.json`,
      },
      ROBINHOOD_CHAIN: { value: CHAINS.robinhood },
      ROBINHOOD_RPC_URL: { secret: 'ROBINHOOD_RPC_URL', from: `${HOME}/.agentguard/acme.env` },
      ROBINHOOD_HOT_WALLET_KEY: { file: `${HOME}/.agentguard/acme-robinhood-mainnet-hot.key` },
    })
  })

  it("gives the bot guard-core's tokens under its own names and the public hot wallet", () => {
    const bot = env(tasks[4]!)
    expect(bot['GUARD_ADMIN_TOKEN']).toEqual({ secret: 'ADMIN_TOKEN', from: expect.any(String) })
    expect(bot['GUARD_BOT_TOKEN']).toEqual({ secret: 'BOT_TOKEN', from: expect.any(String) })
    expect(bot['OWNER_TELEGRAM_IDS']).toEqual({ value: '111,222' })
    expect(bot['SOLANA_HOT_WALLET_PUBKEY']).toEqual({ value: SOL_HOT })
    expect(bot['ROBINHOOD_CHAIN']).toEqual({ value: CHAINS.robinhood })
  })

  it('leaves out a chain that was not chosen', () => {
    const solanaOnly = flyTasks(
      setupFor({
        answers: { ...answers, networks: ['solana-devnet'] },
        hot: { 'solana-devnet': SOL_HOT },
      }),
    )
    const guard = env(solanaOnly[3]!)
    expect(guard['SOLANA_CHAIN']).toEqual({ value: CHAINS.solanaDevnet })
    expect(Object.keys(guard).some((name) => name.startsWith('ROBINHOOD'))).toBe(false)
  })
})

describe('pageTasks', () => {
  it('links, sets each Production variable from stdin, then builds and deploys prebuilt', () => {
    const tasks = pageTasks(setupFor())
    expect(tasks.map((task) => task.id)).toEqual([
      'vercel:link',
      'vercel:env:SOLANA_HOT_WALLET_MAINNET',
      'vercel:env:SOLANA_MAINNET_RPC',
      'vercel:env:ROBINHOOD_HOT_WALLET_MAINNET',
      'vercel:pull',
      'vercel:build',
      'vercel:deploy',
    ])
    for (const task of tasks) {
      expect(task.command.cmd).toBe('npx')
      expect(task.command.args.slice(0, 2)).toEqual(['--yes', 'vercel'])
      expect(task.command.args.slice(-2)).toEqual(['--cwd', 'packages/onchain/web'])
      expect(task.command.cwd).toBe(REPO)
    }
    expect(tasks[0]!.command.args).toContain('acme-signing-page')
    expect(tasks[1]!.command.stdin).toEqual({ raw: { value: SOL_HOT } })
    expect(tasks[2]!.command.stdin).toEqual({
      raw: { secret: 'SOLANA_PAGE_RPC_URL', from: `${HOME}/.agentguard/acme.env` },
    })
    expect(tasks[6]!.command.args).toEqual(
      expect.arrayContaining(['deploy', '--prebuilt', '--prod']),
    )
  })

  it('refuses before the hot wallets are known', () => {
    expect(() => pageTasks(setupFor({ hot: {} }))).toThrow(/hot wallet for Solana/)
  })
})

describe('finishTasks', () => {
  const tasks = finishTasks(setupFor())

  it('stages the vault addresses and the page, then deploys guard-core and the bot once each', () => {
    expect(tasks.map((task) => task.id)).toEqual([
      'fly:vault-secrets:acme-guard-core',
      'fly:vault-secrets:acme-bot',
      'fly:deploy:acme-guard-core',
      'fly:deploy:acme-bot',
    ])
    expect(env(tasks[0]!)).toEqual({
      SQUADS_MULTISIG: { value: MULTISIG },
      ROBINHOOD_SAFE_ADDRESS: { value: SAFE },
    })
    expect(env(tasks[1]!)['SIGN_PAGE_URL']).toEqual({
      value: 'https://acme-signing-page.vercel.app',
    })
  })

  it('deploys from the repository root with the generated config and the package Dockerfile', () => {
    expect(tasks[2]!.command).toEqual({
      cmd: 'fly',
      args: [
        'deploy',
        '.',
        '--config',
        `${HOME}/.agentguard/fly/acme-guard-core.toml`,
        '--dockerfile',
        'packages/guard-core/Dockerfile',
        '--ha=false',
      ],
      cwd: REPO,
    })
    expect(tasks[3]!.command.args).toContain('packages/telegram-bot/Dockerfile')
  })

  it('refuses before the page and the vaults exist', () => {
    expect(() => finishTasks(setupFor({ pageUrl: undefined }))).toThrow(/signing page/)
    expect(() => finishTasks(setupFor({ vaults: {} }))).toThrow(/multisig for Solana/)
  })
})

describe('other commands', () => {
  it('guards against a .env in the build context as the deploy workflow does', () => {
    expect(dockerignoreGuard(setupFor())).toEqual({
      cmd: 'grep',
      args: ['-qx', '\\*\\*/.env', '.dockerignore'],
      cwd: REPO,
    })
  })

  it('proxies the private listener and falls back to create-agent.ts over ssh', () => {
    expect(proxyCommand('acme-guard-core').args).toEqual([
      'proxy',
      '18787:8787',
      '--app',
      'acme-guard-core',
    ])
    const ssh = sshCreateAgent('acme-guard-core', 'agent-1')
    expect(ssh.capture).toBe(true)
    expect(ssh.args.at(-1)).toBe(
      "sh -c 'cd /srv/agentguard/packages/guard-core && node --import tsx src/scripts/create-agent.ts agent-1'",
    )
    expect(cloneCommand('/x/AgentGuard').args).toEqual([
      'clone',
      'https://github.com/agent443-dot/AgentGuard.git',
      '/x/AgentGuard',
    ])
  })
})
