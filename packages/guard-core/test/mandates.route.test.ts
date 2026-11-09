import type { MandateApprovalRequest } from '@agentguard/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMandate } from '../src/db/mandates.js'
import { sweep } from '../src/service/payments.js'
import {
  ADMIN_TOKEN,
  BOT_TOKEN,
  CHAIN,
  harness,
  MERCHANT,
  MINT,
  NOW,
  type Harness,
} from './harness.js'

const open = (h: Harness, overrides: object = {}) =>
  h.agent('POST', '/v1/agent/mandates', {
    agentId: 'agent-1',
    budget: '1500000',
    domains: ['api.example.com'],
    recipients: [MERCHANT],
    ttlSeconds: 3600,
    reason: 'research task',
    ...overrides,
  })

const asAdmin = (h: Harness, url: string, payload: object = {}) =>
  h.app.inject({
    method: 'POST',
    url,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    payload,
  })

const decide = (h: Harness, id: string, decision: 'approve' | 'reject') =>
  h.app.inject({
    method: 'POST',
    url: `/v1/bot/mandates/${id}/decision`,
    headers: { authorization: `Bearer ${BOT_TOKEN}` },
    payload: { decision, telegramUserId: '1' },
  })

const pay = (h: Harness, mandateId?: string, overrides: object = {}) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount: '500000',
    recipient: MERCHANT,
    reason: 'pay the invoice',
    ...(mandateId === undefined ? {} : { mandateId }),
    ...overrides,
  })

let h: Harness
beforeEach(async () => {
  h = await harness()
})

describe('opening a mandate', () => {
  it('starts an agent mandate below the threshold at once, for its ttl', async () => {
    const res = await open(h)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      status: 'active',
      spent: '0',
      expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    })
    expect(h.bot.requestApproval).not.toHaveBeenCalled()
    const budget = (await h.agent('GET', '/v1/agent/budget/agent-1')).json()
    expect(budget.mandates.map((m: { id: string }) => m.id)).toEqual([res.json().id])
  })

  it('asks the owner for one at or above the threshold, with the mandate and no intent', async () => {
    const res = await open(h, { budget: '2000000' })
    expect(res.json().status).toBe('pending_approval')
    const asked = vi.mocked(h.bot.requestApproval).mock.calls[0]?.[0] as MandateApprovalRequest
    expect(asked.mandate.id).toBe(res.json().id)
    expect(asked).not.toHaveProperty('intent')
    expect(asked.simulation.balanceChanges).toEqual([])
    expect(asked.approveBefore).toBe(res.json().expiresAt)
  })

  it("starts the owner's own at once, whatever its size", async () => {
    const res = await asAdmin(h, '/v1/admin/mandates', {
      agentId: 'agent-1',
      budget: '9000000',
      domains: [],
      ttlSeconds: 600,
      reason: 'owner task',
    })
    expect(res.json()).toMatchObject({ status: 'active', recipients: [] })
  })

  it('refuses a mandate wider than the policy, with the codes a payment would get', async () => {
    const res = await open(h, { domains: ['evil.example.com'], budget: '99000000' })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({
      error: 'outside_policy',
      rejectReasons: ['DOMAIN_NOT_ALLOWED', 'DAILY_EXCEEDED'],
    })
  })

  it.each([
    ['a ttl under a minute', { ttlSeconds: 59 }],
    ['a ttl over a day', { ttlSeconds: 86_401 }],
    ['a zero budget', { budget: '0' }],
  ])('refuses %s', async (_case, overrides) => {
    expect((await open(h, overrides)).statusCode).toBe(400)
  })

  it('refuses an agent opening one for another agent', async () => {
    expect((await open(h, { agentId: 'agent-2' })).statusCode).toBe(403)
  })
})

describe("the owner's decision on a mandate", () => {
  it('activates it, with its time starting at the approval', async () => {
    const { id } = (await open(h, { budget: '2000000' })).json()
    h.clock.now = new Date(NOW.getTime() + 60_000)
    const res = await decide(h, id, 'approve')
    expect(res.json()).toMatchObject({
      status: 'active',
      expiresAt: new Date(NOW.getTime() + 60_000 + 3_600_000).toISOString(),
    })
  })

  it('closes it on a rejection, and refuses a second answer', async () => {
    const { id } = (await open(h, { budget: '2000000' })).json()
    expect((await decide(h, id, 'reject')).json().status).toBe('revoked')
    expect((await decide(h, id, 'approve')).statusCode).toBe(409)
  })

  it('answers 410 once the ten minutes are over', async () => {
    const { id } = (await open(h, { budget: '2000000' })).json()
    h.clock.now = new Date(NOW.getTime() + 11 * 60_000)
    const res = await decide(h, id, 'approve')
    expect(res.statusCode).toBe(410)
    expect(res.json()).toEqual({ error: 'expired' })
  })

  it('answers 404 for an unknown mandate', async () => {
    expect((await decide(h, '22222222-2222-4222-8222-222222222222', 'approve')).statusCode).toBe(
      404,
    )
  })
})

describe('paying against a mandate', () => {
  it('counts the payment against it, and marks it exhausted at its budget', async () => {
    const { id } = (await open(h)).json()
    expect((await pay(h, id)).json().status).toBe('executed')
    expect(getMandate(h.db, id)?.spent).toBe('500000')
    expect((await pay(h, id, { amount: '1000000' })).json().status).toBe('executed')
    expect(getMandate(h.db, id)?.status).toBe('exhausted')
    expect((await pay(h, id, { amount: '1' })).json().rejectReasons).toEqual(['MANDATE_EXCEEDED'])
  })

  it('refuses a payment above what is left', async () => {
    const { id } = (await open(h)).json()
    expect((await pay(h, id, { amount: '1500001' })).json().rejectReasons).toEqual([
      'MANDATE_EXCEEDED',
    ])
  })

  it('refuses a recipient the mandate does not name', async () => {
    const { id } = (await open(h, { recipients: [] })).json()
    expect((await pay(h, id)).json().rejectReasons).toEqual(['RECIPIENT_NOT_ALLOWED'])
  })

  it('refuses against a revoked mandate', async () => {
    const { id } = (await open(h)).json()
    const revoked = await asAdmin(h, `/v1/admin/mandates/${id}/revoke`)
    expect(revoked.json().status).toBe('revoked')
    expect((await pay(h, id)).json().rejectReasons).toEqual(['MANDATE_EXPIRED'])
  })

  it('refuses after its time, and the sweep marks it expired', async () => {
    const { id } = (await open(h, { ttlSeconds: 60 })).json()
    h.clock.now = new Date(NOW.getTime() + 61_000)
    expect((await pay(h, id)).json().rejectReasons).toEqual(['MANDATE_EXPIRED'])
    sweep({ ...depsOf(h) })
    expect(getMandate(h.db, id)?.status).toBe('expired')
  })

  it('requires one when the policy says so', async () => {
    const strict = await harness({ policy: { requireMandate: true } })
    expect((await pay(strict)).json().rejectReasons).toEqual(['MANDATE_REQUIRED'])
    const { id } = (await open(strict)).json()
    expect((await pay(strict, id)).json().status).toBe('executed')
  })
})

/** The sweep needs only the database, the clock, the bot and a logger. */
function depsOf(h: Harness) {
  return {
    db: h.db,
    now: () => h.clock.now,
    bot: h.bot,
    log: { warn: vi.fn(), error: vi.fn() },
    chains: new Map(),
    usdc: new Map(),
    serial: <T>(_id: string, run: () => Promise<T>) => run(),
  }
}
