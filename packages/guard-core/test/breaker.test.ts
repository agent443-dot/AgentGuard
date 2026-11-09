import { describe, expect, it, vi } from 'vitest'
import { getPolicy } from '../src/db/repo.js'
import { schema } from '../src/db/client.js'
import { harness, MERCHANT, MINT, CHAIN, type Harness } from './harness.js'

const pay = (h: Harness, amount = '100000', recipient = MERCHANT) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient,
    reason: 'pay the invoice',
  })

async function statuses(h: Harness, n: number) {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push((await pay(h)).json().status)
  }
  return out
}

describe('the circuit breaker', () => {
  it('refuses the payment that would exceed the limit, pauses the agent and alerts the owner', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 2 } })
    expect(await statuses(h, 2)).toEqual(['executed', 'executed'])
    const third = await pay(h)
    expect(third.json()).toMatchObject({ status: 'rejected', rejectReasons: ['BREAKER_TRIPPED'] })
    expect(getPolicy(h.db, 'agent-1')?.paused).toBe(true)
    expect(h.auditEvents(third.json().intentId)).toContain('breaker_tripped')
    expect(h.chain.sent).toHaveLength(2)
    await vi.waitFor(() => expect(h.bot.alert).toHaveBeenCalledOnce())
    expect(vi.mocked(h.bot.alert).mock.calls[0]?.[0]).toMatchObject({
      kind: 'breaker_tripped',
      agentId: 'agent-1',
    })
  })

  it('stays tripped until the owner resumes the agent', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 1 } })
    await statuses(h, 2)
    h.clock.now = new Date(h.clock.now.getTime() + 120_000)
    expect((await pay(h)).json().rejectReasons).toEqual(['PAUSED'])
  })

  it('counts a rolling minute, so the next minute starts afresh', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 2 } })
    expect(await statuses(h, 2)).toEqual(['executed', 'executed'])
    h.clock.now = new Date(h.clock.now.getTime() + 61_000)
    expect(await statuses(h, 2)).toEqual(['executed', 'executed'])
  })

  it('keeps the window in the database, so a restart does not reset it', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 5 } })
    await statuses(h, 3)
    expect(h.db.select().from(schema.clearedPayments).all()).toHaveLength(3)
  })

  it('does not count payments the policy refused', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 2 } })
    for (let i = 0; i < 5; i++) {
      await pay(h, '100000', 'NotAllowed11111111111111111111111111111111111')
    }
    expect(await statuses(h, 2)).toEqual(['executed', 'executed'])
  })

  it('counts a payment the owner approved once, not once per clearance', async () => {
    const h = await harness({ policy: { maxPaymentsPerMinute: 2 } })
    const pending = await pay(h, '3000000')
    expect(pending.json().status).toBe('pending_approval')
    const sent = await h.asBot({
      intentId: pending.json().intentId,
      decision: 'approve',
      telegramUserId: '1',
    })
    expect(sent.json().status).toBe('executed')
    expect(await statuses(h, 1)).toEqual(['executed'])
  })

  it('trips at the default of 10 a minute for a policy that sets nothing', async () => {
    const h = await harness()
    expect(await statuses(h, 10)).toEqual(Array(10).fill('executed'))
    expect((await pay(h)).json().rejectReasons).toEqual(['BREAKER_TRIPPED'])
  })
})
