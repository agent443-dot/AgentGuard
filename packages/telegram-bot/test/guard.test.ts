import { describe, expect, it, vi } from 'vitest'
import { GuardError, httpGuardClient } from '../src/adapters/guard.js'
import { INTENT_ID, intent } from './support.js'

const BOT = 'b'.repeat(32)
const ADMIN = 'c'.repeat(32)

function client(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const response of responses) {
    fetch.mockResolvedValueOnce(response)
  }
  return {
    fetch,
    guard: httpGuardClient({ url: 'http://guard', botToken: BOT, adminToken: ADMIN, fetch }),
  }
}

const json = (status: number, body: unknown) => Response.json(body, { status })

function sentTo(fetch: ReturnType<typeof client>['fetch']) {
  const [url, init] = fetch.mock.calls[0] ?? []
  return { url, init, headers: new Headers(init?.headers) }
}

describe('httpGuardClient', () => {
  it('sends a decision with the bot token and the owner id as a string', async () => {
    const { fetch, guard } = client(json(200, intent({ status: 'approved' })))
    const result = await guard.decide(INTENT_ID, 'approve', 1001)
    expect(result).toMatchObject({ ok: true, intent: { status: 'approved' } })

    const { url, init, headers } = sentTo(fetch)
    expect(url).toBe('http://guard/v1/bot/decision')
    expect(headers.get('authorization')).toBe(`Bearer ${BOT}`)
    expect(init?.body).toBe(
      JSON.stringify({ intentId: INTENT_ID, decision: 'approve', telegramUserId: '1001' }),
    )
  })

  it('maps 404 and both kinds of 409', async () => {
    const { guard } = client(
      json(404, { error: 'not_found' }),
      json(409, { error: 'already_decided' }),
      json(409, { error: 'expired' }),
    )
    expect(await guard.decide(INTENT_ID, 'reject', 1)).toEqual({ ok: false, reason: 'not_found' })
    expect(await guard.decide(INTENT_ID, 'reject', 1)).toEqual({
      ok: false,
      reason: 'already_decided',
    })
    expect(await guard.decide(INTENT_ID, 'reject', 1)).toEqual({ ok: false, reason: 'expired' })
  })

  it('throws on anything else', async () => {
    const { guard } = client(json(401, { error: 'unauthorized' }))
    await expect(guard.decide(INTENT_ID, 'reject', 1)).rejects.toBeInstanceOf(GuardError)
  })

  it('pauses and resumes with the admin token', async () => {
    const { fetch, guard } = client(
      json(200, { agentId: 'a1', paused: true }),
      json(404, { error: 'not_found' }),
    )
    expect(await guard.setPaused('a1', true)).toBe('ok')
    expect(await guard.setPaused('a2', false)).toBe('not_found')
    expect(sentTo(fetch).url).toBe('http://guard/v1/admin/pause')
    expect(sentTo(fetch).headers.get('authorization')).toBe(`Bearer ${ADMIN}`)
    expect(fetch.mock.calls[1]?.[0]).toBe('http://guard/v1/admin/resume')
  })

  it('reads the kill result', async () => {
    const body = {
      pausedAgents: 3,
      ownerTransactions: [
        { chain: 'eip155:8453', description: 'Reset allowance', payload: { to: '0xabc' } },
        { chain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', description: 'By hand', payload: null },
      ],
    }
    const { guard } = client(json(200, body))
    expect(await guard.kill()).toEqual(body)
  })

  it('tells a missing agent from a missing route on /budget', async () => {
    const view = {
      spentToday: '0',
      dailyMax: '1',
      perTxMax: '1',
      hotWalletBalances: {},
      paused: false,
    }
    const { fetch, guard } = client(
      json(200, view),
      json(404, { error: 'not_found' }),
      json(404, { message: 'Route GET:/v1/admin/budget/a1 not found', statusCode: 404 }),
    )
    expect(await guard.budget('a/1')).toEqual(view)
    expect(sentTo(fetch).url).toBe('http://guard/v1/admin/budget/a%2F1')
    expect(await guard.budget('a1')).toBeUndefined()
    await expect(guard.budget('a1')).rejects.toBeInstanceOf(GuardError)
  })

  it('reports health without throwing', async () => {
    const { fetch, guard } = client(json(200, { status: 'ok' }))
    expect(await guard.healthy()).toBe(true)
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await guard.healthy()).toBe(false)
  })
})
