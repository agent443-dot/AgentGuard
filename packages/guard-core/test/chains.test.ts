import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
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

// Base mainnet has no verified address in shared yet, so every Base value there comes from the env.
const mainnet = { ...baseChain, BASE_CHAIN: CHAINS.base, BASE_RPC_URL: 'https://mainnet.base.org' }

/** A Base node where every address holds code and the token reports `decimals`. */
function node(options: { noCodeAt?: string; decimals?: number; down?: boolean } = {}) {
  return vi.fn<typeof fetch>(async (_url, init) => {
    if (options.down) {
      throw new TypeError('fetch failed')
    }
    const { method, params } = JSON.parse(String(init?.body)) as {
      method: string
      params: [unknown]
    }
    const result =
      method === 'eth_getCode'
        ? params[0] === options.noCodeAt
          ? '0x'
          : '0x6080'
        : `0x${(options.decimals ?? 6).toString(16).padStart(64, '0')}`
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }))
  })
}

const build = (env: Record<string, string>, fetchImpl: typeof fetch = node()) =>
  buildChains(loadConfig({ ...base, ...env }), fetchImpl)

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
      const error = await build({ ...mainnet, [name]: '' }).catch((e: unknown) => e)
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

function askedOf(fetchImpl: ReturnType<typeof node>) {
  return fetchImpl.mock.calls.map(([, init]) => {
    const { method, params } = JSON.parse(String(init?.body)) as {
      method: string
      params: unknown[]
    }
    return [method, method === 'eth_call' ? (params[0] as { to: string }).to : params[0]]
  })
}

describe('checking env addresses against the chain before trusting them', () => {
  it('asks for code at the Safe, USDC and module, and USDC decimals', async () => {
    const fetchImpl = node()
    await build(mainnet, fetchImpl)
    expect(askedOf(fetchImpl)).toEqual([
      ['eth_getCode', baseChain.SAFE_ADDRESS],
      ['eth_getCode', baseChain.BASE_USDC],
      ['eth_call', baseChain.BASE_USDC],
      ['eth_getCode', baseChain.BASE_ALLOWANCE_MODULE],
    ])
  })

  it('checks only the Safe on Base Sepolia, where shared has USDC and the module', async () => {
    const fetchImpl = node()
    await build(baseChain, fetchImpl)
    expect(askedOf(fetchImpl)).toEqual([['eth_getCode', baseChain.SAFE_ADDRESS]])
  })

  it.each([
    ['SAFE_ADDRESS', baseChain.SAFE_ADDRESS],
    ['BASE_USDC', baseChain.BASE_USDC],
    ['BASE_ALLOWANCE_MODULE', baseChain.BASE_ALLOWANCE_MODULE],
  ])('refuses %s when no contract lives there', async (name, address) => {
    await expect(build(mainnet, node({ noCodeAt: address }))).rejects.toThrow(
      `${name} has no contract on this chain`,
    )
  })

  it('refuses a token that is not 6 decimals', async () => {
    await expect(build(mainnet, node({ decimals: 18 }))).rejects.toThrow(
      'BASE_USDC is not a 6-decimal token, so it is not USDC',
    )
  })

  it('refuses to start when the node cannot be asked', async () => {
    await expect(build(baseChain, node({ down: true }))).rejects.toThrow(
      'could not check SAFE_ADDRESS against BASE_RPC_URL',
    )
  })
})
