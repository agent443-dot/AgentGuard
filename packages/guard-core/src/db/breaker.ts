import type { PayIntent } from '@agentguard/shared'
import { and, eq, gt, lte, ne, sql } from 'drizzle-orm'
import type { Db } from './client.js'
import { clearedPayments } from './schema.js'

const WINDOW_MS = 60_000

/**
 * Records the payment if it fits under the limit over the last minute, and says whether it did.
 * The payment itself is left out of the count, so clearing it a second time cannot trip on itself.
 */
export function admit(db: Db, intent: PayIntent, limit: number, now: Date): boolean {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString()
  db.delete(clearedPayments)
    .where(and(eq(clearedPayments.agentId, intent.agentId), lte(clearedPayments.at, since)))
    .run()
  const recent =
    db
      .select({ n: sql<number>`count(*)` })
      .from(clearedPayments)
      .where(
        and(
          eq(clearedPayments.agentId, intent.agentId),
          gt(clearedPayments.at, since),
          ne(clearedPayments.intentId, intent.id),
        ),
      )
      .get()?.n ?? 0
  if (recent >= limit) {
    return false
  }
  db.insert(clearedPayments)
    .values({ intentId: intent.id, agentId: intent.agentId, at: now.toISOString() })
    .onConflictDoNothing()
    .run()
  return true
}

/** Forgets an agent's recent payments, so resuming it does not trip the breaker again at once. */
export function clearWindow(db: Db, agentId: string): void {
  db.delete(clearedPayments).where(eq(clearedPayments.agentId, agentId)).run()
}
