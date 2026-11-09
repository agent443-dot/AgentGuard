import { CHAINS } from '@agentguard/shared'
import { describe, expect, it, vi } from 'vitest'
import { GuardError, httpGuard, type Intent } from '../src/adapters/guard.js'
import { call, connect, fakeGuard } from './support.js'

const ID = '3f0c8f5e-8a3b-4c55-9a0e-2d6f2b1c7a10'

const executed: Intent = {
  id: ID,
  kind: 'transfer',
  chain: CHAINS.solanaDevnet,
  amount: '1000000',
  recipient: 'R',
  status: 'executed',
  rejectReasons: [],
  txId: 'sig1',
  createdAt: '2026-11-09T10:00:00.000Z',
  expiresAt: '2026-11-09T10:10:00.000Z',
}

describe('check_intent and receipts', () => {
  it('mentions the receipt of an executed payment by intent id only', async () => {
    const hasReceipt = vi.fn(async () => true)
    const client = await connect(fakeGuard({ intent: async () => executed, hasReceipt }))
    const { text } = await call(client, 'check_intent', { intentId: ID })
    expect(hasReceipt).toHaveBeenCalledWith(ID)
    expect(text).toContain(`AgentGuard holds a signed receipt for this payment (intent ${ID}).`)
  })

  it('says nothing when there is no receipt', async () => {
    const client = await connect(
      fakeGuard({ intent: async () => executed, hasReceipt: async () => false }),
    )
    expect((await call(client, 'check_intent', { intentId: ID })).text).not.toMatch(/receipt/)
  })

  it('does not look for a receipt before the payment is executed', async () => {
    const hasReceipt = vi.fn(async () => true)
    const client = await connect(
      fakeGuard({ intent: async () => ({ ...executed, status: 'pending_approval' }), hasReceipt }),
    )
    await call(client, 'check_intent', { intentId: ID })
    expect(hasReceipt).not.toHaveBeenCalled()
  })

  it('still reports the payment when the receipt lookup fails', async () => {
    const client = await connect(
      fakeGuard({
        intent: async () => executed,
        hasReceipt: () => Promise.reject(new GuardError('http', 'boom', 500)),
      }),
    )
    const result = await call(client, 'check_intent', { intentId: ID })
    expect(result.isError).toBe(false)
    expect(result.text).toMatch(/: executed\./)
    expect(result.text).not.toMatch(/receipt/)
  })
})

describe('httpGuard.hasReceipt', () => {
  function guardAnswering(status: number, body: unknown) {
    const fetch = async () => new Response(JSON.stringify(body), { status })
    return httpGuard({ baseUrl: 'http://guard', agentId: 'a', token: 't', fetch })
  }

  it('is true for a signed receipt, false for a 404, and throws on anything else', async () => {
    expect(await guardAnswering(200, { signature: 'ab12' }).hasReceipt(ID)).toBe(true)
    expect(await guardAnswering(404, { error: 'not_found' }).hasReceipt(ID)).toBe(false)
    await expect(guardAnswering(500, {}).hasReceipt(ID)).rejects.toBeInstanceOf(GuardError)
  })
})
