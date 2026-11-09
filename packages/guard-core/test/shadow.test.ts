import { describe, expect, it, vi } from 'vitest'
import { getPin } from '../src/db/pins.js'
import {
  CHAIN,
  harness,
  MERCHANT,
  MINT,
  offer,
  paid,
  paymentRequired,
  spent,
  type Harness,
} from './harness.js'

const transfer = (h: Harness, amount = '1000000', recipient = MERCHANT) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient,
    reason: 'pay the invoice',
  })

const shadow = () => harness({ policy: { mode: 'shadow' } })

describe('shadow mode', () => {
  it('records a payment that would have gone as shadowed, and sends nothing', async () => {
    const h = await shadow()
    const res = await transfer(h)
    expect(res.json()).toMatchObject({ status: 'shadowed', rejectReasons: [] })
    expect(h.chain.sent).toHaveLength(0)
    expect(spent(h.db)).toBe(0n)
    expect(h.auditEvents(res.json().intentId)).toEqual([
      'policy_evaluated',
      'simulated',
      'shadowed',
    ])
    expect(h.bot.intentEvent).not.toHaveBeenCalled()
  })

  it('reports what it would have spent on both budget routes', async () => {
    const h = await shadow()
    await transfer(h, '1000000')
    await transfer(h, '500000')
    const view = (await h.agent('GET', '/v1/agent/budget/agent-1')).json()
    expect(view).toMatchObject({ spentToday: '0', shadowSpentToday: '1500000', mandates: [] })
  })

  it('still refuses what the policy refuses', async () => {
    const h = await shadow()
    const res = await transfer(h, '1000000', 'NotAllowed11111111111111111111111111111111111')
    expect(res.json()).toMatchObject({
      status: 'rejected',
      rejectReasons: ['RECIPIENT_NOT_ALLOWED'],
    })
  })

  it('holds the daily max against what it would have spent', async () => {
    const h = await harness({
      policy: { mode: 'shadow', dailyMax: '2000000', approvalThreshold: '5000000' },
    })
    await transfer(h, '1500000')
    expect((await transfer(h, '1000000')).json().rejectReasons).toEqual(['DAILY_EXCEEDED'])
  })

  it('does not ask the owner, even above the threshold', async () => {
    const h = await shadow()
    expect((await transfer(h, '3000000')).json().status).toBe('shadowed')
    expect(h.bot.requestApproval).not.toHaveBeenCalled()
  })

  it('never trips the breaker, which would pause a real agent over payments that never happened', async () => {
    const h = await harness({ policy: { mode: 'shadow', maxPaymentsPerMinute: 1 } })
    for (let i = 0; i < 3; i++) {
      expect((await transfer(h, '100000')).json().status).toBe('shadowed')
    }
  })

  it('hands an x402 fetch the unpaid 402, without paying or pinning', async () => {
    const h = await shadow()
    h.fetch.mockImplementation(async (_url, init) =>
      new Headers(init?.headers).has('payment-signature') ? paid() : paymentRequired([offer()]),
    )
    const res = await h.agent('POST', '/v1/agent/x402/fetch', {
      agentId: 'agent-1',
      url: 'https://api.example.com/data',
    })
    expect(res.json()).toMatchObject({ status: 'shadowed', response: { status: 402 } })
    expect(h.fetch).toHaveBeenCalledOnce()
    expect(getPin(h.db, 'agent-1', 'api.example.com')).toBeUndefined()
    expect(vi.mocked(h.bot.requestApproval)).not.toHaveBeenCalled()
  })
})
