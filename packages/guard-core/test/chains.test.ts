import { CHAINS, requireAddress } from '@agentguard/shared'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { buildChains } from '../src/chains.js'
import { loadConfig } from '../src/config.js'

const KEY = `0x${'1'.repeat(64)}`
const dir = mkdtempSync(join(tmpdir(), 'guard-keys-'))
const keyFile = (name: string, contents: string) => {
  const path = join(dir, name)
  writeFileSync(path, contents, { mode: 0o600 })
  return path
}
const KEY_FILE = keyFile('base-hot', `${KEY}\n`)
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
  BASE_HOT_WALLET_KEY_FILE: KEY_FILE,
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

  it('leaves Base off without BASE_CHAIN, even with the hot wallet key file set', async () => {
    const chains = await build({ BASE_HOT_WALLET_KEY_FILE: KEY_FILE, SAFE_ADDRESS: '' })
    expect([...chains.keys()]).toEqual([])
  })

  it('builds the Base adapter on its CAIP-2 id, with an x402 scheme', async () => {
    const chains = await build(baseChain)
    const adapter = chains.get(CHAINS.baseSepolia)
    expect(adapter?.chain).toBe(CHAINS.baseSepolia)
    expect(typeof adapter?.x402Scheme).toBe('function')
  })

  it.each(['BASE_RPC_URL', 'SAFE_ADDRESS', 'BASE_HOT_WALLET_KEY_FILE', 'BASE_USDC'])(
    'refuses to start Base without %s, naming it and never the key',
    async (name) => {
      const error = await build({ ...mainnet, [name]: '' }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(`invalid configuration: ${name}`)
      expect((error as Error).message).not.toContain(KEY)
    },
  )

  it('refuses a malformed key file by its path only', async () => {
    const path = keyFile('bad', `${KEY.slice(0, -2)}zz`)
    const error = await build({ ...baseChain, BASE_HOT_WALLET_KEY_FILE: path }).catch(
      (e: unknown) => e,
    )
    expect((error as Error).message).toBe(`invalid key file: ${path}`)
  })

  it('refuses the retired raw key in the env by name only', () => {
    expect(() => loadConfig({ ...base, ...baseChain, HOT_WALLET_PRIVATE_KEY: KEY })).toThrow(
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

  it('asks about the verified USDC and module on Base Sepolia too', async () => {
    const fetchImpl = node()
    await build(baseChain, fetchImpl)
    expect(askedOf(fetchImpl)).toEqual([
      ['eth_getCode', baseChain.SAFE_ADDRESS],
      ['eth_getCode', requireAddress(CHAINS.baseSepolia, 'usd')],
      ['eth_call', requireAddress(CHAINS.baseSepolia, 'usd')],
      ['eth_getCode', requireAddress(CHAINS.baseSepolia, 'allowanceModule')],
    ])
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

describe('Robinhood Chain (CR-007)', () => {
  const robinhood = {
    ROBINHOOD_CHAIN: CHAINS.robinhoodTestnet,
    ROBINHOOD_RPC_URL: 'https://rpc.testnet.chain.robinhood.com',
    ROBINHOOD_SAFE_ADDRESS: `0x${'d'.repeat(40)}`,
    ROBINHOOD_HOT_WALLET_KEY_FILE: KEY_FILE,
  }
  const USDG = requireAddress(CHAINS.robinhoodTestnet, 'usd')

  it('builds the adapter on eip155:46630 next to Base, each on its own id', async () => {
    const chains = await build({ ...baseChain, ...robinhood })
    expect([...chains.keys()]).toEqual([CHAINS.baseSepolia, CHAINS.robinhoodTestnet])
    expect(chains.get(CHAINS.robinhoodTestnet)?.chain).toBe(CHAINS.robinhoodTestnet)
  })

  it("checks the Safe, shared's USDG with its decimals, and the module against the chain", async () => {
    const fetchImpl = node()
    await build(robinhood, fetchImpl)
    expect(askedOf(fetchImpl)).toEqual([
      ['eth_getCode', robinhood.ROBINHOOD_SAFE_ADDRESS],
      ['eth_getCode', USDG],
      ['eth_call', USDG],
      ['eth_getCode', requireAddress(CHAINS.robinhoodTestnet, 'allowanceModule')],
    ])
  })

  it('takes the dollar from shared alone, so a BASE_USDC cannot reach it', async () => {
    const fetchImpl = node()
    await build({ ...robinhood, BASE_USDC: `0x${'e'.repeat(40)}` }, fetchImpl)
    expect(askedOf(fetchImpl).map(([, address]) => address)).not.toContain(`0x${'e'.repeat(40)}`)
  })

  it('refuses a USDG that does not report 6 decimals, naming the token', async () => {
    await expect(build(robinhood, node({ decimals: 18 }))).rejects.toThrow(
      `shared usd for ${CHAINS.robinhoodTestnet} is not a 6-decimal token, so it is not USDG`,
    )
  })

  it.each(['ROBINHOOD_RPC_URL', 'ROBINHOOD_SAFE_ADDRESS', 'ROBINHOOD_HOT_WALLET_KEY_FILE'])(
    'refuses to start Robinhood Chain without %s',
    async (name) => {
      await expect(build({ ...robinhood, [name]: '' })).rejects.toThrow(
        `invalid configuration: ${name}`,
      )
    },
  )

  it('names the Robinhood RPC when it cannot be reached', async () => {
    await expect(build(robinhood, node({ down: true }))).rejects.toThrow(
      'could not check ROBINHOOD_SAFE_ADDRESS against ROBINHOOD_RPC_URL',
    )
  })
})
