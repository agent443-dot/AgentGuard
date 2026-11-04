import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { buildServer } from '../src/http/server.js'

async function setup(limits: { perIp: number; perAgent: number }) {
  const db = openDb(':memory:')
  migrateDb(db)
  const one = createAgent(db, 'agent-1')
  const two = createAgent(db, 'agent-2')
  const app = await buildServer({
    db,
    config: loadConfig({
      ADMIN_TOKEN: 'a'.repeat(64),
      BOT_TOKEN: 'b'.repeat(64),
      BOT_URL: 'http://bot.local',
      BOT_WEBHOOK_SECRET: 'c'.repeat(64),
      LOG_LEVEL: 'fatal',
      RATE_LIMIT_PER_IP: String(limits.perIp),
      RATE_LIMIT_PER_AGENT: String(limits.perAgent),
    }),
  })
  const budget = (token: string, agent: string, ip: string) =>
    app.inject({
      method: 'GET',
      url: `/v1/agent/budget/${agent}`,
      headers: { authorization: `Bearer ${token}` },
      remoteAddress: ip,
    })
  return { one, two, budget }
}

describe('rate limits', () => {
  it('caps one agent token across every address it comes from', async () => {
    const { one, budget } = await setup({ perIp: 100, perAgent: 3 })
    const codes = []
    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4']) {
      codes.push((await budget(one, 'agent-1', ip)).statusCode)
    }
    expect(codes).toEqual([200, 200, 200, 429])
  })

  it('keeps one agent hitting its limit from using up another', async () => {
    const { one, two, budget } = await setup({ perIp: 100, perAgent: 2 })
    await budget(one, 'agent-1', '10.0.0.1')
    await budget(one, 'agent-1', '10.0.0.1')
    expect((await budget(one, 'agent-1', '10.0.0.1')).statusCode).toBe(429)
    expect((await budget(two, 'agent-2', '10.0.0.1')).statusCode).toBe(200)
  })

  it('caps one address across every token it presents', async () => {
    const { one, two, budget } = await setup({ perIp: 3, perAgent: 100 })
    const codes = [
      (await budget(one, 'agent-1', '10.0.0.9')).statusCode,
      (await budget(two, 'agent-2', '10.0.0.9')).statusCode,
      (await budget('x'.repeat(64), 'agent-1', '10.0.0.9')).statusCode,
      (await budget(two, 'agent-2', '10.0.0.9')).statusCode,
    ]
    expect(codes).toEqual([200, 200, 401, 429])
  })

  it('answers a limited request with 429 and a JSON error', async () => {
    const { one, budget } = await setup({ perIp: 100, perAgent: 1 })
    await budget(one, 'agent-1', '10.0.0.1')
    const res = await budget(one, 'agent-1', '10.0.0.1')
    expect(res.statusCode).toBe(429)
    expect(res.json()).toHaveProperty('error')
    expect(res.headers['retry-after']).toBeDefined()
  })
})
