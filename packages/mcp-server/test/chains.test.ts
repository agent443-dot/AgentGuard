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

  it('prefers the verified Base Sepolia USDC in shared over BASE_USDC', () => {
    expect(usdcFor(CHAINS.baseSepolia, BASE_USDC)).toBe(
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    )
  })

  it('falls back to BASE_USDC on Base only', () => {
    expect(usdcFor(CHAINS.base, BASE_USDC)).toBe(BASE_USDC)
    expect(usdcFor('solana:unknown', BASE_USDC)).toBeUndefined()
  })

  it('has nothing for Base without BASE_USDC', () => {
    expect(usdcFor(CHAINS.base, undefined)).toBeUndefined()
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
    return { log, warn }
  }

  const budget = (chains: string[]) => async () => ({
    spentToday: '0',
    dailyMax: '1',
    perTxMax: '1',
    hotWalletBalances: Object.fromEntries(chains.map((chain) => [chain, '0'])),
    paused: false,
  })

  it('stays quiet when guard-core reports the chain and USDC is known', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.baseSepolia]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_USDC, log)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when guard-core does not report DEFAULT_CHAIN', async () => {
    const { log, warn } = recorder()
    const guard = fakeGuard({ budget: budget([CHAINS.solanaDevnet]) })
    await checkDefaultChain(guard, CHAINS.baseSepolia, BASE_USDC, log)
    expect(String(warn.mock.calls[0]?.[1])).toMatch(/no hot wallet balance on DEFAULT_CHAIN/)
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
