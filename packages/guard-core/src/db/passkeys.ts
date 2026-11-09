import { count, eq } from 'drizzle-orm'
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

export function setCounter(db: Db, id: string, counter: number): void {
  db.update(passkeys).set({ counter }).where(eq(passkeys.id, id)).run()
}

/** A new challenge replaces any earlier one for the same purpose. */
export function putChallenge(db: Db, purpose: string, challenge: string, expiresAt: Date): void {
  const row = { purpose, challenge, expiresAt: expiresAt.toISOString() }
  db.insert(passkeyChallenges)
    .values(row)
    .onConflictDoUpdate({ target: passkeyChallenges.purpose, set: row })
    .run()
}

/** Removes the challenge and returns it if it has not expired: each one answers once. */
export function takeChallenge(db: Db, purpose: string, now: Date): string | undefined {
  const row = db
    .select()
    .from(passkeyChallenges)
    .where(eq(passkeyChallenges.purpose, purpose))
    .get()
  db.delete(passkeyChallenges).where(eq(passkeyChallenges.purpose, purpose)).run()
  return row !== undefined && new Date(row.expiresAt).getTime() > now.getTime()
    ? row.challenge
    : undefined
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
