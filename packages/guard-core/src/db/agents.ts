import type { AgentSummary } from '@agentguard/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { hashToken } from '../domain/auth.js'
import type { Db } from './client.js'
import { agents, policies } from './schema.js'

/**
 * Creates an agent with a deny-all policy and returns its bearer token. The token exists only in
 * the return value: the table keeps its hash. The agent starts in shadow mode, so even once the
 * owner opens its policy it pays nothing until the owner has watched it and switched it live.
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
        mode: 'shadow',
        updatedAt: at,
      })
      .run()
  })
  return token
}

export type Revocation = 'revoked' | 'already_revoked' | 'not_found'

/**
 * Takes effect on the next request: every agent route looks the token up in the table, and the
 * lookup skips revoked rows. The row stays so the audit log and intents keep their agent.
 */
export function revokeAgent(db: Db, agentId: string, now = new Date()): Revocation {
  const changed = db
    .update(agents)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(agents.id, agentId), isNull(agents.revokedAt)))
    .run().changes
  if (changed > 0) {
    return 'revoked'
  }
  const exists = db.select({ id: agents.id }).from(agents).where(eq(agents.id, agentId)).get()
  return exists ? 'already_revoked' : 'not_found'
}

/** Every agent still holding a working token, with what the owner most needs to see. */
export function listAgents(db: Db): AgentSummary[] {
  return db
    .select({ agentId: agents.id, paused: policies.paused, mode: policies.mode })
    .from(agents)
    .innerJoin(policies, eq(policies.agentId, agents.id))
    .where(isNull(agents.revokedAt))
    .orderBy(agents.id)
    .all()
}
