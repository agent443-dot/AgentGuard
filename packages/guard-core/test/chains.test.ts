import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { buildChains } from '../src/chains.js'
import { loadConfig } from '../src/config.js'

const KEY = `0x${'1'.repeat(64)}`
const base = {
  ADMIN_TOKEN: 'a'.repeat(64),
  BOT_TOKEN: 'b'.repeat(64),
  BOT_URL: 'http://bot.local',
  BOT_WEBHOOK_SECRET: 'c'.repeat(64),
}
const baseChain = {
  BASE_CHAIN: CHAINS.baseSepolia,
  BASE_RPC_URL: 'https://sepolia.base.org',
  SAFE_ADDRESS: `0x${'a'.repeat(40)}`,
  HOT_WALLET_PRIVATE_KEY: KEY,
  BASE_USDC: `0x${'b'.repeat(40)}`,
  BASE_ALLOWANCE_MODULE: `0x${'c'.repeat(40)}`,
}

const build = (env: Record<string, string>) => buildChains(loadConfig({ ...base, ...env }))

describe('buildChains', () => {
  it('builds no chain when none is configured', async () => {
    expect((await build({})).size).toBe(0)
  })

  it('leaves Base off without BASE_CHAIN, even with the hot wallet key in the file', async () => {
    const chains = await build({ HOT_WALLET_PRIVATE_KEY: KEY, SAFE_ADDRESS: '' })
    expect([...chains.keys()]).toEqual([])
  })

  it('builds the Base adapter on its CAIP-2 id, with an x402 scheme', async () => {
    const chains = await build(baseChain)
    const adapter = chains.get(CHAINS.baseSepolia)
    expect(adapter?.chain).toBe(CHAINS.baseSepolia)
    expect(typeof adapter?.x402Scheme).toBe('function')
  })

  it.each(['BASE_RPC_URL', 'SAFE_ADDRESS', 'HOT_WALLET_PRIVATE_KEY', 'BASE_USDC'])(
    'refuses to start Base without %s, naming it and never the key',
    async (name) => {
      const error = await build({ ...baseChain, [name]: '' }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(`invalid configuration: ${name}`)
      expect((error as Error).message).not.toContain(KEY)
    },
  )

  it('refuses a malformed key by name only', () => {
    expect(() => loadConfig({ ...base, ...baseChain, HOT_WALLET_PRIVATE_KEY: '0x12' })).toThrow(
      /^invalid configuration: HOT_WALLET_PRIVATE_KEY$/,
    )
  })

  it('refuses Solana with its key file but no RPC or multisig', async () => {
    await expect(build({ SOLANA_HOT_WALLET_KEYPAIR: '/nowhere.json' })).rejects.toThrow(
      'invalid configuration: SOLANA_RPC_URL, SQUADS_MULTISIG',
    )
  })

  it('treats KEY= in the env file as unset', () => {
    expect(loadConfig({ ...base, SQUADS_MULTISIG: '', BASE_CHAIN: '' }).BASE_CHAIN).toBeUndefined()
  })

  it('runs the stub chain alone when asked to', async () => {
    const chains = await build({ ...baseChain, GUARD_STUB_CHAINS: 'true' })
    expect([...chains.keys()]).toEqual([CHAINS.solanaDevnet])
  })
})
