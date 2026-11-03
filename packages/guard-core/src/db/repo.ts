import type { Amount, ChainId, Policy } from '@agentguard/shared'
import { and, eq, sql } from 'drizzle-orm'
import { matchesHash } from '../domain/auth.js'
import type { Db } from './client.js'
import { agents, dailySpend, intents, policies } from './schema.js'

export function findAgentByToken(db: Db, token: string): { id: string } | undefined {
  // Tokens are hashed with a salt-free digest, so the lookup is a scan over a small table rather
  // than an index hit. Comparing every row also keeps the work constant per request.
  const rows = db
    .select({ id: agents.id, hash: agents.tokenHash, revokedAt: agents.revokedAt })
    .from(agents)
    .all()
  const match = rows.find((row) => row.revokedAt === null && matchesHash(token, row.hash))
  return match ? { id: match.id } : undefined
}

export function getPolicy(db: Db, agentId: string): Policy | undefined {
  const row = db.select().from(policies).where(eq(policies.agentId, agentId)).get()
  if (!row) {
    return undefined
  }
  return {
    agentId: row.agentId,
    chains: row.chains,
    tokens: row.tokens,
    perTxMax: row.perTxMax,
    dailyMax: row.dailyMax,
    approvalThreshold: row.approvalThreshold,
    allowedRecipients: row.allowedRecipients,
    allowedDomains: row.allowedDomains,
    paused: row.paused,
  }
}

export function putPolicy(db: Db, policy: Policy, now: string): void {
  const row = { ...policy, updatedAt: now }
  db.insert(policies).values(row).onConflictDoUpdate({ target: policies.agentId, set: row }).run()
}

export function setPaused(db: Db, agentId: string, paused: boolean, now: string): boolean {
  const result = db
    .update(policies)
    .set({ paused, updatedAt: now })
    .where(eq(policies.agentId, agentId))
    .run()
  return result.changes > 0
}

export function pauseAll(db: Db, now: string): number {
  return db.update(policies).set({ paused: true, updatedAt: now }).run().changes
}

export function getIntent(db: Db, id: string) {
  return db.select().from(intents).where(eq(intents.id, id)).get()
}

/** The policy's daily max applies to the sum across chains; the onchain caps are per chain. */
export function spentToday(db: Db, agentId: string, day: string): Amount {
  const rows = db
    .select({ spent: dailySpend.spent })
    .from(dailySpend)
    .where(and(eq(dailySpend.agentId, agentId), eq(dailySpend.day, day)))
    .all()
  return rows.reduce((total, row) => total + BigInt(row.spent), 0n).toString()
}

export function addSpend(
  db: Db,
  agentId: string,
  chain: ChainId,
  day: string,
  amount: Amount,
): void {
  db.insert(dailySpend)
    .values({ agentId, chain, day, spent: amount })
    .onConflictDoUpdate({
      target: [dailySpend.agentId, dailySpend.chain, dailySpend.day],
      // SQLite has no bigint arithmetic on text, so the add happens as an integer and goes back as
      // text. USDC atomic units stay well inside a signed 64-bit integer.
      set: {
        spent: sql`cast(cast(${dailySpend.spent} as integer) + cast(${amount} as integer) as text)`,
      },
    })
    .run()
}

export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}
