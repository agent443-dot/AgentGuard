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

  it('never puts the token in the error', () => {
    expect(() => loadConfig({ ...base, GUARD_URL: 'bad' })).not.toThrow(base.AGENT_TOKEN)
  })
})
