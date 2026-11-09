import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { offer, paidApi, type PaidApi } from './support/paid-api.js'
import { intentIdIn, stack, type Stack } from './support/stack.js'

// The five owner-facing flows on the Solana stub chain, driven from the agent's MCP tools to the
// owner's Telegram and back.

let s: Stack
let api: PaidApi

beforeEach(async () => {
  s = await stack()
  api = await paidApi()
  await s.setPolicy()
})

afterEach(async () => {
  await api.close()
  await s.close()
})

const sentTo = () => s.telegram.messages.filter((m) => m.method === 'sendMessage')

describe('Solana flows', () => {
  it('pays under the threshold without asking the owner, and returns the body as untrusted', async () => {
    const text = await s.tool('paid_fetch', { url: api.url, maxAmountUsd: '1' })

    expect(text).toContain(': executed.')
    expect(text).toContain('<untrusted-content id="')
    expect(text).toContain('{"data":42}')
    expect(api.payments).toHaveLength(1)
    // At 1 USDC the payment is at NOTIFY_ABOVE_AMOUNT, so the owner hears about it, but is not asked.
    await vi.waitFor(() =>
      expect(sentTo().map((m) => m.text)).toEqual([expect.stringContaining('Payment executed')]),
    )
    expect(sentTo().some((m) => m.buttons.length > 0)).toBe(false)
  })

  it('over the threshold, waits for the owner, then redeems the approval once', async () => {
    api.quote = [offer({ amount: '3000000' })]

    const first = await s.tool('paid_fetch', { url: api.url })
    expect(first).toContain(': pending_approval.')
    expect(api.payments).toHaveLength(0)
    const id = intentIdIn(first)

    await vi.waitFor(() => expect(s.telegram.approvalFor(id)?.text).toContain('$3.00'))
    await s.telegram.press(id, 'approve')
    expect(s.telegram.lastAnswer()).toBe('Approved')

    expect(await s.tool('check_intent', { intentId: id })).toContain('Call paid_fetch again')
    const second = await s.tool('paid_fetch', { url: api.url })
    expect(second).toContain(': executed.')
    expect(second).toContain('{"data":42}')
    expect(api.payments).toHaveLength(1)
    expect((await s.intent(id)).status).toBe('executed')

    // The approval is spent: the same request asks the owner again rather than paying twice.
    expect(await s.tool('paid_fetch', { url: api.url })).toContain(': pending_approval.')
    expect(api.payments).toHaveLength(1)
  })

  it('pays nothing when the owner rejects', async () => {
    api.quote = [offer({ amount: '3000000' })]
    const id = intentIdIn(await s.tool('paid_fetch', { url: api.url }))
    await vi.waitFor(() => expect(s.telegram.approvalFor(id)).toBeDefined())

    await s.telegram.press(id, 'reject')
    expect(s.telegram.lastAnswer()).toBe('Rejected')

    const intent = await s.intent(id)
    expect(intent.status).toBe('rejected')
    expect(intent.rejectReasons).toEqual(['OWNER_REJECTED'])
    expect(await s.tool('check_intent', { intentId: id })).toContain('rejected')
    expect(api.payments).toHaveLength(0)
    // The message the owner pressed loses its buttons.
    await vi.waitFor(() =>
      expect(
        s.telegram.messages.some((m) => m.method === 'editMessageText' && m.buttons.length === 0),
      ).toBe(true),
    )
  })

  it('expires an approval left unanswered, and a late press cannot revive it', async () => {
    api.quote = [offer({ amount: '3000000' })]
    const id = intentIdIn(await s.tool('paid_fetch', { url: api.url }))
    await vi.waitFor(() => expect(s.telegram.approvalFor(id)).toBeDefined())

    s.clock.now = new Date(s.clock.now.getTime() + 11 * 60_000)
    await vi.waitFor(async () => expect((await s.intent(id)).status).toBe('expired'))
    expect((await s.intent(id)).rejectReasons).toEqual(['APPROVAL_TIMEOUT'])

    await s.telegram.press(id, 'approve')
    expect(s.telegram.lastAnswer()).toBe('Too late: this request expired. Nothing was paid.')
    expect((await s.intent(id)).status).toBe('expired')
    expect(await s.tool('paid_fetch', { url: api.url })).not.toContain(': executed.')
    expect(api.payments).toHaveLength(0)
  })

  it('kill pauses the agent and hands the owner the onchain transaction', async () => {
    await s.telegram.command('/kill')
    await s.telegram.tap('kill:confirm')

    await vi.waitFor(() =>
      expect(s.telegram.messages.map((m) => m.text).join('\n')).toContain('Kill switch engaged'),
    )
    expect(s.telegram.messages.map((m) => m.text).join('\n')).toContain(
      'stub: remove the spend limit',
    )

    const text = await s.tool('paid_fetch', { url: api.url, maxAmountUsd: '1' })
    expect(text).toContain(': rejected.')
    expect(text).toContain('paused')
    expect(api.payments).toHaveLength(0)
    expect(s.chain.sent).toHaveLength(0)
  })
})
