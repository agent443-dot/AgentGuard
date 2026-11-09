import type { PayIntent } from '@agentguard/shared'
import { describe, expect, it } from 'vitest'
import { pinFlags, type Pin } from '../src/domain/pinning.js'
import { CHAIN, MERCHANT, MINT } from './harness.js'

const pin: Pin = { chain: CHAIN, token: MINT, recipient: MERCHANT, amount: '1000000' }

const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
  id: '00000000-0000-4000-8000-000000000000',
  agentId: 'agent-1',
  kind: 'x402',
  domain: 'api.example.com',
  reason: 'GET https://api.example.com/data',
  status: 'rejected',
  rejectReasons: [],
  createdAt: '2026-11-03T12:00:00.000Z',
  expiresAt: '2026-11-03T12:10:00.000Z',
  ...pin,
  ...overrides,
})

describe('pinFlags', () => {
  it('raises nothing for a domain paid for the first time', () => {
    expect(pinFlags(undefined, intent({ amount: '999000000' }), 100)).toEqual([])
  })

  it('raises nothing for the same terms, or a lower price', () => {
    expect(pinFlags(pin, intent(), 100)).toEqual([])
    expect(pinFlags(pin, intent({ amount: '1' }), 100)).toEqual([])
  })

  it.each([
    ['payee', { recipient: 'AttackerPayee1111111111111111111111111111111' }],
    ['chain', { chain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' }],
    ['token', { token: 'So11111111111111111111111111111111111111112' }],
  ])('flags another %s as RECIPIENT_CHANGED', (_case, overrides) => {
    expect(pinFlags(pin, intent(overrides), 100)).toEqual(['RECIPIENT_CHANGED'])
  })

  it('lets the price double at the default 100%, and flags one atomic unit more', () => {
    expect(pinFlags(pin, intent({ amount: '2000000' }), 100)).toEqual([])
    expect(pinFlags(pin, intent({ amount: '2000001' }), 100)).toEqual(['PRICE_JUMP'])
  })

  it('flags any increase at all with 0%', () => {
    expect(pinFlags(pin, intent({ amount: '1000001' }), 0)).toEqual(['PRICE_JUMP'])
  })

  it('raises both flags together', () => {
    const swapped = intent({
      recipient: 'AttackerPayee1111111111111111111111111111111',
      amount: '9000000',
    })
    expect(pinFlags(pin, swapped, 100)).toEqual(['RECIPIENT_CHANGED', 'PRICE_JUMP'])
  })
})
