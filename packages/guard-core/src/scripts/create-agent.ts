import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.js'
import { openDb, schema } from '../db/client.js'
import { hashToken } from '../domain/auth.js'

// Usage: pnpm create-agent <agentId>. Prints the agent's bearer token once; only its hash is kept.
// The policy starts empty, which denies everything until the owner sets one with PUT
// /v1/admin/policy/:agentId.
const agentId = process.argv[2]
if (agentId === undefined || !/^[\w-]{1,64}$/.test(agentId)) {
  console.error('usage: pnpm create-agent <agentId>')
  process.exit(1)
}

const db = openDb(loadConfig().DATABASE_URL)
migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })

const token = randomBytes(32).toString('hex')
const now = new Date().toISOString()
db.insert(schema.agents)
  .values({ id: agentId, name: agentId, tokenHash: hashToken(token), createdAt: now })
  .run()
db.insert(schema.policies)
  .values({
    agentId,
    chains: [],
    tokens: [],
    perTxMax: '0',
    dailyMax: '0',
    approvalThreshold: '0',
    allowedRecipients: [],
    allowedDomains: [],
    paused: false,
    updatedAt: now,
  })
  .run()

console.log(`agent ${agentId} created. Token, shown once:\n${token}`)
