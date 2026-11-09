import { describe, expect, it, vi } from 'vitest'
import { httpAdminClient } from '../src/adapters/admin.js'
import { CONFIRM_TTL_MS, Confirms } from '../src/domain/confirms.js'
import { hostname, parseDollars, raises } from '../src/domain/policy.js'
import { NOW, policy } from './support.js'

describe('parseDollars', () => {
  it.each([
    ['1', '1000000'],
    ['$12.50', '12500000'],
    ['0.000001', '1'],
    [' 3.5 ', '3500000'],
    ['999999999999.999999', '999999999999999999'],
  ])('%s is %s units', (dollars, units) => {
    expect(parseDollars(dollars)).toBe(units)
  })

  it.each(['-1', '1.0000001', '1e3', '', '.5', '1,50', '0x10'])('refuses %j', (bad) => {
    expect(parseDollars(bad)).toBeUndefined()
  })
})

describe('hostname', () => {
  it('lowercases a hostname and refuses anything else', () => {
    expect(hostname('API.Example.COM')).toBe('api.example.com')
    for (const bad of ['example', 'a_b.example.com', `${'a'.repeat(64)}.com`, 'x.-y.com', '']) {
      expect(hostname(bad)).toBeUndefined()
    }
  })
})

describe('raises', () => {
  it('names only the limits that went up', () => {
    const before = policy()
    expect(raises(before, policy({ perTxMax: '2000001', dailyMax: '1' }))).toEqual(['perTxMax'])
    expect(raises(before, before)).toEqual([])
  })
})

describe('Confirms', () => {
  it('gives a value back once, and not after its time', () => {
    let n = 0
    const confirms = new Confirms<string>(() => `id${n++}`)
    const a = confirms.add('a', NOW)
    const b = confirms.add('b', NOW, 1000)
    expect(confirms.take(a, NOW)).toBe('a')
    expect(confirms.take(a, NOW)).toBeUndefined()
    expect(confirms.take(b, new Date(NOW.getTime() + 1000))).toBeUndefined()
    const c = confirms.add('c', NOW)
    expect(confirms.take(c, new Date(NOW.getTime() + CONFIRM_TTL_MS))).toBeUndefined()
  })

  it('makes ids that fit in callback data', () => {
    const id = new Confirms<string>().add('x', NOW)
    expect(`own:${id}`.length).toBeLessThanOrEqual(64)
  })
})

describe('httpAdminClient', () => {
  const json = (status: number, body: unknown) => Response.json(body, { status })
  function client(...responses: Response[]) {
    const fetch = vi.fn<typeof globalThis.fetch>()
    for (const response of responses) {
      fetch.mockResolvedValueOnce(response)
    }
    const admin = httpAdminClient({
      url: 'http://guard',
      botToken: 'b',
      adminToken: 'ADMIN',
      fetch,
    })
    return { fetch, admin }
  }
  const sent = (fetch: ReturnType<typeof client>['fetch'], i = 0) => {
    const [url, init] = fetch.mock.calls[i] ?? []
    return {
      url,
      method: init?.method,
      body: init?.body,
      auth: new Headers(init?.headers).get('authorization'),
    }
  }

  it('creates an agent with the admin token, and reads 409 as exists', async () => {
    const { fetch, admin } = client(
      json(200, { agentId: 'a/1', token: 't'.repeat(32) }),
      json(409, { error: 'exists' }),
    )
    expect(await admin.createAgent('a/1')).toEqual({ agentId: 'a/1', token: 't'.repeat(32) })
    expect(sent(fetch)).toEqual({
      url: 'http://guard/v1/admin/agents',
      method: 'POST',
      body: JSON.stringify({ agentId: 'a/1' }),
      auth: 'Bearer ADMIN',
    })
    expect(await admin.createAgent('a/1')).toBeUndefined()
  })

  it('lists, revokes and reads 404 as unknown', async () => {
    const { fetch, admin } = client(
      json(200, { agents: [{ agentId: 'a', paused: false, mode: 'live' }] }),
      json(200, { agentId: 'a/1', revoked: true }),
      json(404, { error: 'not_found' }),
    )
    expect(await admin.listAgents()).toEqual([{ agentId: 'a', paused: false, mode: 'live' }])
    expect(await admin.revokeAgent('a/1')).toBe(true)
    expect(sent(fetch, 1).url).toBe('http://guard/v1/admin/agents/a%2F1/revoke')
    expect(await admin.revokeAgent('a')).toBe(false)
  })

  it('reads and writes the whole policy, the agent id in the path only', async () => {
    const current = policy()
    const { fetch, admin } = client(json(200, current), json(404, {}), json(200, current))
    expect(await admin.policy('research-agent')).toEqual(current)
    expect(await admin.policy('ghost')).toBeUndefined()
    await admin.putPolicy(current)
    const { agentId: _id, ...body } = current
    expect(sent(fetch, 2)).toMatchObject({
      url: 'http://guard/v1/admin/policy/research-agent',
      method: 'PUT',
      body: JSON.stringify(body),
    })
  })

  it('reads the doctor checks, and throws on an error', async () => {
    const checks = [{ id: 'db', status: 'ok', message: 'Database writable' }]
    const { admin } = client(json(200, { checks }), json(500, {}))
    expect(await admin.doctor()).toEqual(checks)
    await expect(admin.doctor()).rejects.toThrow()
  })
})
