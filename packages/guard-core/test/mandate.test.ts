import type { Mandate, PayIntent, Policy } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { mandateReasons, outsidePolicy } from '../src/domain/mandate.js'
import { CHAIN, MERCHANT, MINT, NOW, basePolicy } from './harness.js'

const MANDATE_ID = '11111111-1111-4111-8111-111111111111'

const mandate = (overrides: Partial<Mandate> = {}): Mandate => ({
  id: MANDATE_ID,
  agentId: 'agent-1',
  budget: '3000000',
  spent: '0',
  domains: ['api.example.com'],
  recipients: [MERCHANT],
  reason: 'research task',
  status: 'active',
  createdAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
  ...overrides,
})

const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
  id: '00000000-0000-4000-8000-000000000000',
  agentId: 'agent-1',
  kind: 'transfer',
  chain: CHAIN,
  token: MINT,
  amount: '1000000',
  recipient: MERCHANT,
  reason: 'pay',
  status: 'rejected',
  rejectReasons: [],
  createdAt: NOW.toISOString(),
  expiresAt: NOW.toISOString(),
  mandateId: MANDATE_ID,
  ...overrides,
})

const policy: Policy = { agentId: 'agent-1', ...basePolicy }

describe('mandateReasons', () => {
  it('lets a payment with no mandate through unless the policy requires one', () => {
    const { mandateId: _none, ...bare } = intent()
    expect(mandateReasons(bare, undefined, false, NOW)).toEqual([])
    expect(mandateReasons(bare, undefined, true, NOW)).toEqual(['MANDATE_REQUIRED'])
  })

  it("treats an unknown mandate, or another agent's, as none", () => {
    expect(mandateReasons(intent(), undefined, false, NOW)).toEqual(['MANDATE_REQUIRED'])
    expect(mandateReasons(intent(), mandate({ agentId: 'agent-2' }), false, NOW)).toEqual([
      'MANDATE_REQUIRED',
    ])
  })

  it('accepts a payment that fits, up to the last unit of the budget', () => {
    expect(mandateReasons(intent(), mandate(), false, NOW)).toEqual([])
    expect(mandateReasons(intent({ amount: '3000000' }), mandate(), false, NOW)).toEqual([])
  })

  it('refuses one unit over the remaining budget', () => {
    const half = mandate({ spent: '2000000' })
    expect(mandateReasons(intent({ amount: '1000001' }), half, false, NOW)).toEqual([
      'MANDATE_EXCEEDED',
    ])
  })

  it('refuses against a used-up budget as exceeded', () => {
    expect(mandateReasons(intent(), mandate({ status: 'exhausted' }), false, NOW)).toEqual([
      'MANDATE_EXCEEDED',
    ])
  })

  it.each([
    ['pending', { status: 'pending_approval' as const }],
    ['revoked', { status: 'revoked' as const }],
    ['expired', { status: 'expired' as const }],
    ['past its time', { expiresAt: NOW.toISOString() }],
  ])('refuses a mandate that is %s', (_case, overrides) => {
    expect(mandateReasons(intent(), mandate(overrides), false, NOW)).toEqual(['MANDATE_EXPIRED'])
  })

  it('refuses a recipient or a domain outside the mandate', () => {
    const other = intent({ recipient: 'Other1111111111111111111111111111111111111111' })
    expect(mandateReasons(other, mandate(), false, NOW)).toEqual(['RECIPIENT_NOT_ALLOWED'])
    const x402 = intent({ kind: 'x402', domain: 'other.example.com' })
    expect(mandateReasons(x402, mandate(), false, NOW)).toEqual(['DOMAIN_NOT_ALLOWED'])
  })
})

describe('outsidePolicy', () => {
  const terms = { budget: '3000000', domains: ['api.example.com'], recipients: [MERCHANT] }

  it('accepts a mandate that only narrows the policy', () => {
    expect(outsidePolicy(terms, policy)).toEqual([])
  })

  it('refuses what the policy would not allow', () => {
    expect(
      outsidePolicy(
        { budget: '99000000', domains: ['evil.example.com'], recipients: ['Other111'] },
        { ...policy, paused: true },
      ),
    ).toEqual(['PAUSED', 'DOMAIN_NOT_ALLOWED', 'RECIPIENT_NOT_ALLOWED', 'DAILY_EXCEEDED'])
  })
})
