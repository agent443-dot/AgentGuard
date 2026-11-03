import { CHAINS } from '@agentguard/shared'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { openDb, schema, type Db } from '../src/db/client.js'
import { hashToken } from '../src/domain/auth.js'
import { expiresAt } from '../src/service/approvals.js'
import { buildServer, type Server } from '../src/http/server.js'

const ADMIN_TOKEN = 'a'.repeat(64)
const BOT_TOKEN = 'b'.repeat(64)
const AGENT_TOKEN = 'agent-token-which-is-long-enough'
const MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

const policy = {
  chains: [CHAINS.solanaDevnet],
  tokens: [MINT],
  perTxMax: '5000000',
  dailyMax: '100000000',
  approvalThreshold: '2000000',
  allowedRecipients: [],
  allowedDomains: ['api.example.com'],
  paused: false,
}

let db: Db
let app: Server

const auth = (token: string) => ({ authorization: `Bearer ${token}` })

beforeEach(async () => {
  db = openDb(':memory:')
  migrate(db, { migrationsFolder: 'migrations' })

  for (const [id, token] of [
    ['agent-1', AGENT_TOKEN],
    ['agent-2', 'another-agent-token-long-enough!'],
  ] as const) {
    db.insert(schema.agents)
      .values({ id, name: id, tokenHash: hashToken(token), createdAt: '2026-11-03T00:00:00Z' })
      .run()
    db.insert(schema.policies)
      .values({ agentId: id, ...policy, updatedAt: '2026-11-03T00:00:00Z' })
      .run()
  }

  app = await buildServer({
    db,
    config: loadConfig({
      ADMIN_TOKEN,
      BOT_TOKEN,
      BOT_URL: 'http://localhost:8788',
      BOT_WEBHOOK_SECRET: 'c'.repeat(64),
      LOG_LEVEL: 'fatal',
    }),
    now: () => new Date('2026-11-03T12:00:00Z'),
  })
})

describe('authentication', () => {
  it('serves health without a token', async () => {
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
  })

  it.each([
    ['no header', undefined],
    ['empty bearer', 'Bearer '],
    ['wrong scheme', `Basic ${AGENT_TOKEN}`],
    ['wrong token', 'Bearer not-the-token'],
  ])('refuses an agent route with %s', async (_case, authorization) => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: authorization === undefined ? {} : { authorization },
    })
    expect(res.statusCode).toBe(401)
  })

  it('keeps the roles apart', async () => {
    const adminWithAgentToken = await app.inject({
      method: 'GET',
      url: '/v1/admin/policy/agent-1',
      headers: auth(AGENT_TOKEN),
    })
    expect(adminWithAgentToken.statusCode).toBe(401)

    const agentWithAdminToken = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: auth(ADMIN_TOKEN),
    })
    expect(agentWithAdminToken.statusCode).toBe(401)
  })
})

describe('agent routes', () => {
  beforeEach(() => {
    db.insert(schema.intents)
      .values({
        id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
        agentId: 'agent-2',
        kind: 'transfer',
        chain: CHAINS.solanaDevnet,
        token: MINT,
        amount: '1000000',
        recipient: 'someone',
        reason: 'not yours',
        status: 'executed',
        rejectReasons: [],
        createdAt: '2026-11-03T00:00:00Z',
        expiresAt: '2026-11-03T00:10:00Z',
      })
      .run()
  })

  it('hides another agent intent behind a 404 rather than a 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/intents/3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      headers: auth(AGENT_TOKEN),
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects a budget lookup for someone else', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-2',
      headers: auth(AGENT_TOKEN),
    })
    expect(res.statusCode).toBe(403)
  })

  it('reports the budget with nothing spent yet', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: auth(AGENT_TOKEN),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ spentToday: '0', dailyMax: '100000000', paused: false })
  })

  it('sums the day spend across chains', async () => {
    db.insert(schema.dailySpend)
      .values([
        { agentId: 'agent-1', chain: CHAINS.solanaDevnet, day: '2026-11-03', spent: '1500000' },
        { agentId: 'agent-1', chain: CHAINS.baseSepolia, day: '2026-11-03', spent: '2500000' },
        { agentId: 'agent-1', chain: CHAINS.solanaDevnet, day: '2026-11-02', spent: '9000000' },
      ])
      .run()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: auth(AGENT_TOKEN),
    })
    expect(res.json().spentToday).toBe('4000000')
  })

  it('answers 400 on a malformed intent id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/intents/not-a-uuid',
      headers: auth(AGENT_TOKEN),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('admin routes', () => {
  it('reads and replaces a policy', async () => {
    const updated = { ...policy, perTxMax: '7000000' }
    const put = await app.inject({
      method: 'PUT',
      url: '/v1/admin/policy/agent-1',
      headers: auth(ADMIN_TOKEN),
      payload: updated,
    })
    expect(put.statusCode).toBe(200)

    const get = await app.inject({
      method: 'GET',
      url: '/v1/admin/policy/agent-1',
      headers: auth(ADMIN_TOKEN),
    })
    expect(get.json().perTxMax).toBe('7000000')
  })

  it('refuses a policy with a non-atomic limit', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/admin/policy/agent-1',
      headers: auth(ADMIN_TOKEN),
      payload: { ...policy, dailyMax: '100.00' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('pauses and resumes one agent', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/admin/pause',
      headers: auth(ADMIN_TOKEN),
      payload: { agentId: 'agent-1' },
    })
    const paused = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: auth(AGENT_TOKEN),
    })
    expect(paused.json().paused).toBe(true)

    await app.inject({
      method: 'POST',
      url: '/v1/admin/resume',
      headers: auth(ADMIN_TOKEN),
      payload: { agentId: 'agent-1' },
    })
    const resumed = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: auth(AGENT_TOKEN),
    })
    expect(resumed.json().paused).toBe(false)
  })

  it('reports 404 when pausing an agent that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/pause',
      headers: auth(ADMIN_TOKEN),
      payload: { agentId: 'ghost' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('kill pauses every agent at once', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/kill',
      headers: auth(ADMIN_TOKEN),
    })
    expect(res.json().pausedAgents).toBe(2)

    for (const token of [AGENT_TOKEN, 'another-agent-token-long-enough!']) {
      const agent = token === AGENT_TOKEN ? 'agent-1' : 'agent-2'
      const budget = await app.inject({
        method: 'GET',
        url: `/v1/agent/budget/${agent}`,
        headers: auth(token),
      })
      expect(budget.json().paused).toBe(true)
    }
  })
})

describe('bot routes', () => {
  const INTENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
  const created = new Date('2026-11-03T12:00:00Z')

  beforeEach(() => {
    db.insert(schema.intents)
      .values({
        id: INTENT_ID,
        agentId: 'agent-1',
        kind: 'transfer',
        chain: CHAINS.solanaDevnet,
        token: MINT,
        amount: '3000000',
        recipient: 'merchant',
        reason: 'over the threshold',
        status: 'pending_approval',
        rejectReasons: [],
        createdAt: created.toISOString(),
        expiresAt: expiresAt(created),
      })
      .run()
  })

  it('refuses an agent token on the bot route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: auth(AGENT_TOKEN),
      payload: { intentId: INTENT_ID, decision: 'approve', telegramUserId: '1' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('checks an approved transfer against the policy again before sending it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: auth(BOT_TOKEN),
      payload: { intentId: INTENT_ID, decision: 'approve', telegramUserId: '1' },
    })
    expect(res.statusCode).toBe(200)
    // The recipient was never allowlisted and no adapter serves the chain: the approval answers
    // the threshold, not the rest of the policy.
    expect(res.json()).toMatchObject({
      status: 'rejected',
      rejectReasons: expect.arrayContaining(['RECIPIENT_NOT_ALLOWED', 'CHAIN_NOT_ALLOWED']),
    })
  })

  it('answers 409 when the intent was already decided', async () => {
    const body = { intentId: INTENT_ID, decision: 'approve', telegramUserId: '1' }
    await app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: auth(BOT_TOKEN),
      payload: body,
    })
    const again = await app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: auth(BOT_TOKEN),
      payload: body,
    })
    expect(again.statusCode).toBe(409)
  })

  it('answers 404 for an intent that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: auth(BOT_TOKEN),
      payload: {
        intentId: '00000000-0000-4000-8000-000000000000',
        decision: 'approve',
        telegramUserId: '1',
      },
    })
    expect(res.statusCode).toBe(404)
  })
})
