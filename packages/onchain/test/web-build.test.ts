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
    const key = '11111111111111111111111111111112'
    expect(hotWallets({ SOLANA_HOT_WALLET_DEVNET: key })).toEqual({ devnet: key })
  })

  it('fails the build on a hot wallet that is not a public key', () => {
    expect(() => hotWallets({ SOLANA_HOT_WALLET_MAINNET: 'Hot111' })).toThrow(
      'the hot wallet for mainnet-beta is not a Solana public key: Hot111',
    )
  })

  it('lets the page connect to its RPC endpoints and nothing else', () => {
    const policy = csp({ devnet: 'https://api.devnet.solana.com/', x: 'https://rpc.example/key' })
    expect(policy).toContain('connect-src https://api.devnet.solana.com https://rpc.example;')
    expect(policy).toMatch(/^default-src 'none'; script-src 'self' 'unsafe-eval';/)
  })

  it("relaxes only script-src, and only by 'unsafe-eval', which Phantom's provider needs", () => {
    const directives = csp({ devnet: 'https://api.devnet.solana.com' }).split('; ')
    expect(directives).toEqual([
      "default-src 'none'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self'",
      'connect-src https://api.devnet.solana.com',
      "img-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
    ])
  })
})
