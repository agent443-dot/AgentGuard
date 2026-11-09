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
    .set({ spent: toAmount(spent) })
    .where(eq(mandates.id, id))
    .run()
  // Only an active mandate becomes exhausted: one revoked or expired while this payment was in
  // flight keeps that status, which says more.
  if (spent >= parseAmount(row.budget)) {
    db.update(mandates)
      .set({ status: 'exhausted' })
      .where(and(eq(mandates.id, id), eq(mandates.status, 'active')))
      .run()
  }
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

export type Revoked =
  { ok: true; mandate: Mandate } | { ok: false; reason: 'not_found' | 'not_open' }

/** Ends a pending or active mandate. One that is already over is left as it is, and said so. */
export function revokeMandate(db: Db, id: string): Revoked {
  const changed = db
    .update(mandates)
    .set({ status: 'revoked' })
    .where(and(eq(mandates.id, id), inArray(mandates.status, ['pending_approval', 'active'])))
    .run().changes
  const mandate = getMandate(db, id)
  if (mandate === undefined) {
    return { ok: false, reason: 'not_found' }
  }
  return changed > 0 ? { ok: true, mandate } : { ok: false, reason: 'not_open' }
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
