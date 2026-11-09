import { count, eq, lte } from 'drizzle-orm'
import type { Db } from './client.js'
import { enrolCodes, passkeyChallenges, passkeys } from './schema.js'

export type Passkey = typeof passkeys.$inferSelect

export function listPasskeys(db: Db): Passkey[] {
  return db.select().from(passkeys).all()
}

export function countPasskeys(db: Db): number {
  return db.select({ n: count() }).from(passkeys).get()?.n ?? 0
}

export function getPasskey(db: Db, id: string): Passkey | undefined {
  return db.select().from(passkeys).where(eq(passkeys.id, id)).get()
}

export function savePasskey(db: Db, passkey: Passkey): void {
  db.insert(passkeys).values(passkey).run()
}

export function markUsed(db: Db, id: string, counter: number, now: Date): void {
  db.update(passkeys)
    .set({ counter, lastUsedAt: now.toISOString() })
    .where(eq(passkeys.id, id))
    .run()
}

export function deletePasskey(db: Db, id: string): boolean {
  return db.delete(passkeys).where(eq(passkeys.id, id)).run().changes > 0
}

/** A new challenge replaces any earlier one for the same purpose. */
export function putChallenge(db: Db, purpose: string, challenge: string, expiresAt: Date): void {
  const row = { purpose, challenge, expiresAt: expiresAt.toISOString() }
  db.insert(passkeyChallenges)
    .values(row)
    .onConflictDoUpdate({ target: passkeyChallenges.purpose, set: row })
    .run()
}

/** The challenge for this purpose, if one is out and still valid. Reading it does not use it. */
export function peekChallenge(db: Db, purpose: string, now: Date): string | undefined {
  const row = db
    .select()
    .from(passkeyChallenges)
    .where(eq(passkeyChallenges.purpose, purpose))
    .get()
  return row !== undefined && new Date(row.expiresAt).getTime() > now.getTime()
    ? row.challenge
    : undefined
}

/** Uses a challenge up. Called only once an answer to it has been verified. */
export function dropChallenge(db: Db, purpose: string): void {
  db.delete(passkeyChallenges).where(eq(passkeyChallenges.purpose, purpose)).run()
}

/** Removes expired challenges and enrolment codes; run by the sweep. */
export function pruneExpired(db: Db, now: Date): void {
  const at = now.toISOString()
  db.delete(passkeyChallenges).where(lte(passkeyChallenges.expiresAt, at)).run()
  db.delete(enrolCodes).where(lte(enrolCodes.expiresAt, at)).run()
}

export function putEnrolCode(db: Db, hash: string, expiresAt: Date): void {
  db.insert(enrolCodes).values({ hash, expiresAt: expiresAt.toISOString() }).run()
}

export function enrolCodeValid(db: Db, hash: string, now: Date): boolean {
  const row = db.select().from(enrolCodes).where(eq(enrolCodes.hash, hash)).get()
  return row !== undefined && new Date(row.expiresAt).getTime() > now.getTime()
}

/** Uses the code up, whatever happens next: a code answers one enrolment attempt. */
export function takeEnrolCode(db: Db, hash: string, now: Date): boolean {
  const valid = enrolCodeValid(db, hash, now)
  db.delete(enrolCodes).where(eq(enrolCodes.hash, hash)).run()
  return valid
}
