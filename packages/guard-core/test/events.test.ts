import type { PayIntent } from '@agentguard/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notify } from '../src/service/events.js'
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

describe('intent event retries', () => {
  const intent = { id: 'i-1', status: 'rejected' } as PayIntent

  function deps(failures: number) {
    let calls = 0
    const clock = { now: new Date('2026-11-03T12:00:00Z') }
    return {
      clock,
      sent: [] as string[],
      log: { warn: vi.fn(), error: vi.fn() },
      now: () => clock.now,
      bot: {
        requestApproval: vi.fn(async () => {}),
        intentEvent: vi.fn(async (_event: { sentAt: string }) => {
          calls++
          if (calls <= failures) {
            throw new Error('bot down')
          }
        }),
        alert: vi.fn(async () => {}),
      },
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    return () => vi.useRealTimers()
  })

  it('retries until the bot answers, with a fresh sentAt each time', async () => {
    const d = deps(2)
    notify(d, intent)
    for (const step of [1_000, 4_000]) {
      await vi.advanceTimersByTimeAsync(0)
      d.clock.now = new Date(d.clock.now.getTime() + step)
      await vi.advanceTimersByTimeAsync(step)
    }
    const stamps = d.bot.intentEvent.mock.calls.map(([event]) => event.sentAt)
    expect(stamps).toEqual([
      '2026-11-03T12:00:00.000Z',
      '2026-11-03T12:00:01.000Z',
      '2026-11-03T12:00:05.000Z',
    ])
    expect(d.log.error).not.toHaveBeenCalled()
  })

  it('gives up after four attempts and logs it without the payload', async () => {
    const d = deps(Infinity)
    notify(d, intent)
    await vi.advanceTimersByTimeAsync(21_000)
    expect(d.bot.intentEvent).toHaveBeenCalledTimes(4)
    expect(d.log.error).toHaveBeenCalledOnce()
    const [fields] = d.log.error.mock.calls[0] ?? []
    expect(fields).toMatchObject({ intentId: 'i-1', status: 'rejected', attempts: 4 })
    expect(fields).not.toHaveProperty('intent')
  })
})
