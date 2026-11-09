import type { Receipt } from '@agentguard/shared'
import { and, eq, gte, lte } from 'drizzle-orm'
import type { Db } from './client.js'
import { clearances, ownerApprovals, receipts } from './schema.js'

export type Clearance = typeof clearances.$inferSelect

/** The latest clearance wins: an approved payment is cleared again just before it is sent. */
export function saveClearance(db: Db, clearance: Clearance): void {
  db.insert(clearances)
    .values(clearance)
    .onConflictDoUpdate({ target: clearances.intentId, set: clearance })
    .run()
}

export function getClearance(db: Db, intentId: string): Clearance | undefined {
  return db.select().from(clearances).where(eq(clearances.intentId, intentId)).get()
}

export function recordOwnerApproval(db: Db, intentId: string, method: 'owner' | 'passkey'): void {
  db.insert(ownerApprovals)
    .values({ intentId, method })
    .onConflictDoUpdate({ target: ownerApprovals.intentId, set: { method } })
    .run()
}

export function ownerApprovalMethod(db: Db, intentId: string): 'owner' | 'passkey' | undefined {
  return db.select().from(ownerApprovals).where(eq(ownerApprovals.intentId, intentId)).get()?.method
}

export function saveReceipt(db: Db, receipt: Receipt): void {
  db.insert(receipts)
    .values({ intentId: receipt.intent.id, issuedAt: receipt.issuedAt, body: receipt })
    .onConflictDoNothing()
    .run()
}

export function getReceipt(db: Db, intentId: string): Receipt | undefined {
  return db.select().from(receipts).where(eq(receipts.intentId, intentId)).get()?.body
}

/** Receipts issued from `from` up to and including `to`. */
export function receiptsBetween(db: Db, from: Date, to: Date): Receipt[] {
  return db
    .select()
    .from(receipts)
    .where(
      and(gte(receipts.issuedAt, from.toISOString()), lte(receipts.issuedAt, to.toISOString())),
    )
    .orderBy(receipts.issuedAt)
    .all()
    .map((row) => row.body)
}
