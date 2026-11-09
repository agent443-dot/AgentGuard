import { buildServer, loadConfig, migrateDb, openDb, StubChain } from '@agentguard/guard-core'
import type { ChainId } from '@agentguard/shared'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The restore drill (LAUNCH.md §2): opens a copy of a guard-core backup with this repo's own code,
// migrations included, and prints what the guard would know after a restore. That means each
// agent's policy and today's spend as the admin routes serve them, plus the audit trail. The backup
// itself is never opened for writing, and no token hash is printed.

const source = process.argv[2]
if (source === undefined || !existsSync(source)) {
  console.error('usage: pnpm --filter @agentguard/e2e restore-drill <backup.db>')
  process.exit(1)
}
const copy = join(mkdtempSync(join(tmpdir(), 'agentguard-restore-')), 'guard.db')
copyFileSync(source, copy)
// A copy of a live WAL database is only whole with its sidecars. A db:backup file has none.
for (const suffix of ['-wal', '-shm']) {
  if (existsSync(source + suffix)) {
    copyFileSync(source + suffix, copy + suffix)
  }
}

const db = openDb(`file:${copy}`)
migrateDb(db)
const sqlite = db.$client
const rows = <T>(query: string) => sqlite.prepare(query).all() as T[]

const agents = rows<{ id: string; revoked: number }>(
  'select id, revoked_at is not null as revoked from agents order by id',
)
const chains = new Set(
  rows<{ chains: string }>('select chains from policies').flatMap(
    (row) => JSON.parse(row.chains) as ChainId[],
  ),
)

// Stub adapters only: the drill reads the restored state and never reaches a chain or a key.
const admin = randomBytes(32).toString('hex')
const server = await buildServer({
  db,
  config: loadConfig({
    ADMIN_TOKEN: admin,
    BOT_TOKEN: randomBytes(32).toString('hex'),
    BOT_URL: 'http://127.0.0.1:1',
    BOT_WEBHOOK_SECRET: randomBytes(32).toString('hex'),
    LOG_LEVEL: 'fatal',
  }),
  chains: new Map([...chains].map((chain) => [chain, new StubChain(chain)])),
})

const get = async (path: string) => {
  const response = await server.inject({
    method: 'GET',
    url: path,
    headers: { authorization: `Bearer ${admin}` },
  })
  return response.statusCode === 200 ? (response.json() as unknown) : `HTTP ${response.statusCode}`
}

const restored = []
for (const agent of agents) {
  restored.push({
    agentId: agent.id,
    revoked: agent.revoked === 1,
    policy: await get(`/v1/admin/policy/${agent.id}`),
    budget: await get(`/v1/admin/budget/${agent.id}`),
  })
}

console.log(
  JSON.stringify(
    {
      restoredFrom: source,
      agents: restored,
      intents: rows('select status, count(*) as n from intents group by status order by status'),
      dailySpend: rows(
        'select agent_id, chain, day, spent from daily_spend order by day, agent_id',
      ),
      auditEvents: rows<{ n: number }>('select count(*) as n from audit_log')[0]?.n,
      lastAudit: rows(
        'select at, agent_id, event from audit_log order by id desc limit 8',
      ).reverse(),
    },
    null,
    2,
  ),
)
await server.close()
