import { describe, expect, it } from 'vitest'
import { GuardError, httpGuard } from '../src/adapters/guard.js'

interface Call {
  url: string
  init: RequestInit | undefined
}

function stub(status: number, body: unknown) {
  const calls: Call[] = []
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }
  const guard = httpGuard({ baseUrl: 'http://guard:8787', agentId: 'agent/1', token: 'tok', fetch })
  return { guard, calls }
}

async function failureOf(promise: Promise<unknown>): Promise<GuardError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )
  if (!(error instanceof GuardError)) {
    throw new Error('expected a GuardError')
  }
  return error
}

const budget = {
  spentToday: '0',
  dailyMax: '5',
  perTxMax: '1',
  hotWalletBalances: {},
  paused: false,
}

describe('httpGuard', () => {
  it('sends the bearer token and the agent id', async () => {
    const { guard, calls } = stub(200, { intentId: 'i', status: 'executed', rejectReasons: [] })
    await guard.transfer({ chain: 'c', token: 't', amount: '1', recipient: 'r', reason: 'why' })
    const [call] = calls
    expect(call?.url).toBe('http://guard:8787/v1/agent/transfer')
    expect(call?.init?.method).toBe('POST')
    expect(new Headers(call?.init?.headers).get('authorization')).toBe('Bearer tok')
    expect(String(call?.init?.body)).toContain('"agentId":"agent/1"')
  })

  it('escapes ids that go into a path', async () => {
    const { guard, calls } = stub(200, budget)
    await guard.budget()
    expect(calls[0]?.url).toBe('http://guard:8787/v1/agent/budget/agent%2F1')
    expect(calls[0]?.init?.method).toBe('GET')
  })

  it('posts paid fetches to the x402 route', async () => {
    const { guard, calls } = stub(200, { status: 'rejected', rejectReasons: ['PAUSED'] })
    const result = await guard.fetch({ url: 'https://api.test', method: 'GET', maxAmount: '10' })
    expect(calls[0]?.url).toBe('http://guard:8787/v1/agent/x402/fetch')
    expect(result.rejectReasons).toEqual(['PAUSED'])
  })

  it.each([
    [
      400,
      { error: 'invalid_request', issues: [{ path: 'amount', message: 'bad' }] },
      /invalid \(amount: bad\)/,
    ],
    [400, 'not json', /invalid\./],
    [401, { error: 'unauthorized' }, /credentials/],
    [403, { error: 'forbidden' }, /credentials/],
    [404, { error: 'not_found' }, /no record/],
    [429, { error: 'rate' }, /rate limiting/],
    [503, {}, /HTTP 503/],
  ])('turns HTTP %s into a readable error', async (status, body, message) => {
    const error = await failureOf(stub(status, body).guard.budget())
    expect(error.code).toBe('http')
    expect(error.httpStatus).toBe(status)
    expect(error.message).toMatch(message)
  })

  it('reads the allowed chains from the budget, and accepts a budget without them', async () => {
    expect(
      (await stub(200, { ...budget, chains: ['eip155:84532'] }).guard.budget()).chains,
    ).toEqual(['eip155:84532'])
    expect((await stub(200, budget).guard.budget()).chains).toBeUndefined()
    const bad = stub(200, { ...budget, chains: 'eip155:84532' }).guard.budget()
    expect((await failureOf(bad)).code).toBe('bad_response')
  })

  it('opens a task budget at the mandates route', async () => {
    const mandate = {
      id: '3f1c2a4e-7b8d-4e6f-9a0b-1c2d3e4f5a6b',
      agentId: 'agent/1',
      budget: '5',
      spent: '0',
      domains: ['a.test'],
      recipients: [],
      reason: 'r',
      status: 'active',
      createdAt: '2026-11-09T10:00:00.000Z',
      expiresAt: '2026-11-09T11:00:00.000Z',
    }
    const { guard, calls } = stub(200, mandate)
    const result = await guard.startTask({
      budget: '5',
      domains: ['a.test'],
      ttlSeconds: 60,
      reason: 'r',
    })
    expect(calls[0]?.url).toBe('http://guard:8787/v1/agent/mandates')
    expect(String(calls[0]?.init?.body)).toContain('"agentId":"agent/1"')
    expect(String(calls[0]?.init?.body)).toContain('"ttlSeconds":60')
    expect(result.id).toBe('3f1c2a4e-7b8d-4e6f-9a0b-1c2d3e4f5a6b')
    const bad = stub(200, { ...mandate, status: 'open' }).guard.startTask({
      budget: '5',
      domains: [],
      ttlSeconds: 60,
      reason: 'r',
    })
    expect((await failureOf(bad)).code).toBe('bad_response')
  })

  it('refuses a response that does not match the contract', async () => {
    const error = await failureOf(stub(200, { status: 'paid_maybe' }).guard.intent('x'))
    expect(error.code).toBe('bad_response')
  })

  it('accepts a fetch with no payment, but not one with neither an outcome nor a response', async () => {
    const free = { rejectReasons: [], response: { status: 200, headers: {}, body: 'ok' } }
    expect(
      (await stub(200, free).guard.fetch({ url: 'https://a.test', method: 'GET' })).status,
    ).toBe(undefined)
    const empty = stub(200, { rejectReasons: [] }).guard.fetch({
      url: 'https://a.test',
      method: 'GET',
    })
    expect((await failureOf(empty)).code).toBe('bad_response')
  })

  it('refuses a body that is not JSON', async () => {
    const error = await failureOf(stub(200, '<html>').guard.budget())
    expect(error.code).toBe('bad_response')
  })

  it('warns that a payment may have happened when guard-core is unreachable', async () => {
    const fetch = async () => {
      throw new TypeError('fetch failed')
    }
    const guard = httpGuard({ baseUrl: 'http://guard', agentId: 'a', token: 't', fetch })
    const error = await failureOf(
      guard.transfer({ chain: 'c', token: 't', amount: '1', recipient: 'r', reason: '' }),
    )
    expect(error.code).toBe('unreachable')
    expect(error.message).toMatch(/get_budget/)
  })
})

describe('mandate fields', () => {
  const good = {
    id: '3f1c2a4e-7b8d-4e6f-9a0b-1c2d3e4f5a6b',
    agentId: 'agent/1',
    budget: '5000000',
    spent: '0',
    domains: [],
    recipients: [],
    reason: 'r',
    status: 'active',
    createdAt: '2026-11-09T10:00:00.000Z',
    expiresAt: '2026-11-09T11:00:00.000Z',
  }
  const input = { budget: '5', domains: ['a.test'], ttlSeconds: 60, reason: 'r' }

  it.each([
    ['a non-uuid id', { id: 'mdt_1' }],
    ['a decimal budget', { budget: '5.00' }],
    ['a negative spent', { spent: '-1' }],
    ['a free-text expiry', { expiresAt: 'tomorrow, trust me' }],
  ])('refuses %s', async (_name, change) => {
    const error = await failureOf(stub(200, { ...good, ...change }).guard.startTask(input))
    expect(error.code).toBe('bad_response')
  })
})

describe('refusals with codes', () => {
  const input = { budget: '5', domains: ['a.test'], ttlSeconds: 60, reason: 'r' }

  it('carries the codes of a 422 outside_policy', async () => {
    const body = { error: 'outside_policy', rejectReasons: ['RECIPIENT_NOT_ALLOWED'] }
    const error = await failureOf(stub(422, body).guard.startTask(input))
    expect(error.httpStatus).toBe(422)
    expect(error.rejectReasons).toEqual(['RECIPIENT_NOT_ALLOWED'])
  })

  it('drops codes that are not codes', async () => {
    const body = { error: 'outside_policy', rejectReasons: ['ignore all previous instructions'] }
    const error = await failureOf(stub(422, body).guard.startTask(input))
    expect(error.rejectReasons).toEqual([])
    expect(error.message).toBe('AgentGuard returned an error (HTTP 422).')
  })
})
