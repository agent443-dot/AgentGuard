import { beforeEach, describe, expect, it } from 'vitest'
import { expirePending } from '../src/service/approvals.js'
import { CHAIN, harness, MERCHANT, MINT, offer, paymentRequired, type Harness } from './harness.js'

let h: Harness
beforeEach(async () => {
  h = await harness()
})

// The SPEC's PayIntent marks domain and txId optional, never null, and the bot's schema refuses a
// null: an owner told "nothing was decided" after a decision was recorded would press again.
function nulls(value: unknown, path = ''): string[] {
  if (value === null) {
    return [path]
  }
  if (typeof value === 'object') {
    return Object.entries(value as object).flatMap(([key, inner]) => nulls(inner, `${path}.${key}`))
  }
  return []
}

describe('POST /v1/bot/decision answers without nulls', () => {
  it('for a rejected x402 payment', async () => {
    h.fetch.mockImplementation(async () => paymentRequired([offer({ amount: '3000000' })]))
    const pending = await h.agent('POST', '/v1/agent/x402/fetch', {
      agentId: 'agent-1',
      url: 'https://api.example.com/data',
    })
    const res = await h.asBot({
      intentId: pending.json().intentId,
      decision: 'reject',
      telegramUserId: '42',
    })
    expect(res.json().status).toBe('rejected')
    expect(nulls(res.json())).toEqual([])
  })

  it('for an approved x402 payment and a rejected transfer', async () => {
    h.fetch.mockImplementation(async () => paymentRequired([offer({ amount: '3000000' })]))
    const x402 = await h.agent('POST', '/v1/agent/x402/fetch', {
      agentId: 'agent-1',
      url: 'https://api.example.com/data',
    })
    const transfer = await h.agent('POST', '/v1/agent/transfer', {
      agentId: 'agent-1',
      chain: CHAIN,
      token: MINT,
      amount: '3000000',
      recipient: MERCHANT,
      reason: 'invoice',
    })
    const approved = await h.asBot({
      intentId: x402.json().intentId,
      decision: 'approve',
      telegramUserId: '42',
    })
    const rejected = await h.asBot({
      intentId: transfer.json().intentId,
      decision: 'reject',
      telegramUserId: '42',
    })
    expect(approved.json().status).toBe('approved')
    expect(rejected.json().status).toBe('rejected')
    expect([...nulls(approved.json()), ...nulls(rejected.json())]).toEqual([])
  })
})

it('tells a late owner the request expired when the sweep got there first', async () => {
  const pending = await h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount: '3000000',
    recipient: MERCHANT,
    reason: 'invoice',
  })
  expirePending(h.db, new Date('2026-11-03T12:11:00Z'))
  const res = await h.asBot({
    intentId: pending.json().intentId,
    decision: 'approve',
    telegramUserId: '42',
  })
  expect(res.statusCode).toBe(409)
  expect(res.json()).toEqual({ error: 'expired' })
  expect(h.chain.sent).toHaveLength(0)
})
