import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const base = {
  GUARD_URL: 'http://localhost:8787',
  AGENT_ID: 'agent-1',
  AGENT_TOKEN: 'secret-agent-token',
}

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base)
    expect(config.MCP_TRANSPORT).toBe('stdio')
    expect(config.MCP_HTTP_HOST).toBe('127.0.0.1')
    expect(config.MCP_HTTP_PORT).toBe(8789)
    expect(config.DEFAULT_CHAIN).toBe(CHAINS.solanaDevnet)
  })

  it.each([
    ['GUARD_URL', { ...base, GUARD_URL: 'ftp://guard' }],
    ['GUARD_URL', { ...base, GUARD_URL: 'not a url' }],
    ['AGENT_ID', { ...base, AGENT_ID: '' }],
    ['AGENT_TOKEN', { GUARD_URL: base.GUARD_URL, AGENT_ID: base.AGENT_ID }],
    ['DEFAULT_CHAIN', { ...base, DEFAULT_CHAIN: 'eip155:1' }],
    ['MCP_HTTP_PORT', { ...base, MCP_HTTP_PORT: '70000' }],
    ['BASE_USDC', { ...base, BASE_USDC: '0x123' }],
  ])('rejects a bad %s', (field, env) => {
    expect(() => loadConfig(env)).toThrow(field)
  })

  it('accepts Base Sepolia as the default chain with a Base USDC address', () => {
    const usdc = '0x' + 'ab'.repeat(20)
    const config = loadConfig({ ...base, DEFAULT_CHAIN: CHAINS.baseSepolia, BASE_USDC: usdc })
    expect(config.DEFAULT_CHAIN).toBe('eip155:84532')
    expect(config.BASE_USDC).toBe(usdc)
  })

  it('requires a long MCP_HTTP_TOKEN for the http transport', () => {
    expect(() => loadConfig({ ...base, MCP_TRANSPORT: 'http' })).toThrow('MCP_HTTP_TOKEN')
    expect(() => loadConfig({ ...base, MCP_TRANSPORT: 'http', MCP_HTTP_TOKEN: 'short' })).toThrow(
      'MCP_HTTP_TOKEN',
    )
    const token = 'x'.repeat(32)
    expect(
      loadConfig({ ...base, MCP_TRANSPORT: 'http', MCP_HTTP_TOKEN: token }).MCP_HTTP_TOKEN,
    ).toBe(token)
  })

  it('keeps HTTP on loopback unless remote binding is opted into', () => {
    const http = { ...base, MCP_TRANSPORT: 'http', MCP_HTTP_TOKEN: 'x'.repeat(32) }
    expect(loadConfig(http).MCP_HTTP_ALLOW_REMOTE).toBe(false)
    expect(() => loadConfig({ ...http, MCP_HTTP_HOST: '0.0.0.0' })).toThrow('MCP_HTTP_ALLOW_REMOTE')
    const remote = loadConfig({ ...http, MCP_HTTP_HOST: '0.0.0.0', MCP_HTTP_ALLOW_REMOTE: 'true' })
    expect(remote.MCP_HTTP_ALLOW_REMOTE).toBe(true)
    expect(() => loadConfig({ ...http, MCP_HTTP_ALLOW_REMOTE: 'yes' })).toThrow(
      'MCP_HTTP_ALLOW_REMOTE',
    )
  })

  it('rate limits at 60 a minute unless told otherwise', () => {
    expect(loadConfig(base).MCP_HTTP_RATE_LIMIT).toBe(60)
    expect(loadConfig({ ...base, MCP_HTTP_RATE_LIMIT: '600' }).MCP_HTTP_RATE_LIMIT).toBe(600)
    expect(() => loadConfig({ ...base, MCP_HTTP_RATE_LIMIT: '0' })).toThrow('MCP_HTTP_RATE_LIMIT')
  })

  it('never puts the token in the error', () => {
    expect(() => loadConfig({ ...base, GUARD_URL: 'bad' })).not.toThrow(base.AGENT_TOKEN)
  })
})
