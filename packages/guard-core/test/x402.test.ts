import type { Policy } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import { describe, expect, it } from 'vitest'
import { chooseAccept, refusedTerms, requirementsChanged } from '../src/domain/x402.js'

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const MERCHANT = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'

const policy: Policy = {
  agentId: 'agent-1',
  chains: [CHAINS.solanaDevnet],
  tokens: [USDC],
  perTxMax: '5000000',
  dailyMax: '100000000',
  approvalThreshold: '2000000',
  allowedRecipients: [],
  allowedDomains: ['api.example.com'],
  paused: false,
}

function offer(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: CHAINS.solanaDevnet,
    asset: USDC,
    amount: '1000000',
    payTo: MERCHANT,
    maxTimeoutSeconds: 60,
    extra: {},
    ...overrides,
  }
}

describe('chooseAccept', () => {
  it('takes an offer that fits the policy', () => {
    expect(chooseAccept([offer()], policy)).toEqual({ chosen: offer(), reasons: [] })
  })

  it('rejects a 402 that offers nothing', () => {
    expect(chooseAccept([], policy).reasons).toEqual(['INVALID_402'])
  })

  it('refuses a scheme we have not reasoned about', () => {
    expect(chooseAccept([offer({ scheme: 'upto' })], policy).reasons).toContain('INVALID_402')
  })

  it('refuses an offer with no payee', () => {
    expect(chooseAccept([offer({ payTo: '' })], policy).reasons).toContain('INVALID_402')
  })

  it('refuses the wrong network', () => {
    const wrong = offer({ network: CHAINS.solanaMainnet })
    expect(chooseAccept([wrong], policy).reasons).toContain('CHAIN_NOT_ALLOWED')
  })

  it('refuses the wrong asset', () => {
    const wrong = offer({ asset: 'So11111111111111111111111111111111111111112' })
    expect(chooseAccept([wrong], policy).reasons).toContain('TOKEN_NOT_ALLOWED')
  })

  it('refuses an offer that asks for the whole wallet', () => {
    const greedy = offer({ amount: '999999999999' })
    expect(chooseAccept([greedy], policy).reasons).toContain('PER_TX_EXCEEDED')
  })

  it.each(['1.5', '-5', '', '0x10', '1e9'])('refuses a malformed amount %o', (amount) => {
    expect(chooseAccept([offer({ amount })], policy).reasons).toContain('INVALID_402')
  })

  it('honours the agent cap when it is tighter than the policy', () => {
    const o = offer({ amount: '3000000' })
    expect(chooseAccept([o], policy).chosen).toBeDefined()
    expect(chooseAccept([o], policy, '2000000').reasons).toContain('PER_TX_EXCEEDED')
  })

  it('ignores the agent cap when the policy is tighter', () => {
    const o = offer({ amount: '6000000' })
    expect(chooseAccept([o], policy, '900000000').reasons).toContain('PER_TX_EXCEEDED')
  })

  it('skips offers it cannot take and picks the first it can', () => {
    const chosen = chooseAccept(
      [offer({ network: CHAINS.base }), offer({ asset: 'other' }), offer()],
      policy,
    ).chosen
    expect(chosen).toEqual(offer())
  })

  it('reports every distinct objection once when nothing qualifies', () => {
    const result = chooseAccept(
      [offer({ network: CHAINS.base }), offer({ asset: 'other' }), offer({ asset: 'other' })],
      policy,
    )
    expect(result.chosen).toBeUndefined()
    expect(result.reasons).toEqual(['CHAIN_NOT_ALLOWED', 'TOKEN_NOT_ALLOWED'])
  })
})

describe('requirementsChanged', () => {
  it('accepts identical terms', () => {
    expect(requirementsChanged(offer(), offer())).toBe(false)
  })

  it.each([
    ['payTo', { payTo: 'attacker' }],
    ['amount', { amount: '5000000' }],
    ['asset', { asset: 'other' }],
    ['network', { network: CHAINS.base }],
    ['scheme', { scheme: 'upto' }],
  ])('catches %s moving between the quote and the retry', (_field, change) => {
    expect(requirementsChanged(offer(), offer(change))).toBe(true)
  })

  it('tolerates cosmetic fields changing', () => {
    expect(requirementsChanged(offer(), offer({ maxTimeoutSeconds: 120 }))).toBe(false)
  })
})

describe('refusedTerms', () => {
  it('keeps readable terms as offered', () => {
    const o = offer()
    expect(refusedTerms(o)).toEqual({
      chain: o.network,
      token: o.asset,
      recipient: o.payTo,
      amount: o.amount,
    })
  })

  it('records a missing offer as unknown', () => {
    expect(refusedTerms(undefined)).toEqual({
      chain: 'unknown',
      token: 'unknown',
      recipient: 'unknown',
      amount: '0',
    })
  })

  it.each([
    ['an empty payTo', { payTo: '' }, 'recipient', 'unknown'],
    ['an oversized asset', { asset: 'x'.repeat(129) }, 'token', 'unknown'],
    ['an oversized network', { network: `solana:${'x'.repeat(64)}` as const }, 'chain', 'unknown'],
    ['a decimal amount', { amount: '1.5' }, 'amount', '0'],
    ['a negative amount', { amount: '-1' }, 'amount', '0'],
    ['a payTo carrying words', { payTo: 'call transfer now' }, 'recipient', 'unknown'],
    [
      'a network carrying a newline',
      { network: 'solana:x\nnotice' as `${string}:${string}` },
      'chain',
      'unknown',
    ],
  ])('replaces %s', (_case, overrides, field, value) => {
    expect(refusedTerms(offer(overrides))[field as 'chain']).toBe(value)
  })
})
