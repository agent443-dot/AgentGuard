import type { PayIntent } from '@agentguard/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAIN, harness, MERCHANT, MINT, NOW, type Harness } from './harness.js'

let h: Harness
beforeEach(async () => {
  h = await harness()
})

const transfer = (amount: string, recipient = MERCHANT) =>
  h.agent('POST', '/v1/agent/transfer', {
    agentId: 'agent-1',
    chain: CHAIN,
    token: MINT,
    amount,
    recipient,
    reason: 'invoice',
  })

function events(): { intent: PayIntent; sentAt: string }[] {
  return vi.mocked(h.bot.intentEvent).mock.calls.map(([event]) => event)
}

describe('intent events to the bot (CR-004)', () => {
  it('reports an executed payment with the time it was sent', async () => {
    const res = await transfer('1000000')
    expect(events()).toEqual([
      {
        intent: expect.objectContaining({ id: res.json().intentId, status: 'executed' }),
        sentAt: NOW.toISOString(),
      },
    ])
  })

  it('reports a rejection with its codes', async () => {
    await transfer('1000000', 'stranger')
    expect(events().map((e) => [e.intent.status, e.intent.rejectReasons])).toEqual([
      ['rejected', ['RECIPIENT_NOT_ALLOWED']],
    ])
  })

  it('reports a failure', async () => {
    vi.spyOn(h.chain, 'send').mockRejectedValue(new Error('timeout'))
    await transfer('1000000')
    expect(events().map((e) => e.intent.status)).toEqual(['failed'])
  })

  it('says nothing while an intent waits for the owner', async () => {
    await transfer('3000000')
    expect(events()).toEqual([])
  })

  it('reports an owner rejection', async () => {
    const id = (await transfer('3000000')).json().intentId
    await h.asBot({ intentId: id, decision: 'reject', telegramUserId: '42' })
    expect(events().map((e) => e.intent.rejectReasons)).toEqual([['OWNER_REJECTED']])
  })

  it('reports an approval that came too late as expired', async () => {
    const id = (await transfer('3000000')).json().intentId
    h.clock.now = new Date('2026-11-03T12:11:00Z')
    const res = await h.asBot({ intentId: id, decision: 'approve', telegramUserId: '42' })
    expect(res.statusCode).toBe(409)
    expect(events().map((e) => e.intent.status)).toEqual(['expired'])
  })

  it('reports what the sweep timer expires', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      h = await harness({ sweepMs: 1000 })
      const id = (await transfer('3000000')).json().intentId
      h.clock.now = new Date('2026-11-03T12:11:00Z')
      vi.advanceTimersByTime(1000)
      expect(events()).toEqual([
        expect.objectContaining({ intent: expect.objectContaining({ id, status: 'expired' }) }),
      ])
      await h.app.close()
    } finally {
      vi.useRealTimers()
    }
  })

  it('still pays when the bot cannot be reached', async () => {
    vi.mocked(h.bot.intentEvent).mockRejectedValue(new Error('bot down'))
    expect((await transfer('1000000')).json().status).toBe('executed')
  })
})
