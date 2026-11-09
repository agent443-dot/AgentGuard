import { appNames, type Answers } from './answers.js'
import type { Command, Task } from './command.js'
import type { Source } from './env.js'
import { WizardError } from './errors.js'
import { NETWORKS, type Family, type NetworkId } from './networks.js'

export const REPO_URL = 'https://github.com/agent443-dot/AgentGuard.git'
export const PROXY_PORT = 18787
const WEB = 'packages/onchain/web'

/** The keys of the wizard's env file, the only place its secrets are kept. */
export const SECRETS = {
  admin: 'ADMIN_TOKEN',
  bot: 'BOT_TOKEN',
  webhook: 'BOT_WEBHOOK_SECRET',
  telegram: 'TELEGRAM_BOT_TOKEN',
  solanaRpc: 'SOLANA_RPC_URL',
  pageRpc: 'SOLANA_PAGE_RPC_URL',
  robinhoodRpc: 'ROBINHOOD_RPC_URL',
} as const

export interface Paths {
  home: string
  dir: string
  envFile: string
  stateFile: string
  flyDir: string
  repo: string
}

export function pathsFor(home: string, repo: string, prefix: string): Paths {
  const dir = `${home}/.agentguard`
  return {
    home,
    dir,
    envFile: `${dir}/${prefix}.env`,
    stateFile: `${dir}/${prefix}.state.json`,
    flyDir: `${dir}/fly`,
    repo,
  }
}

export function keyFile(paths: Paths, prefix: string, network: NetworkId): string {
  const ext = NETWORKS[network].family === 'solana' ? 'json' : 'key'
  return `${paths.dir}/${prefix}-${network}-hot.${ext}`
}

export function agentTokenFile(paths: Paths, prefix: string, agentId: string): string {
  return `${paths.dir}/${prefix}-agent-${agentId}.token`
}

export function flyToml(paths: Paths, app: string): string {
  return `${paths.flyDir}/${app}.toml`
}

export interface Setup {
  answers: Answers
  paths: Paths
  hot: Partial<Record<NetworkId, string>>
  pageUrl?: string
  vaults: Partial<Record<NetworkId, string>>
}

type Entry = [string, Source]

const fly = (args: string[], extra: Partial<Command> = {}): Command => ({
  cmd: 'fly',
  args,
  ...extra,
})

/** The entries for the chosen network of a family, or none when that family is not chosen. */
function forFamily(setup: Setup, family: Family, entries: (network: NetworkId) => Entry[]) {
  const network = setup.answers.networks.find((id) => NETWORKS[id].family === family)
  return network === undefined ? [] : entries(network)
}

function known(values: Partial<Record<NetworkId, string>>, network: NetworkId, what: string) {
  const value = values[network]
  if (value === undefined) {
    throw new WizardError(
      'NOT_SET_UP',
      `the ${what} for ${NETWORKS[network].label} is not known yet`,
    )
  }
  return value
}

function secret(setup: Setup, name: string): Source {
  return { secret: name, from: setup.paths.envFile }
}

function importTask(id: string, app: string, entries: Entry[]): Task {
  return {
    id,
    command: fly(['secrets', 'import', '--app', app, '--stage'], { stdin: { env: entries } }),
  }
}

function guardSecrets(setup: Setup): Entry[] {
  const key = (network: NetworkId): Source => ({
    file: keyFile(setup.paths, setup.answers.prefix, network),
  })
  return [
    [SECRETS.admin, secret(setup, SECRETS.admin)],
    [SECRETS.bot, secret(setup, SECRETS.bot)],
    [SECRETS.webhook, secret(setup, SECRETS.webhook)],
    // SOLANA_CHAIN is set even on mainnet: without it guard-core runs on devnet.
    ...forFamily(setup, 'solana', (network) => [
      ['SOLANA_CHAIN', { value: NETWORKS[network].chain }],
      ['SOLANA_RPC_URL', secret(setup, SECRETS.solanaRpc)],
      ['SOLANA_HOT_WALLET_KEYPAIR_JSON', key(network)],
    ]),
    ...forFamily(setup, 'robinhood', (network) => [
      ['ROBINHOOD_CHAIN', { value: NETWORKS[network].chain }],
      ['ROBINHOOD_RPC_URL', secret(setup, SECRETS.robinhoodRpc)],
      ['ROBINHOOD_HOT_WALLET_KEY', key(network)],
    ]),
  ]
}

function botSecrets(setup: Setup): Entry[] {
  return [
    ['TELEGRAM_BOT_TOKEN', secret(setup, SECRETS.telegram)],
    ['OWNER_TELEGRAM_IDS', { value: setup.answers.ownerIds }],
    ['GUARD_BOT_TOKEN', secret(setup, SECRETS.bot)],
    ['GUARD_ADMIN_TOKEN', secret(setup, SECRETS.admin)],
    [SECRETS.webhook, secret(setup, SECRETS.webhook)],
    ...forFamily(setup, 'solana', (network) => [
      ['SOLANA_CHAIN', { value: NETWORKS[network].chain }],
      ['SOLANA_HOT_WALLET_PUBKEY', { value: known(setup.hot, network, 'hot wallet') }],
    ]),
    ...forFamily(setup, 'robinhood', (network) => [
      ['ROBINHOOD_CHAIN', { value: NETWORKS[network].chain }],
    ]),
  ]
}

function vaultSecrets(setup: Setup): Entry[] {
  return [
    ...forFamily(setup, 'solana', (network) => [
      ['SQUADS_MULTISIG', { value: known(setup.vaults, network, 'multisig') }],
    ]),
    ...forFamily(setup, 'robinhood', (network) => [
      ['ROBINHOOD_SAFE_ADDRESS', { value: known(setup.vaults, network, 'Safe') }],
    ]),
  ]
}

/** The apps, the volume, and every secret known before the vaults exist. Nothing is deployed. */
export function flyTasks(setup: Setup): Task[] {
  const { org, region } = setup.answers
  const apps = appNames(setup.answers.prefix)
  return [
    { id: `fly:create:${apps.guard}`, command: fly(['apps', 'create', apps.guard, '--org', org]) },
    { id: `fly:create:${apps.bot}`, command: fly(['apps', 'create', apps.bot, '--org', org]) },
    {
      id: `fly:volume:${apps.guard}`,
      command: fly([
        'volumes',
        'create',
        'guard_data',
        '--size',
        '1',
        '--region',
        region,
        '--app',
        apps.guard,
        '--yes',
      ]),
    },
    importTask(`fly:secrets:${apps.guard}`, apps.guard, guardSecrets(setup)),
    importTask(`fly:secrets:${apps.bot}`, apps.bot, botSecrets(setup)),
  ]
}

const vercel = (setup: Setup, args: string[], extra: Partial<Command> = {}): Command => ({
  cmd: 'npx',
  args: ['--yes', 'vercel', ...args, '--cwd', WEB],
  cwd: setup.paths.repo,
  ...extra,
})

/**
 * The page is built here and uploaded prebuilt. A CLI deploy uploads only `--cwd`, while the page's
 * vercel.json installs from the repository root, which a remote build of that folder alone cannot
 * reach. The pulled settings hold only what the page shows anyway: the hot wallets and its RPC.
 */
export function pageTasks(setup: Setup): Task[] {
  const vars: Entry[] = setup.answers.networks.flatMap((network) => {
    const { pageHotVar, pageRpcVar } = NETWORKS[network]
    const hot: Entry = [pageHotVar, { value: known(setup.hot, network, 'hot wallet') }]
    return pageRpcVar === undefined ? [hot] : [hot, [pageRpcVar, secret(setup, SECRETS.pageRpc)]]
  })
  const project = appNames(setup.answers.prefix).page
  return [
    { id: 'vercel:link', command: vercel(setup, ['link', '--yes', '--project', project]) },
    ...vars.map(([name, source]) => ({
      id: `vercel:env:${name}`,
      command: vercel(setup, ['env', 'add', name, 'production', '--force'], {
        stdin: { raw: source },
      }),
    })),
    { id: 'vercel:pull', command: vercel(setup, ['pull', '--yes', '--environment=production']) },
    { id: 'vercel:build', command: vercel(setup, ['build', '--prod']) },
    { id: 'vercel:deploy', command: vercel(setup, ['deploy', '--prebuilt', '--prod']) },
  ]
}

/** The same test the deploy workflow runs: no .env may reach Fly's builder. */
export function dockerignoreGuard(setup: Setup): Command {
  return { cmd: 'grep', args: ['-qx', '\\*\\*/.env', '.dockerignore'], cwd: setup.paths.repo }
}

/**
 * The vault addresses and the page, then the one deploy of each app. Deploying earlier would
 * crash-loop: guard-core refuses to start with a chain's hot key but no vault address. Both secret
 * imports are staged, so each app's first deploy starts with every secret in place.
 */
export function finishTasks(setup: Setup): Task[] {
  const apps = appNames(setup.answers.prefix)
  const page = setup.pageUrl
  if (page === undefined) {
    throw new WizardError('NOT_SET_UP', 'the signing page is not deployed yet')
  }
  const deploy = (app: string, pkg: string): Task => ({
    id: `fly:deploy:${app}`,
    command: fly(
      [
        'deploy',
        '.',
        '--config',
        flyToml(setup.paths, app),
        '--dockerfile',
        `packages/${pkg}/Dockerfile`,
        '--ha=false',
      ],
      { cwd: setup.paths.repo },
    ),
  })
  return [
    importTask(`fly:vault-secrets:${apps.guard}`, apps.guard, vaultSecrets(setup)),
    importTask(`fly:vault-secrets:${apps.bot}`, apps.bot, [
      ['SIGN_PAGE_URL', { value: page }],
      ...vaultSecrets(setup),
    ]),
    deploy(apps.guard, 'guard-core'),
    deploy(apps.bot, 'telegram-bot'),
  ]
}

export function proxyCommand(guardApp: string): Command {
  return fly(['proxy', `${PROXY_PORT}:8787`, '--app', guardApp])
}

/** For a guard-core older than SPEC v0.7. The agent id is checked to `[\w-]`, safe inside sh. */
export function sshCreateAgent(guardApp: string, agentId: string): Command {
  const script = `cd /srv/agentguard/packages/guard-core && node --import tsx src/scripts/create-agent.ts ${agentId}`
  return fly(['ssh', 'console', '--app', guardApp, '-C', `sh -c '${script}'`], { capture: true })
}

export function cloneCommand(target: string): Command {
  return { cmd: 'git', args: ['clone', REPO_URL, target] }
}
