import type { ApprovalRequest } from '@agentguard/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPin } from '../src/db/pins.js'
import { harness, offer, paid, paymentRequired, type Harness } from './harness.js'

const SWAPPED = 'AttackerPayee1111111111111111111111111111111'

let h: Harness
beforeEach(async () => {
  h = await harness()
})

/** One call to a paid API that quotes `quote` and answers once paid. */
async function buy(quote = offer({ amount: '500000' }), url = 'https://api.example.com/data') {
  h.fetch.mockImplementation(async (_url, init) =>
    new Headers(init?.headers).has('payment-signature') ? paid() : paymentRequired([quote]),
  )
  return h.agent('POST', '/v1/agent/x402/fetch', { agentId: 'agent-1', url })
}

/** The last approval request, which here is always about a payment. */
const lastAsked = () =>
  vi.mocked(h.bot.requestApproval).mock.calls.at(-1)?.[0] as ApprovalRequest | undefined
const flagsSent = () => lastAsked()?.flags

describe('x402 recipient and price pinning', () => {
  it('pins the terms of an executed payment', async () => {
    expect((await buy()).json().status).toBe('executed')
    expect(getPin(h.db, 'agent-1', 'api.example.com')).toMatchObject({
      recipient: offer().payTo,
      amount: '500000',
    })
  })

  it('sends a changed payee to the owner even below the threshold', async () => {
    await buy()
    const res = await buy(offer({ amount: '500000', payTo: SWAPPED }))
    expect(res.json().status).toBe('pending_approval')
    expect(flagsSent()).toEqual(['RECIPIENT_CHANGED'])
    const body = lastAsked()
    expect(body?.passkey).toBe(false)
    expect(body?.pinned).toEqual({ recipient: offer().payTo, amount: '500000' })
  })

  it('sends a price more than double the pinned one to the owner', async () => {
    await buy()
    const res = await buy(offer({ amount: '1500000' }))
    expect(res.json().status).toBe('pending_approval')
    expect(flagsSent()).toEqual(['PRICE_JUMP'])
  })

  it("re-pins on the owner's approval, so the repeat and the next payment go through", async () => {
    await buy()
    const swapped = offer({ amount: '500000', payTo: SWAPPED })
    const pending = await buy(swapped)
    await h.asBot({ intentId: pending.json().intentId, decision: 'approve', telegramUserId: '1' })
    expect(getPin(h.db, 'agent-1', 'api.example.com')?.recipient).toBe(SWAPPED)

    expect((await buy(swapped)).json().status).toBe('executed')
    expect((await buy(swapped)).json().status).toBe('executed')
  })

  it("keeps the old pin on the owner's rejection, so the same request is asked again", async () => {
    await buy()
    const swapped = offer({ amount: '500000', payTo: SWAPPED })
    const pending = await buy(swapped)
    await h.asBot({ intentId: pending.json().intentId, decision: 'reject', telegramUserId: '1' })
    expect(getPin(h.db, 'agent-1', 'api.example.com')?.recipient).toBe(offer().payTo)

    expect((await buy(swapped)).json().status).toBe('pending_approval')
    expect(flagsSent()).toEqual(['RECIPIENT_CHANGED'])
  })

  it.each([
    ['upper case', 'https://API.Example.COM/data'],
    ['an explicit port', 'https://api.example.com:443/data'],
  ])('holds the same pin for the domain written in %s', async (_case, url) => {
    await buy()
    const res = await buy(offer({ amount: '500000', payTo: SWAPPED }), url)
    expect(res.json().status).toBe('pending_approval')
    expect(flagsSent()).toEqual(['RECIPIENT_CHANGED'])
  })

  it('sends an unflagged request with empty flags', async () => {
    await buy(offer({ amount: '3000000' }))
    expect(flagsSent()).toEqual([])
    expect(lastAsked()?.pinned).toBeUndefined()
  })
})
