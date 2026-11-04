import { ADDRESSES, CHAINS } from '@agentguard/shared'
import { pino } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { GuardError } from '../src/adapters/guard.js'
import { chainName, usdcFor } from '../src/domain/chains.js'
import { checkDefaultChain } from '../src/startup.js'
import { BASE_USDC, fakeGuard } from './support.js'

describe('usdcFor', () => {
  it('prefers the verified address in shared', () => {
    expect(usdcFor(CHAINS.solanaDevnet, BASE_USDC)).toBe(ADDRESSES[CHAINS.solanaDevnet]?.usdc)
  })

  it('falls back to BASE_USDC on Base only', () => {
    expect(usdcFor(CHAINS.baseSepolia, BASE_USDC)).toBe(BASE_USDC)
    expect(usdcFor(CHAINS.base, BASE_USDC)).toBe(BASE_USDC)
    expect(usdcFor('solana:unknown', BASE_USDC)).toBeUndefined()
  })

  it('has nothing for Base without BASE_USDC', () => {
    expect(usdcFor(CHAINS.baseSepolia, undefined)).toBeUndefined()
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

  it('stays quiet when guard-core reports the chain and USDC is known', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.baseSepolia]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_USDC, log)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when DEFAULT_CHAIN is not among the chains guard-core allows', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.solanaDevnet]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_USDC, log)
    expect(warn.mock.calls[0]?.[0]).toEqual({
      chain: CHAINS.baseSepolia,
      allowed: [CHAINS.solanaDevnet],
    })
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/DEFAULT_CHAIN is not a chain guard-core runs/)
  })

  it('skips the check against a guard-core that does not report chains', async () => {
    const { log, warn, info } = recorder()
    await checkDefaultChain(fakeGuard({ budget: budget() }), CHAINS.baseSepolia, BASE_USDC, log)
    expect(warn).not.toHaveBeenCalled()
    expect(String(info.mock.calls[0]?.[0])).toMatch(/does not report its chains/)
  })

  it('warns when DEFAULT_CHAIN has no USDC address', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.baseSepolia]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, undefined, log)
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/set BASE_USDC/)
  })

  it('does not stop startup when guard-core is down', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: () => Promise.reject(new GuardError('unreachable', 'down')) })
    await expect(checkDefaultChain(guard, CHAINS.solanaDevnet, 'x', log)).resolves.toBeUndefined()
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/could not read the budget/)
  })
})
