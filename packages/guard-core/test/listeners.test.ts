import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { buildServers, type Server } from '../src/http/server.js'

const ADMIN = 'a'.repeat(64)
const BOT = 'b'.repeat(64)
// Fly's proxy: every request reaches the public listener from this one address.
const PROXY = '172.16.0.2'

async function split(perIp = 100) {
  const db = openDb(':memory:')
  migrateDb(db)
  const token = createAgent(db, 'agent-1')
  const config = loadConfig({
    ADMIN_TOKEN: ADMIN,
    BOT_TOKEN: BOT,
    BOT_URL: 'http://bot.local',
    BOT_WEBHOOK_SECRET: 'c'.repeat(64),
    LOG_LEVEL: 'fatal',
    RATE_LIMIT_PER_IP: String(perIp),
    RATE_LIMIT_PER_AGENT: '100',
  })
  const [privateApp, publicApp] = (await buildServers({ db, config }, ['private', 'public'])) as [
    Server,
    Server,
  ]
  const agent = (app = publicApp, flyClientIp?: string) =>
    app.inject({
      method: 'GET',
      url: '/v1/agent/budget/agent-1',
      headers: {
        authorization: `Bearer ${token}`,
        ...(flyClientIp === undefined ? {} : { 'fly-client-ip': flyClientIp }),
      },
      remoteAddress: PROXY,
    })
  const admin = (app = privateApp, flyClientIp?: string) =>
    app.inject({
      method: 'GET',
      url: '/v1/admin/policy/agent-1',
      headers: {
        authorization: `Bearer ${ADMIN}`,
        ...(flyClientIp === undefined ? {} : { 'fly-client-ip': flyClientIp }),
      },
      remoteAddress: PROXY,
    })
  const bot = (app = privateApp) =>
    app.inject({
      method: 'POST',
      url: '/v1/bot/decision',
      headers: { authorization: `Bearer ${BOT}` },
      payload: {},
    })
  return { privateApp, publicApp, agent, admin, bot }
}

describe('the public and private listeners', () => {
  it('serves the agent routes only on the public listener', async () => {
    const { privateApp, publicApp, agent } = await split()
    expect((await agent(publicApp)).statusCode).toBe(200)
    expect((await agent(privateApp)).statusCode).toBe(404)
  })

  it('serves the admin and bot routes only on the private listener', async () => {
    const { privateApp, publicApp, admin, bot } = await split()
    expect((await admin(privateApp)).statusCode).toBe(200)
    expect((await bot(privateApp)).statusCode).toBe(400)
    expect((await admin(publicApp)).statusCode).toBe(404)
    expect((await bot(publicApp)).statusCode).toBe(404)
  })

  it('answers the health check on both', async () => {
    const { privateApp, publicApp } = await split()
    for (const app of [privateApp, publicApp]) {
      expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ status: 'ok' })
    }
  })

  it('limits each real client behind the proxy on its own, by Fly-Client-IP', async () => {
    const { publicApp, agent } = await split(2)
    const codes = []
    for (const ip of ['203.0.113.1', '203.0.113.1', '203.0.113.1', '203.0.113.2']) {
      codes.push((await agent(publicApp, ip)).statusCode)
    }
    expect(codes).toEqual([200, 200, 429, 200])
  })

  it('ignores Fly-Client-IP on the private listener, where no proxy sets it', async () => {
    const { privateApp, admin } = await split(2)
    const codes = []
    for (const ip of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
      codes.push((await admin(privateApp, ip)).statusCode)
    }
    expect(codes).toEqual([200, 200, 429])
  })

  it('falls back to the connection address when the header is not an IP', async () => {
    const { publicApp, agent } = await split(1)
    expect((await agent(publicApp, 'not-an-ip')).statusCode).toBe(200)
    expect((await agent(publicApp, 'also-not')).statusCode).toBe(429)
  })
})
