import type { PayIntent, SimulationResult } from '@agentguard/shared'
import { APPROVAL_TTL_MS } from '@agentguard/shared'
import { and, eq, inArray, lte, or } from 'drizzle-orm'
import type { BotNotifier } from '../adapters/bot.js'
import type { Db } from '../db/client.js'
import { audit, getIntent, saveIntent } from '../db/repo.js'
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
  saveIntent(db, { ...intent, status: 'pending_approval' })
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
  // Swept by the timer before the owner pressed: nobody decided it, it ran out of time.
  if (row.status === 'expired') {
    return { ok: false, reason: 'expired' }
  }
  if (row.status !== 'pending_approval') {
    return { ok: false, reason: 'already_decided' }
  }
  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    expire(db, id)
    audit(
      db,
      { event: 'expired', intentId: id, agentId: row.agentId, reasons: ['APPROVAL_TIMEOUT'] },
      now,
    )
    return { ok: false, reason: 'expired' }
  }

  const next =
    decision === 'approve'
      ? { status: 'approved' as const, rejectReasons: [] }
      : { status: 'rejected' as const, rejectReasons: ['OWNER_REJECTED' as const] }

  db.update(intents).set(next).where(eq(intents.id, id)).run()
  // Read back through the repo, which leaves out the columns that are null rather than sending
  // them: the SPEC's PayIntent has no nulls, and the bot refuses one.
  const intent = getIntent(db, id)
  return intent ? { ok: true, intent } : { ok: false, reason: 'not_found' }
}

/**
 * Closes everything the owner never answered, and every x402 approval the agent never came back to
 * use: an approval is for a payment made now, not a standing permission. Runs on a timer.
 */
export function expirePending(db: Db, now: Date): string[] {
  const due = db
    .select({ id: intents.id, agentId: intents.agentId })
    .from(intents)
    .where(
      and(
        lte(intents.expiresAt, now.toISOString()),
        or(
          eq(intents.status, 'pending_approval'),
          and(eq(intents.status, 'approved'), eq(intents.kind, 'x402')),
        ),
      ),
    )
    .all()
  if (due.length === 0) {
    return []
  }
  db.update(intents)
    .set({ status: 'expired', rejectReasons: ['APPROVAL_TIMEOUT'] })
    .where(
      inArray(
        intents.id,
        due.map((row) => row.id),
      ),
    )
    .run()
  for (const row of due) {
    audit(
      db,
      { event: 'expired', intentId: row.id, agentId: row.agentId, reasons: ['APPROVAL_TIMEOUT'] },
      now,
    )
  }
  return due.map((row) => row.id)
}

function expire(db: Db, id: string): void {
  db.update(intents)
    .set({ status: 'expired', rejectReasons: ['APPROVAL_TIMEOUT'] })
    .where(eq(intents.id, id))
    .run()
}
