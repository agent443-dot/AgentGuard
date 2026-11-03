import { loadConfig } from '../config.js'
import { createAgent } from '../db/agents.js'
import { migrateDb, openDb } from '../db/client.js'

// Usage: pnpm create-agent <agentId>. Prints the agent's bearer token once; only its hash is kept.
// The policy starts empty, which denies everything until the owner sets one with PUT
// /v1/admin/policy/:agentId.
const agentId = process.argv[2]
if (agentId === undefined || !/^[\w-]{1,64}$/.test(agentId)) {
  console.error('usage: pnpm create-agent <agentId>')
  process.exit(1)
}

const db = openDb(loadConfig().DATABASE_URL)
migrateDb(db)
const token = createAgent(db, agentId)
console.log(`agent ${agentId} created. Token, shown once:\n${token}`)
