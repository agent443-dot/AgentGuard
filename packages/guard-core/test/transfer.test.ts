import { CHAINS } from '@agentguard/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/db/client.js'
import { expirePending } from '../src/service/approvals.js'
import { ADMIN_TOKEN, CHAIN, harness, MERCHANT, MINT, spent, type Harness } from './harness.js'

const transfer = (amount: string, overrides: object = {}) => ({
  agentId: 'agent-1',
  chain: CHAIN,
  token: MINT,
  amount,
  recipient: MERCHANT,
  reason: 'pay the invoice',
  ...overrides,
})

let h: Harness
beforeEach(async () => {
  h = await harness()
})

describe('POST /v1/agent/transfer', () => {
  it('sends a transfer under the threshold and counts it', async () => {
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'executed', txId: 'stub-tx-1', rejectReasons: [] })
    expect(h.chain.sent).toHaveLength(1)
    expect(spent(h.db)).toBe(1_000_000n)
    expect(h.auditEvents(res.json().intentId)).toEqual([
      'policy_evaluated',
      'simulated',
      'executed',
    ])
  })

  it('refuses a recipient off the allowlist without simulating or sending', async () => {
    const simulate = vi.spyOn(h.chain, 'simulate')
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000', { recipient: 'x' }))
    expect(res.json()).toMatchObject({
      status: 'rejected',
      rejectReasons: ['RECIPIENT_NOT_ALLOWED'],
    })
    expect(simulate).not.toHaveBeenCalled()
    expect(h.chain.sent).toHaveLength(0)
    expect(h.auditEvents(res.json().intentId)).toEqual(['policy_evaluated', 'rejected'])
  })

  it('refuses a chain the policy allows but no adapter serves', async () => {
    const res = await h.agent(
      'POST',
      '/v1/agent/transfer',
      transfer('1000000', { chain: CHAINS.base }),
    )
    expect(res.json().rejectReasons).toContain('CHAIN_NOT_ALLOWED')
  })

  it('refuses a transfer for another agent', async () => {
    const res = await h.agent(
      'POST',
      '/v1/agent/transfer',
      transfer('1000000', { agentId: 'agent-2' }),
    )
    expect(res.statusCode).toBe(403)
  })

  it('refuses a transfer that was waiting its turn when the kill landed', async () => {
    let release = () => {}
    const send = h.chain.send.bind(h.chain)
    vi.spyOn(h.chain, 'send').mockImplementationOnce(async (intent) => {
      await new Promise<void>((resolve) => (release = resolve))
      return send(intent)
    })
    const first = h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    await vi.waitFor(() => expect(h.chain.send).toHaveBeenCalledTimes(1))
    const queued = h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    // Long enough for the second request to pass auth and wait on the agent's lock.
    await new Promise((resolve) => setTimeout(resolve, 50))
    const kill = await h.app.inject({
      method: 'POST',
      url: '/v1/admin/kill',
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {},
    })
    expect(kill.statusCode).toBe(200)
    release()
    expect((await first).json().status).toBe('executed')
    expect((await queued).json()).toMatchObject({ status: 'rejected', rejectReasons: ['PAUSED'] })
    expect(h.chain.sent).toHaveLength(1)
  })

  it('keeps concurrent transfers inside the daily max', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map(() => h.agent('POST', '/v1/agent/transfer', transfer('1900000'))),
    )
    const statuses = results.map((res) => res.json().status)
    expect(statuses.filter((status) => status === 'executed')).toHaveLength(5)
    expect(results.at(-1)?.json().rejectReasons).toEqual(['DAILY_EXCEEDED'])
    expect(spent(h.db)).toBe(9_500_000n)
  })
})

describe('simulation gate', () => {
  it('rejects with the adapter codes and sends nothing', async () => {
    vi.spyOn(h.chain, 'simulate').mockResolvedValue({
      simulation: { summary: 'approve', balanceChanges: [] },
      rejectReasons: ['DELEGATE_DETECTED'],
    })
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(res.json()).toMatchObject({ status: 'rejected', rejectReasons: ['DELEGATE_DETECTED'] })
    expect(h.chain.sent).toHaveLength(0)
  })

  it('treats a simulation that throws as SIM_FAILED', async () => {
    vi.spyOn(h.chain, 'simulate').mockRejectedValue(
      new Error('HTTP request failed.\nURL: https://base.example/v2/secret-key\nrpc down'),
    )
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(res.json().rejectReasons).toEqual(['SIM_FAILED'])
    const simulated = h.db
      .select()
      .from(schema.auditLog)
      .all()
      .find((row) => row.intentId === res.json().intentId && row.event === 'simulated')
    expect(simulated?.detail).toEqual({ error: 'HTTP request failed.\nURL: <url>\nrpc down' })
  })

  it('rejects a simulation that drains more than the amount, even with no codes', async () => {
    vi.spyOn(h.chain, 'simulate').mockResolvedValue({
      simulation: { summary: 'looks fine', balanceChanges: [{ token: MINT, delta: '-50000000' }] },
      rejectReasons: [],
    })
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(res.json().rejectReasons).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })
})

describe('owner approval', () => {
  async function pending() {
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('3000000'))
    expect(res.json().status).toBe('pending_approval')
    return res.json().intentId as string
  }

  const approve = (intentId: string) =>
    h.asBot({ intentId, decision: 'approve', telegramUserId: '42' })

  it('asks the owner and sends nothing until they answer', async () => {
    await pending()
    expect(h.bot.requestApproval).toHaveBeenCalledOnce()
    expect(h.chain.sent).toHaveLength(0)
    expect(spent(h.db)).toBe(0n)
  })

  it('re-simulates an approved transfer immediately before sending it', async () => {
    const id = await pending()
    const simulate = vi.spyOn(h.chain, 'simulate')
    const res = await approve(id)
    expect(res.json()).toMatchObject({ id, status: 'executed', txId: 'stub-tx-1' })
    expect(simulate).toHaveBeenCalledOnce()
    expect(h.auditEvents(id)).toContain('owner_decision')
  })

  it('refuses an approved transfer whose second simulation objects', async () => {
    const id = await pending()
    vi.spyOn(h.chain, 'simulate').mockResolvedValue({
      simulation: { summary: 'changed', balanceChanges: [] },
      rejectReasons: ['AUTHORITY_CHANGE_DETECTED'],
    })
    const res = await approve(id)
    expect(res.json()).toMatchObject({
      status: 'rejected',
      rejectReasons: ['AUTHORITY_CHANGE_DETECTED'],
    })
    expect(h.chain.sent).toHaveLength(0)
  })

  it('refuses an approved transfer when the agent was paused in the meantime', async () => {
    const id = await pending()
    h.db.update(schema.policies).set({ paused: true }).run()
    const res = await approve(id)
    expect(res.json().rejectReasons).toContain('PAUSED')
    expect(h.chain.sent).toHaveLength(0)
  })

  it('sends once when the same approval is replayed', async () => {
    const id = await pending()
    await approve(id)
    const replay = await approve(id)
    expect(replay.statusCode).toBe(409)
    expect(h.chain.sent).toHaveLength(1)
  })

  it('records an owner rejection', async () => {
    const id = await pending()
    const res = await h.asBot({ intentId: id, decision: 'reject', telegramUserId: '42' })
    expect(res.json()).toMatchObject({ status: 'rejected', rejectReasons: ['OWNER_REJECTED'] })
    expect(h.chain.sent).toHaveLength(0)
  })

  it('keeps the intent pending when the webhook fails, for the sweep to expire', async () => {
    vi.mocked(h.bot.requestApproval).mockRejectedValueOnce(new Error('bot down'))
    const id = await pending()
    expect(h.auditEvents(id)).toContain('approval_request_failed')
    expect(expirePending(h.db, new Date('2026-11-03T12:11:00Z'))).toHaveLength(1)
    expect(h.auditEvents(id).at(-1)).toBe('expired')
  })
})

describe('hot wallet top-up', () => {
  it('pulls the shortfall from the vault before sending', async () => {
    h.chain.balance = 400_000n
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(h.chain.topUps).toEqual(['600000'])
    expect(res.json().status).toBe('executed')
    expect(h.auditEvents(res.json().intentId)).toContain('topped_up')
  })

  it('does not top up when the balance covers the payment', async () => {
    await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(h.chain.topUps).toEqual([])
  })

  it('fails without sending or counting when the top-up is refused', async () => {
    h.chain.balance = 0n
    vi.spyOn(h.chain, 'topUpHotWallet').mockRejectedValue(new Error('Spending limit exceeded'))
    const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
    expect(res.json().status).toBe('failed')
    expect(h.chain.sent).toHaveLength(0)
    expect(spent(h.db)).toBe(0n)
  })
})

it('counts a send that failed, since it may have reached the chain', async () => {
  vi.spyOn(h.chain, 'send').mockRejectedValue(new Error('timeout'))
  const res = await h.agent('POST', '/v1/agent/transfer', transfer('1000000'))
  expect(res.json().status).toBe('failed')
  expect(spent(h.db)).toBe(1_000_000n)
})
