import type { PayIntent, Policy } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/domain/policy.js'

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const MERCHANT = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'

const policy: Policy = {
  agentId: 'agent-1',
  chains: [CHAINS.solanaDevnet],
  tokens: [USDC],
  perTxMax: '5000000', // 5 USDC
  dailyMax: '100000000', // 100 USDC
  approvalThreshold: '2000000', // 2 USDC
  allowedRecipients: [MERCHANT],
  allowedDomains: ['api.example.com'],
  paused: false,
}

function intent(overrides: Partial<PayIntent> = {}): PayIntent {
  return {
    id: 'intent-1',
    agentId: 'agent-1',
    kind: 'transfer',
    chain: CHAINS.solanaDevnet,
    token: USDC,
    amount: '1000000', // 1 USDC
    recipient: MERCHANT,
    reason: 'buy a thing',
    status: 'approved',
    rejectReasons: [],
    createdAt: '2026-11-03T00:00:00Z',
    expiresAt: '2026-11-03T00:10:00Z',
    ...overrides,
  }
}

describe('evaluate', () => {
  it('approves a transfer inside every limit', () => {
    expect(evaluate(intent(), policy, '0')).toEqual({ decision: 'approve', reasons: [] })
  })

  it('asks the owner at or above the threshold', () => {
    expect(evaluate(intent({ amount: '2000000' }), policy, '0').decision).toBe('needs_approval')
    expect(evaluate(intent({ amount: '1999999' }), policy, '0').decision).toBe('approve')
  })

  it('rejects when paused', () => {
    expect(evaluate(intent(), { ...policy, paused: true }, '0')).toEqual({
      decision: 'reject',
      reasons: ['PAUSED'],
    })
  })

  it('rejects a chain, token or recipient that is not on the list', () => {
    expect(evaluate(intent({ chain: CHAINS.base }), policy, '0').reasons).toContain(
      'CHAIN_NOT_ALLOWED',
    )
    expect(
      evaluate(intent({ token: 'So11111111111111111111111111111111111111112' }), policy, '0')
        .reasons,
    ).toContain('TOKEN_NOT_ALLOWED')
    expect(evaluate(intent({ recipient: 'attacker' }), policy, '0').reasons).toContain(
      'RECIPIENT_NOT_ALLOWED',
    )
  })

  it('denies every transfer when the recipient list is empty', () => {
    const reasons = evaluate(intent(), { ...policy, allowedRecipients: [] }, '0').reasons
    expect(reasons).toContain('RECIPIENT_NOT_ALLOWED')
  })

  it('vouches for an x402 recipient by domain, not by the recipient list', () => {
    const paid = intent({
      kind: 'x402',
      domain: 'api.example.com',
      recipient: 'whoever-the-402-said',
    })
    expect(evaluate(paid, policy, '0').decision).toBe('approve')
  })

  it('rejects an x402 domain that is not on the list, or missing entirely', () => {
    const wrong = intent({ kind: 'x402', domain: 'evil.example.com' })
    expect(evaluate(wrong, policy, '0').reasons).toContain('DOMAIN_NOT_ALLOWED')

    const missing = intent({ kind: 'x402' })
    expect(evaluate(missing, policy, '0').reasons).toContain('DOMAIN_NOT_ALLOWED')
  })

  it('denies every x402 payment when the domain list is empty', () => {
    const paid = intent({ kind: 'x402', domain: 'api.example.com' })
    expect(evaluate(paid, { ...policy, allowedDomains: [] }, '0').reasons).toContain(
      'DOMAIN_NOT_ALLOWED',
    )
  })

  it('enforces the per-transaction limit at the boundary', () => {
    expect(evaluate(intent({ amount: '5000000' }), policy, '0').reasons).not.toContain(
      'PER_TX_EXCEEDED',
    )
    expect(evaluate(intent({ amount: '5000001' }), policy, '0').reasons).toContain(
      'PER_TX_EXCEEDED',
    )
  })

  it('counts what was already spent today against the daily limit', () => {
    // 99 + 1 lands exactly on the 100 USDC daily max, and 1 USDC is under the 2 USDC threshold.
    expect(evaluate(intent({ amount: '1000000' }), policy, '99000000').decision).toBe('approve')
    expect(evaluate(intent({ amount: '1000001' }), policy, '99000000').reasons).toContain(
      'DAILY_EXCEEDED',
    )
  })

  it('reports every broken rule, not just the first', () => {
    const bad = intent({
      kind: 'x402',
      chain: CHAINS.base,
      token: 'wrong-mint',
      domain: 'evil.example.com',
      amount: '900000000',
    })
    expect(evaluate(bad, { ...policy, paused: true }, '0').reasons).toEqual([
      'PAUSED',
      'CHAIN_NOT_ALLOWED',
      'TOKEN_NOT_ALLOWED',
      'DOMAIN_NOT_ALLOWED',
      'PER_TX_EXCEEDED',
      'DAILY_EXCEEDED',
    ])
  })

  it('never approves on a malformed amount', () => {
    expect(() => evaluate(intent({ amount: '1.5' }), policy, '0')).toThrow(/invalid_amount/)
  })
})
