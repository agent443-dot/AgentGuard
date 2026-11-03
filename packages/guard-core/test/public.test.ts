import { describe, expect, it } from 'vitest'
import { buildServer, createAgent, loadConfig, migrateDb, openDb } from '../src/index.js'
import { getPolicy } from '../src/db/repo.js'

const config = loadConfig({
  ADMIN_TOKEN: 'a'.repeat(64),
  BOT_TOKEN: 'b'.repeat(64),
  BOT_URL: 'http://bot.local',
  BOT_WEBHOOK_SECRET: 'c'.repeat(64),
  LOG_LEVEL: 'fatal',
})

describe('public surface for e2e', () => {
  it('creates an agent whose token works and whose policy denies everything', async () => {
    const db = openDb(':memory:')
    migrateDb(db)
    const token = createAgent(db, 'e2e-agent')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(getPolicy(db, 'e2e-agent')).toMatchObject({
      chains: [],
      allowedRecipients: [],
      allowedDomains: [],
      perTxMax: '0',
    })

    const app = await buildServer({ db, config })
    const res = await app.inject({
      method: 'GET',
      url: '/v1/agent/budget/e2e-agent',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.json()).toMatchObject({ dailyMax: '0', paused: false })
  })

  it('refuses a second agent with the same id and leaves no half-made row', () => {
    const db = openDb(':memory:')
    migrateDb(db)
    createAgent(db, 'dup')
    expect(() => createAgent(db, 'dup')).toThrow()
    expect(getPolicy(db, 'dup')).toBeDefined()
  })
})
