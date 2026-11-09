import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createAgent, revokeAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { buildServer } from '../src/http/server.js'

const env = {
  ADMIN_TOKEN: 'a'.repeat(64),
  BOT_TOKEN: 'b'.repeat(64),
  BOT_URL: 'http://bot.local',
  BOT_WEBHOOK_SECRET: 'c'.repeat(64),
  LOG_LEVEL: 'fatal',
}

async function setup() {
  const db = openDb(':memory:')
  migrateDb(db)
  const token = createAgent(db, 'agent-1')
  const app = await buildServer({ db, config: loadConfig(env) })
  return { db, token, app }
}

const routes = [
  { method: 'GET', url: '/v1/agent/budget/agent-1' },
  { method: 'GET', url: '/v1/agent/intents/3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
  { method: 'POST', url: '/v1/agent/transfer', payload: {} },
  { method: 'POST', url: '/v1/agent/x402/fetch', payload: {} },
] as const

describe('revokeAgent', () => {
  it('shuts the token out of every agent route on the next request', async () => {
    const { db, token, app } = await setup()
    const call = (route: (typeof routes)[number]) =>
      app.inject({ ...route, headers: { authorization: `Bearer ${token}` } })

    expect((await call(routes[0])).statusCode).toBe(200)
    expect(revokeAgent(db, 'agent-1')).toBe('revoked')
    const codes = await Promise.all(routes.map(async (route) => (await call(route)).statusCode))
    expect(codes).toEqual([401, 401, 401, 401])
  })

  it('says when there is no such agent', async () => {
    const { db } = await setup()
    expect(revokeAgent(db, 'ghost')).toBe('not_found')
  })

  it('changes nothing for an agent already revoked', async () => {
    const { db } = await setup()
    revokeAgent(db, 'agent-1', new Date('2026-11-03T12:00:00Z'))
    expect(revokeAgent(db, 'agent-1')).toBe('already_revoked')
  })
})

describe('HOST', () => {
  it('stays on loopback unless set', () => {
    expect(loadConfig(env).HOST).toBe('127.0.0.1')
  })

  it.each(['0.0.0.0', '::', 'guard.internal'])('accepts %s', (HOST) => {
    expect(loadConfig({ ...env, HOST }).HOST).toBe(HOST)
  })

  it.each(['', 'http://0.0.0.0', 'not a host'])('refuses %j', (HOST) => {
    expect(() => loadConfig({ ...env, HOST })).toThrow(/HOST/)
  })
})
