import { describe, expect, it, vi } from 'vitest'
import { GuardError, httpGuardClient } from '../src/adapters/guard.js'
import { INTENT_ID, intent, MANDATE_ID, mandateRequest } from './support.js'

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

  it('decides a task budget on its own route, mapping 404, 409 and 410', async () => {
    const mandate = mandateRequest().mandate
    const { fetch, guard } = client(
      json(200, { ...mandate, status: 'active' }),
      json(404, { error: 'not_found' }),
      json(409, { error: 'already_decided' }),
      json(410, { error: 'expired' }),
    )
    expect(await guard.decideMandate(MANDATE_ID, 'approve', 1001)).toEqual({ ok: true })
    const { url, init, headers } = sentTo(fetch)
    expect(url).toBe(`http://guard/v1/bot/mandates/${MANDATE_ID}/decision`)
    expect(headers.get('authorization')).toBe(`Bearer ${BOT}`)
    expect(init?.body).toBe(JSON.stringify({ decision: 'approve', telegramUserId: '1001' }))
    expect(await guard.decideMandate(MANDATE_ID, 'reject', 1001)).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(await guard.decideMandate(MANDATE_ID, 'reject', 1001)).toEqual({
      ok: false,
      reason: 'already_decided',
    })
    expect(await guard.decideMandate(MANDATE_ID, 'reject', 1001)).toEqual({
      ok: false,
      reason: 'expired',
    })
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

  it('asks for the report with the admin token and the period, and treats no route as none', async () => {
    const agents = [
      {
        agentId: 'a1',
        spent: '12500000',
        payments: 3,
        refused: { DAILY_EXCEEDED: 2 },
        domains: [{ domain: 'api.example.com', spent: '12500000' }],
      },
    ]
    const { fetch, guard } = client(
      json(200, { agents }),
      json(404, { message: 'Route not found' }),
      json(200, { agents: [{ ...agents[0], spent: '1.5' }] }),
    )
    const from = new Date('2026-11-02T12:00:00.000Z')
    const to = new Date('2026-11-09T12:00:00.000Z')
    expect(await guard.report(from, to)).toEqual(agents)
    const { url, headers } = sentTo(fetch)
    expect(url).toBe(
      'http://guard/v1/admin/report?from=2026-11-02T12%3A00%3A00.000Z&to=2026-11-09T12%3A00%3A00.000Z',
    )
    expect(headers.get('authorization')).toBe(`Bearer ${ADMIN}`)
    expect(await guard.report(from, to)).toBeUndefined()
    await expect(guard.report(from, to)).rejects.toThrow()
  })

  it('lists the chains, and treats a missing route as not reported', async () => {
    const chains = [{ chain: 'eip155:84532', allowance: null }]
    const { fetch, guard } = client(
      json(200, { chains }),
      json(404, { message: 'Route not found' }),
    )
    expect(await guard.chains()).toEqual(chains)
    expect(sentTo(fetch).url).toBe('http://guard/v1/admin/chains')
    expect(sentTo(fetch).headers.get('authorization')).toBe(`Bearer ${ADMIN}`)
    expect(await guard.chains()).toBeUndefined()
  })

  it('reads a killed chain as no limit, and an allowance without status as active', async () => {
    const active = { cap: '1', spent: '0', resetsAt: '2026-11-08T00:00:00Z', delegate: 'D' }
    const { guard } = client(
      json(200, {
        chains: [
          { chain: 'eip155:46630', allowance: { status: 'none', delegate: 'D' } },
          { chain: 'eip155:84532', allowance: active },
        ],
      }),
    )
    expect(await guard.chains()).toEqual([
      { chain: 'eip155:46630', allowance: { status: 'none', delegate: 'D' } },
      { chain: 'eip155:84532', allowance: { status: 'active', ...active } },
    ])
  })

  it('reports health without throwing', async () => {
    const { fetch, guard } = client(json(200, { status: 'ok' }))
    expect(await guard.healthy()).toBe(true)
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await guard.healthy()).toBe(false)
  })
})
