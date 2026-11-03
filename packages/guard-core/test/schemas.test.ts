import { describe, expect, it } from 'vitest'
import {
  botDecisionRequest,
  policyBody,
  transferRequest,
  x402FetchRequest,
} from '../src/http/schemas.js'

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const CHAIN = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'

describe('x402FetchRequest', () => {
  it('accepts a plain https call and defaults the method', () => {
    const parsed = x402FetchRequest.parse({ agentId: 'a', url: 'https://api.example.com/x' })
    expect(parsed.method).toBe('GET')
  })

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com', 'not a url'])(
    'refuses the url %o',
    (url) => {
      expect(x402FetchRequest.safeParse({ agentId: 'a', url }).success).toBe(false)
    },
  )

  it('refuses a header map large enough to be a flood', () => {
    const headers = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`h${i}`, 'v']))
    const result = x402FetchRequest.safeParse({
      agentId: 'a',
      url: 'https://api.example.com',
      headers,
    })
    expect(result.success).toBe(false)
  })

  it.each(['1.5', '-1', '', '0x10'])('refuses the agent cap %o', (maxAmount) => {
    const result = x402FetchRequest.safeParse({
      agentId: 'a',
      url: 'https://api.example.com',
      maxAmount,
    })
    expect(result.success).toBe(false)
  })
})

describe('transferRequest', () => {
  const valid = {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount: '1000000',
    recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    reason: 'pay the invoice',
  }

  it('accepts a well-formed transfer', () => {
    expect(transferRequest.parse(valid).amount).toBe('1000000')
  })

  it.each(['8453', 'eip155', 'solana:', ':abc', ''])('refuses the chain id %o', (chain) => {
    expect(transferRequest.safeParse({ ...valid, chain }).success).toBe(false)
  })

  it.each(['1.5', '-1', '1e6', '01', ''])('refuses the amount %o', (amount) => {
    expect(transferRequest.safeParse({ ...valid, amount }).success).toBe(false)
  })

  it('refuses an empty recipient', () => {
    expect(transferRequest.safeParse({ ...valid, recipient: '' }).success).toBe(false)
  })

  it('bounds the agent-supplied reason, which the owner has to read', () => {
    expect(transferRequest.safeParse({ ...valid, reason: 'x'.repeat(501) }).success).toBe(false)
  })
})

describe('botDecisionRequest', () => {
  it('accepts an approval', () => {
    const parsed = botDecisionRequest.parse({
      intentId: UUID,
      decision: 'approve',
      telegramUserId: '123',
    })
    expect(parsed.decision).toBe('approve')
  })

  it.each([
    { intentId: 'not-a-uuid', decision: 'approve', telegramUserId: '1' },
    { intentId: UUID, decision: 'maybe', telegramUserId: '1' },
    { intentId: UUID, decision: 'approve', telegramUserId: '' },
  ])('refuses %o', (body) => {
    expect(botDecisionRequest.safeParse(body).success).toBe(false)
  })
})

describe('policyBody', () => {
  const valid = {
    chains: [CHAIN],
    tokens: [MINT],
    perTxMax: '5000000',
    dailyMax: '100000000',
    approvalThreshold: '2000000',
    allowedRecipients: [],
    allowedDomains: ['api.example.com'],
    paused: false,
  }

  it('accepts a policy that denies everything by having empty lists', () => {
    expect(policyBody.parse({ ...valid, allowedDomains: [] }).allowedDomains).toEqual([])
  })

  it('refuses a non-atomic limit', () => {
    expect(policyBody.safeParse({ ...valid, dailyMax: '100.00' }).success).toBe(false)
  })
})
