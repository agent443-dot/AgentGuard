import { randomBytes } from 'node:crypto'
import { hashToken } from '../domain/auth.js'
import type { Db } from './client.js'
import { agents, policies } from './schema.js'

/**
 * Creates an agent with a deny-all policy and returns its bearer token. The token exists only in
 * the return value: the table keeps its hash.
 */
export function createAgent(db: Db, agentId: string, now = new Date()): string {
  const token = randomBytes(32).toString('hex')
  const at = now.toISOString()
  db.transaction((tx) => {
    tx.insert(agents)
      .values({ id: agentId, name: agentId, tokenHash: hashToken(token), createdAt: at })
      .run()
    tx.insert(policies)
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
        updatedAt: at,
      })
      .run()
  })
  return token
}
