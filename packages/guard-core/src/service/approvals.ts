import type { PayIntent, SimulationResult } from '@agentguard/shared'
import { APPROVAL_TTL_MS } from '@agentguard/shared'
import { and, eq, lte } from 'drizzle-orm'
import type { BotNotifier } from '../adapters/bot.js'
import type { Db } from '../db/client.js'
import { intents } from '../db/schema.js'

export type Decision = 'approve' | 'reject'

export function expiresAt(createdAt: Date): string {
  return new Date(createdAt.getTime() + APPROVAL_TTL_MS).toISOString()
}

/**
 * Saves the intent as pending and asks the owner. The intent is persisted before the webhook goes
 * out, so a bot that never answers still leaves something for the expiry sweep to close.
 */
export async function requestApproval(
  db: Db,
  bot: BotNotifier,
  intent: PayIntent,
  simulation: SimulationResult,
): Promise<void> {
  db.insert(intents)
    .values({ ...intent, status: 'pending_approval' })
    .run()
  await bot.requestApproval({ intent, simulation, approveBefore: intent.expiresAt })
}

export type DecisionResult =
  | { ok: true; intent: PayIntent }
  | { ok: false; reason: 'not_found' | 'already_decided' | 'expired' }

/**
 * The owner's answer only counts while the intent is still pending and still inside its window.
 * A late approval is treated as an expiry, not as consent: the figures it was shown may be stale.
 */
export function decide(db: Db, id: string, decision: Decision, now: Date): DecisionResult {
  const row = db.select().from(intents).where(eq(intents.id, id)).get()
  if (!row) {
    return { ok: false, reason: 'not_found' }
  }
  if (row.status !== 'pending_approval') {
    return { ok: false, reason: 'already_decided' }
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    expire(db, id)
    return { ok: false, reason: 'expired' }
  }

  const next =
    decision === 'approve'
      ? { status: 'approved' as const, rejectReasons: [] }
      : { status: 'rejected' as const, rejectReasons: ['OWNER_REJECTED' as const] }

  db.update(intents).set(next).where(eq(intents.id, id)).run()
  return { ok: true, intent: { ...row, ...next } as PayIntent }
}

/** Closes everything the owner never answered. Runs on a timer and before any budget read. */
export function expirePending(db: Db, now: Date): number {
  return db
    .update(intents)
    .set({ status: 'expired', rejectReasons: ['APPROVAL_TIMEOUT'] })
    .where(and(eq(intents.status, 'pending_approval'), lte(intents.expiresAt, now.toISOString())))
    .run().changes
}

function expire(db: Db, id: string): void {
  db.update(intents)
    .set({ status: 'expired', rejectReasons: ['APPROVAL_TIMEOUT'] })
    .where(eq(intents.id, id))
    .run()
}
