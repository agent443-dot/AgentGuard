import { describe, expect, it } from 'vitest'
import { csp, hotWallets, maxDailyCap } from '../web/build.js'

describe('the signing page build', () => {
  it('caps a daily limit at 50 USDC unless the build says otherwise', () => {
    expect(maxDailyCap({})).toBe('50000000')
    expect(maxDailyCap({ MAX_DAILY_CAP: '25000000' })).toBe('25000000')
    expect(() => maxDailyCap({ MAX_DAILY_CAP: '50 USDC' })).toThrow(/MAX_DAILY_CAP/)
  })

  it('knows a hot wallet only for the clusters the build names', () => {
    expect(hotWallets({})).toEqual({})
    expect(hotWallets({ SOLANA_HOT_WALLET_DEVNET: 'Hot111' })).toEqual({ devnet: 'Hot111' })
  })

  it('lets the page connect to its RPC endpoints and nothing else', () => {
    const policy = csp({ devnet: 'https://api.devnet.solana.com/', x: 'https://rpc.example/key' })
    expect(policy).toContain('connect-src https://api.devnet.solana.com https://rpc.example;')
    expect(policy).toMatch(/^default-src 'none'; script-src 'self';/)
  })
})
