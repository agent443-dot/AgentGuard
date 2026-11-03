import { loadConfig } from '../config.js'
import { revokeAgent } from '../db/agents.js'
import { migrateDb, openDb } from '../db/client.js'

// Usage: pnpm revoke-agent <agentId>. The agent's token stops working on its next request.
const agentId = process.argv[2]
if (agentId === undefined || !/^[\w-]{1,64}$/.test(agentId)) {
  console.error('usage: pnpm revoke-agent <agentId>')
  process.exit(1)
}

const db = openDb(loadConfig().DATABASE_URL)
migrateDb(db)
const outcome = revokeAgent(db, agentId)
const messages = {
  revoked: `agent ${agentId} revoked`,
  already_revoked: `agent ${agentId} was already revoked; nothing changed`,
  not_found: `no agent ${agentId}; nothing changed`,
}
console.log(messages[outcome])
process.exit(outcome === 'not_found' ? 1 : 0)
