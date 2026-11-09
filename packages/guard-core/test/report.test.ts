import { describe, expect, it } from 'vitest'
import { schema } from '../src/db/client.js'
import {
  ADMIN_TOKEN,
  CHAIN,
  harness,
  MERCHANT,
  MINT,
  NOW,
  offer,
  paid,
  paymentRequired,
  type Harness,
} from './harness.js'

const report = (h: Harness, query = '') =>
  h.app.inject({
    method: 'GET',
    url: `/v1/admin/report${query}`,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
  })

const transfer = (h: Harness, amount: string, recipient = MERCHANT) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient,
    reason: 'pay',
  })

async function buy(h: Harness, amount: string) {
  h.fetch.mockImplementation(async (_url, init) =>
    new Headers(init?.headers).has('payment-signature')
      ? paid()
      : paymentRequired([offer({ amount })]),
  )
  return h.agent('POST', '/v1/agent/x402/fetch', {
    agentId: 'agent-1',
    url: 'https://api.example.com/data',
  })
}

describe('GET /v1/admin/report', () => {
  it('sums executed payments, counts refusals by code and splits spend by domain', async () => {
    const h = await harness()
    await transfer(h, '1000000')
    await buy(h, '500000')
    await buy(h, '250000')
    await transfer(h, '1000000', 'NotAllowed11111111111111111111111111111111111')
    await transfer(h, '9000000', 'NotAllowed11111111111111111111111111111111111')

    const res = await report(h)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      agents: [
        {
          agentId: 'agent-1',
          spent: '1750000',
          payments: 3,
          refused: { RECIPIENT_NOT_ALLOWED: 2, PER_TX_EXCEEDED: 1, DAILY_EXCEEDED: 1 },
          domains: [{ domain: 'api.example.com', spent: '750000' }],
        },
      ],
    })
  })

  it('keeps a quiet agent in the report with zeros', async () => {
    const h = await harness()
    expect((await report(h)).json().agents).toEqual([
      { agentId: 'agent-1', spent: '0', payments: 0, refused: {}, domains: [] },
    ])
  })

  it('leaves out a revoked agent with nothing in the period, and keeps one that paid', async () => {
    const h = await harness()
    await transfer(h, '1000000')
    h.db.update(schema.agents).set({ revokedAt: NOW.toISOString() }).run()
    expect((await report(h)).json().agents.map((a: { agentId: string }) => a.agentId)).toEqual([
      'agent-1',
    ])
    h.clock.now = new Date(NOW.getTime() + 8 * 86_400_000)
    expect((await report(h)).json().agents).toEqual([])
  })

  it('counts only what falls in the period, the last seven days by default', async () => {
    const h = await harness()
    await transfer(h, '1000000')
    h.clock.now = new Date(NOW.getTime() + 8 * 86_400_000)
    expect((await report(h)).json().agents[0].payments).toBe(0)
    const from = new Date(NOW.getTime() - 1000).toISOString()
    const to = new Date(NOW.getTime() + 1000).toISOString()
    expect((await report(h, `?from=${from}&to=${to}`)).json().agents[0].payments).toBe(1)
  })

  it.each([
    ['a period that ends before it starts', `?from=${NOW.toISOString()}&to=2026-01-01T00:00:00Z`],
    ['a period over a year', '?from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z'],
    ['a date that is not a date', '?from=yesterday'],
    ['a lone from more than a year back', '?from=2020-01-01T00:00:00Z'],
  ])('refuses %s', async (_case, query) => {
    const h = await harness()
    expect((await report(h, query)).statusCode).toBe(400)
  })
})
