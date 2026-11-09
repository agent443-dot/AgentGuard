import type { Amount, Mandate } from '@agentguard/shared'
import { and, eq, gt, inArray, lte } from 'drizzle-orm'
import { parseAmount, toAmount } from '../domain/amount.js'
import type { Db } from './client.js'
import { mandates } from './schema.js'

type Row = typeof mandates.$inferSelect

function toMandate(row: Row): Mandate {
  const { ttlSeconds: _ttl, ...mandate } = row
  return mandate
}

export function insertMandate(db: Db, mandate: Mandate, ttlSeconds: number): void {
  db.insert(mandates)
    .values({ ...mandate, ttlSeconds })
    .run()
}

export function getMandate(db: Db, id: string): Mandate | undefined {
  const row = db.select().from(mandates).where(eq(mandates.id, id)).get()
  return row && toMandate(row)
}

export function activeMandates(db: Db, agentId: string, now: Date): Mandate[] {
  return db
    .select()
    .from(mandates)
    .where(
      and(
        eq(mandates.agentId, agentId),
        eq(mandates.status, 'active'),
        gt(mandates.expiresAt, now.toISOString()),
      ),
    )
    .all()
    .map(toMandate)
}

/** Called under the agent's lock, so the read and the write cannot interleave with another payment. */
export function addMandateSpend(db: Db, id: string, amount: Amount): void {
  const row = db.select().from(mandates).where(eq(mandates.id, id)).get()
  if (row === undefined) {
    return
  }
  const spent = parseAmount(row.spent) + parseAmount(amount)
  db.update(mandates)
    .set({
      spent: toAmount(spent),
      ...(spent >= parseAmount(row.budget) ? { status: 'exhausted' as const } : {}),
    })
    .where(eq(mandates.id, id))
    .run()
}

export type MandateDecision =
  | { ok: true; mandate: Mandate }
  | { ok: false; reason: 'not_found' | 'already_decided' | 'expired' }

/** The owner's answer to a mandate the agent asked for. Its time starts now, not when asked. */
export function decideMandate(
  db: Db,
  id: string,
  decision: 'approve' | 'reject',
  now: Date,
): MandateDecision {
  const row = db.select().from(mandates).where(eq(mandates.id, id)).get()
  if (row === undefined) {
    return { ok: false, reason: 'not_found' }
  }
  if (row.status === 'expired') {
    return { ok: false, reason: 'expired' }
  }
  if (row.status !== 'pending_approval') {
    return { ok: false, reason: 'already_decided' }
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    db.update(mandates).set({ status: 'expired' }).where(eq(mandates.id, id)).run()
    return { ok: false, reason: 'expired' }
  }
  const next =
    decision === 'approve'
      ? {
          status: 'active' as const,
          expiresAt: new Date(now.getTime() + row.ttlSeconds * 1000).toISOString(),
        }
      : { status: 'revoked' as const }
  db.update(mandates).set(next).where(eq(mandates.id, id)).run()
  return { ok: true, mandate: toMandate({ ...row, ...next }) }
}

/** Ends a pending or active mandate. Anything already over is left as it is. */
export function revokeMandate(db: Db, id: string): Mandate | undefined {
  db.update(mandates)
    .set({ status: 'revoked' })
    .where(and(eq(mandates.id, id), inArray(mandates.status, ['pending_approval', 'active'])))
    .run()
  return getMandate(db, id)
}

/** Closes pending mandates the owner never answered and active ones whose time is up. */
export function expireMandates(db: Db, now: Date): number {
  return db
    .update(mandates)
    .set({ status: 'expired' })
    .where(
      and(
        inArray(mandates.status, ['pending_approval', 'active']),
        lte(mandates.expiresAt, now.toISOString()),
      ),
    )
    .run().changes
}
