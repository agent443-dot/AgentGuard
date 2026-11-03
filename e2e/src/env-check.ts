/**
 * Cross-checks the three .env files `pnpm dev:all` starts with. Each service validates its own
 * config, but none can see the others', and a mismatch between them fails quietly: an unsigned
 * webhook is a 401 the owner never sees, a wrong token is a refused approval.
 *
 * Problems name variables, never values: the values are secrets.
 */
type Vars<K extends string> = Partial<Record<K, string>>

export type GuardEnv = Vars<
  | 'PORT'
  | 'BOT_URL'
  | 'BOT_WEBHOOK_SECRET'
  | 'BOT_TOKEN'
  | 'ADMIN_TOKEN'
  | 'GUARD_STUB_CHAINS'
  | 'SOLANA_CHAIN'
  | 'SOLANA_RPC_URL'
  | 'SOLANA_HOT_WALLET_KEYPAIR'
  | 'SQUADS_MULTISIG'
>
export type BotEnv = Vars<
  'PORT' | 'GUARD_URL' | 'BOT_WEBHOOK_SECRET' | 'GUARD_BOT_TOKEN' | 'GUARD_ADMIN_TOKEN'
>
export type McpEnv = Vars<
  'GUARD_URL' | 'AGENT_ID' | 'AGENT_TOKEN' | 'MCP_TRANSPORT' | 'MCP_HTTP_TOKEN' | 'DEFAULT_CHAIN'
>

export interface Envs {
  guard: GuardEnv
  bot: BotEnv
  mcp: McpEnv
}

export interface Report {
  errors: string[]
  warnings: string[]
}

const DEFAULT_GUARD_PORT = '8787'
const DEFAULT_BOT_PORT = '8788'

export function checkEnvs({ guard, bot, mcp }: Envs): Report {
  const errors: string[] = []
  const warnings: string[] = []

  const same = (a: string | undefined, b: string | undefined, message: string) => {
    if (!a || a !== b) {
      errors.push(message)
    }
  }
  same(
    guard.BOT_WEBHOOK_SECRET,
    bot.BOT_WEBHOOK_SECRET,
    'BOT_WEBHOOK_SECRET differs between guard-core and telegram-bot',
  )
  same(
    guard.BOT_TOKEN,
    bot.GUARD_BOT_TOKEN,
    'guard-core BOT_TOKEN and telegram-bot GUARD_BOT_TOKEN differ',
  )
  same(
    guard.ADMIN_TOKEN,
    bot.GUARD_ADMIN_TOKEN,
    'guard-core ADMIN_TOKEN and telegram-bot GUARD_ADMIN_TOKEN differ',
  )
  if (guard.ADMIN_TOKEN && guard.ADMIN_TOKEN === guard.BOT_TOKEN) {
    errors.push(
      'guard-core ADMIN_TOKEN and BOT_TOKEN are the same token: the roles must not share one',
    )
  }

  const guardPort = guard.PORT || DEFAULT_GUARD_PORT
  if (port(bot.GUARD_URL) !== guardPort) {
    errors.push(`telegram-bot GUARD_URL does not point at guard-core PORT (${guardPort})`)
  }
  if (port(mcp.GUARD_URL) !== guardPort) {
    errors.push(`mcp-server GUARD_URL does not point at guard-core PORT (${guardPort})`)
  }
  if (port(guard.BOT_URL) !== (bot.PORT || DEFAULT_BOT_PORT)) {
    errors.push('guard-core BOT_URL does not point at telegram-bot PORT')
  }

  // stdio is the agent client's to start; dev:all can only run the HTTP transport.
  if (mcp.MCP_TRANSPORT !== 'http') {
    errors.push('mcp-server MCP_TRANSPORT must be http under dev:all')
  } else if (!mcp.MCP_HTTP_TOKEN) {
    errors.push('mcp-server MCP_HTTP_TOKEN is not set')
  }
  if (!mcp.AGENT_ID || !mcp.AGENT_TOKEN) {
    errors.push('mcp-server AGENT_ID or AGENT_TOKEN is not set: create one with pnpm create-agent')
  }

  if (guard.GUARD_STUB_CHAINS === 'true') {
    warnings.push('guard-core runs stub chains: nothing is signed and no money moves')
  } else {
    const missing = (
      ['SOLANA_RPC_URL', 'SOLANA_HOT_WALLET_KEYPAIR', 'SQUADS_MULTISIG'] as const
    ).filter((name) => !guard[name])
    if (missing.length > 0) {
      warnings.push(
        `guard-core has no Solana adapter (${missing.join(', ')} unset): every payment will be refused`,
      )
    }
    if (mcp.DEFAULT_CHAIN && guard.SOLANA_CHAIN && mcp.DEFAULT_CHAIN !== guard.SOLANA_CHAIN) {
      warnings.push('mcp-server DEFAULT_CHAIN is not the chain guard-core pays on (SOLANA_CHAIN)')
    }
  }

  return { errors, warnings }
}

function port(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  try {
    const parsed = new URL(url)
    return parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
  } catch {
    return undefined
  }
}
