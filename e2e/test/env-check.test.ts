import { describe, expect, it } from 'vitest'
import { checkEnvs, type Envs } from '../src/env-check.js'

const webhook = 'w'.repeat(64)
const botToken = 'b'.repeat(64)
const adminToken = 'a'.repeat(64)

function envs(): Envs {
  return {
    guard: {
      PORT: '8787',
      BOT_URL: 'http://localhost:8788',
      BOT_WEBHOOK_SECRET: webhook,
      BOT_TOKEN: botToken,
      ADMIN_TOKEN: adminToken,
      GUARD_STUB_CHAINS: 'true',
    },
    bot: {
      PORT: '8788',
      GUARD_URL: 'http://localhost:8787',
      BOT_WEBHOOK_SECRET: webhook,
      GUARD_BOT_TOKEN: botToken,
      GUARD_ADMIN_TOKEN: adminToken,
    },
    mcp: {
      GUARD_URL: 'http://127.0.0.1:8787',
      AGENT_ID: 'agent-1',
      AGENT_TOKEN: 't'.repeat(64),
      MCP_TRANSPORT: 'http',
      MCP_HTTP_TOKEN: 'm'.repeat(64),
    },
  }
}

describe('checkEnvs', () => {
  it('accepts three files that agree, warning only about stub chains', () => {
    expect(checkEnvs(envs())).toEqual({
      errors: [],
      warnings: ['guard-core runs stub chains: nothing is signed and no money moves'],
    })
  })

  it('catches each shared secret that differs or is missing', () => {
    const e = envs()
    e.bot.BOT_WEBHOOK_SECRET = 'x'.repeat(64)
    e.bot.GUARD_BOT_TOKEN = undefined
    e.guard.ADMIN_TOKEN = 'y'.repeat(64)
    expect(checkEnvs(e).errors).toEqual([
      'BOT_WEBHOOK_SECRET differs between guard-core and telegram-bot',
      'guard-core BOT_TOKEN and telegram-bot GUARD_BOT_TOKEN differ',
      'guard-core ADMIN_TOKEN and telegram-bot GUARD_ADMIN_TOKEN differ',
    ])
  })

  it('treats two empty secrets as a mismatch, not a match', () => {
    const e = envs()
    e.guard.BOT_WEBHOOK_SECRET = ''
    e.bot.BOT_WEBHOOK_SECRET = ''
    expect(checkEnvs(e).errors).toContain(
      'BOT_WEBHOOK_SECRET differs between guard-core and telegram-bot',
    )
  })

  it('refuses one token for both the admin and the bot role', () => {
    const e = envs()
    e.guard.BOT_TOKEN = adminToken
    e.bot.GUARD_BOT_TOKEN = adminToken
    expect(checkEnvs(e).errors).toEqual([
      'guard-core ADMIN_TOKEN and BOT_TOKEN are the same token: the roles must not share one',
    ])
  })

  it('catches services pointed at the wrong port', () => {
    const e = envs()
    e.guard.PORT = '9000'
    e.guard.BOT_URL = 'http://localhost:8790'
    expect(checkEnvs(e).errors).toEqual([
      'telegram-bot GUARD_URL does not point at guard-core PORT (9000)',
      'mcp-server GUARD_URL does not point at guard-core PORT (9000)',
      'guard-core BOT_URL does not point at telegram-bot PORT',
    ])
  })

  it('needs the HTTP transport with a token, and an agent', () => {
    const e = envs()
    e.mcp.MCP_HTTP_TOKEN = undefined
    e.mcp.AGENT_TOKEN = undefined
    expect(checkEnvs(e).errors).toEqual([
      'mcp-server MCP_HTTP_TOKEN is not set',
      'mcp-server AGENT_ID or AGENT_TOKEN is not set: create one with pnpm create-agent',
    ])
    e.mcp.MCP_TRANSPORT = 'stdio'
    expect(checkEnvs(e).errors[0]).toBe('mcp-server MCP_TRANSPORT must be http under dev:all')
  })

  it('warns when real chains are on but the Solana adapter cannot be built', () => {
    const e = envs()
    e.guard.GUARD_STUB_CHAINS = 'false'
    e.guard.SOLANA_RPC_URL = 'https://api.devnet.solana.com'
    e.guard.SOLANA_CHAIN = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
    e.mcp.DEFAULT_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    expect(checkEnvs(e).warnings).toEqual([
      'guard-core has no Solana adapter (SOLANA_HOT_WALLET_KEYPAIR, SQUADS_MULTISIG unset): every payment will be refused',
      'mcp-server DEFAULT_CHAIN is not the chain guard-core pays on (SOLANA_CHAIN)',
    ])
  })

  it('reads a default port from the scheme and refuses an unparseable url', () => {
    const e = envs()
    e.guard.PORT = '443'
    e.bot.GUARD_URL = 'https://guard.example.com'
    e.mcp.GUARD_URL = 'not a url'
    expect(checkEnvs(e).errors).toEqual([
      'mcp-server GUARD_URL does not point at guard-core PORT (443)',
    ])
  })

  it('never puts a secret value in a message', () => {
    const e = envs()
    e.bot.BOT_WEBHOOK_SECRET = 'x'.repeat(64)
    const text = JSON.stringify(checkEnvs(e))
    for (const secret of [webhook, botToken, adminToken, 'x'.repeat(64)]) {
      expect(text).not.toContain(secret)
    }
  })
})
