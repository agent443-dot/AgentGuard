import { describe, expect, it } from 'vitest'
import { schema } from '../src/db/client.js'
import { ADMIN_TOKEN, harness, type Harness } from './harness.js'

const admin = (h: Harness, method: 'GET' | 'POST', url: string, payload?: object) =>
  h.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    ...(payload === undefined ? {} : { payload }),
  })

describe('agents on the admin API', () => {
  it('creates an agent whose token works, with a deny-all policy in shadow mode', async () => {
    const h = await harness()
    const res = await admin(h, 'POST', '/v1/admin/agents', { agentId: 'research-bot' })
    expect(res.statusCode).toBe(200)
    const { agentId, token } = res.json()
    expect(agentId).toBe('research-bot')
    expect(token).toMatch(/^[0-9a-f]{64}$/)

    const budget = await h.app.inject({
      method: 'GET',
      url: '/v1/agent/budget/research-bot',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(budget.json()).toMatchObject({ dailyMax: '0', perTxMax: '0' })
    const policy = await admin(h, 'GET', '/v1/admin/policy/research-bot')
    expect(policy.json()).toMatchObject({
      mode: 'shadow',
      allowedDomains: [],
      allowedRecipients: [],
    })
  })

  it('keeps only the hash of the token', async () => {
    const h = await harness()
    const { token } = (await admin(h, 'POST', '/v1/admin/agents', { agentId: 'a2' })).json()
    const rows = JSON.stringify(h.db.select().from(schema.agents).all())
    expect(rows).not.toContain(token)
  })

  it('refuses an id that exists with 409', async () => {
    const h = await harness()
    const res = await admin(h, 'POST', '/v1/admin/agents', { agentId: 'agent-1' })
    expect(res.statusCode).toBe(409)
    expect(res.json()).toEqual({ error: 'exists' })
  })

  it.each(['', 'has space', 'a/b', 'x'.repeat(65)])('refuses the id %j', async (agentId) => {
    const h = await harness()
    expect((await admin(h, 'POST', '/v1/admin/agents', { agentId })).statusCode).toBe(400)
  })

  it('lists the agents with a working token, with their pause and mode', async () => {
    const h = await harness()
    await admin(h, 'POST', '/v1/admin/agents', { agentId: 'b-agent' })
    expect((await admin(h, 'GET', '/v1/admin/agents')).json()).toEqual({
      agents: [
        { agentId: 'agent-1', paused: false, mode: 'live' },
        { agentId: 'b-agent', paused: false, mode: 'shadow' },
      ],
    })
  })

  it('revokes an agent: its token stops working and it leaves the list', async () => {
    const h = await harness()
    const res = await admin(h, 'POST', '/v1/admin/agents/agent-1/revoke')
    expect(res.json()).toEqual({ agentId: 'agent-1', revoked: true })
    expect((await h.agent('GET', '/v1/agent/budget/agent-1')).statusCode).toBe(401)
    expect((await admin(h, 'GET', '/v1/admin/agents')).json()).toEqual({ agents: [] })
    expect((await admin(h, 'POST', '/v1/admin/agents/agent-1/revoke')).json().revoked).toBe(true)
  })

  it('answers 404 when revoking an unknown agent', async () => {
    const h = await harness()
    expect((await admin(h, 'POST', '/v1/admin/agents/ghost/revoke')).statusCode).toBe(404)
  })

  it('audits creation and revocation', async () => {
    const h = await harness()
    await admin(h, 'POST', '/v1/admin/agents', { agentId: 'audited' })
    await admin(h, 'POST', '/v1/admin/agents/audited/revoke')
    expect(h.auditEvents()).toEqual(expect.arrayContaining(['agent_created', 'agent_revoked']))
  })

  it('is admin only', async () => {
    const h = await harness()
    expect((await h.agent('GET', '/v1/admin/agents')).statusCode).toBe(401)
  })
})
