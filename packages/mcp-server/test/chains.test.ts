import { ADDRESSES, CHAINS } from '@agentguard/shared'
import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { GuardError } from '../src/adapters/guard.js'
import { chainName, usdSymbolFor, usdTokenFor } from '../src/domain/chains.js'
import { checkDefaultChain } from '../src/startup.js'
import { BASE_USDC, fakeGuard } from './support.js'

const BASE_TOKEN = { address: BASE_USDC, symbol: 'USDC' as const }

describe('usdTokenFor', () => {
  it('returns the verified token in shared, with its symbol', () => {
    expect(usdTokenFor(CHAINS.solanaDevnet, BASE_USDC)).toEqual(ADDRESSES[CHAINS.solanaDevnet]?.usd)
    expect(usdTokenFor(CHAINS.baseSepolia, BASE_USDC)).toEqual({
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      symbol: 'USDC',
    })
  })

  it('gives USDG on Robinhood Chain, never BASE_USDC', () => {
    for (const chain of [CHAINS.robinhood, CHAINS.robinhoodTestnet]) {
      const token = usdTokenFor(chain, BASE_USDC)
      expect(token?.symbol).toBe('USDG')
      expect(token?.address).not.toBe(BASE_USDC)
    }
  })

  it('falls back to BASE_USDC as USDC on Base mainnet only', () => {
    expect(usdTokenFor(CHAINS.base, BASE_USDC)).toEqual({ address: BASE_USDC, symbol: 'USDC' })
    expect(usdTokenFor(CHAINS.base, undefined)).toBeUndefined()
    expect(usdTokenFor('eip155:1', BASE_USDC)).toBeUndefined()
    expect(usdTokenFor('solana:unknown', BASE_USDC)).toBeUndefined()
  })
})

describe('usdSymbolFor', () => {
  it('names the dollar of each chain, and falls back to USD for one it does not know', () => {
    expect(usdSymbolFor(CHAINS.robinhoodTestnet)).toBe('USDG')
    expect(usdSymbolFor(CHAINS.solanaMainnet)).toBe('USDC')
    expect(usdSymbolFor(CHAINS.base)).toBe('USDC')
    expect(usdSymbolFor('eip155:1')).toBe('USD')
  })
})

describe('chainName', () => {
  it('names known chains and leaves others as they are', () => {
    expect(chainName(CHAINS.baseSepolia)).toBe('Base Sepolia')
    expect(chainName('eip155:1')).toBe('eip155:1')
  })
})

describe('checkDefaultChain', () => {
  function recorder() {
    const log = pino({ level: 'silent' })
    const warn = vi.spyOn(log, 'warn')
    const info = vi.spyOn(log, 'info')
    return { log, warn, info }
  }

  const budget = (chains?: string[]) => async () => ({
    spentToday: '0',
    dailyMax: '1',
    perTxMax: '1',
    // Deliberately unrelated to `chains`: the check no longer reads balances.
    hotWalletBalances: {},
    paused: false,
    chains,
  })

  it('stays quiet when guard-core reports the chain and its dollar is known', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.baseSepolia]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_TOKEN, log)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when DEFAULT_CHAIN is not among the chains guard-core allows', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.solanaDevnet]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_TOKEN, log)
    expect(warn.mock.calls[0]?.[0]).toEqual({
      chain: CHAINS.baseSepolia,
      allowed: [CHAINS.solanaDevnet],
    })
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/DEFAULT_CHAIN is not a chain guard-core runs/)
  })

  it('skips the check against a guard-core that does not report chains', async () => {
    const { log, warn, info } = recorder()
    await checkDefaultChain(fakeGuard({ budget: budget() }), CHAINS.baseSepolia, BASE_TOKEN, log)
    expect(warn).not.toHaveBeenCalled()
    expect(String(info.mock.calls[0]?.[0])).toMatch(/does not report its chains/)
  })

  it('warns when DEFAULT_CHAIN has no dollar token', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.baseSepolia]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, undefined, log)
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/set BASE_USDC/)
  })

  it('does not stop startup when guard-core is down', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: () => Promise.reject(new GuardError('unreachable', 'down')) })
    await expect(
      checkDefaultChain(guard, CHAINS.solanaDevnet, BASE_TOKEN, log),
    ).resolves.toBeUndefined()
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/could not read the budget/)
  })
})
