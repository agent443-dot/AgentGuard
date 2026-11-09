import type { PayIntent } from '@agentguard/shared'
import { and, eq } from 'drizzle-orm'
import type { Pin } from '../domain/pinning.js'
import type { Db } from './client.js'
import { x402Pins } from './schema.js'

export function getPin(db: Db, agentId: string, domain: string): Pin | undefined {
  return db
    .select({
      chain: x402Pins.chain,
      token: x402Pins.token,
      recipient: x402Pins.recipient,
      amount: x402Pins.amount,
    })
    .from(x402Pins)
    .where(and(eq(x402Pins.agentId, agentId), eq(x402Pins.domain, domain)))
    .get()
}

/** Pins an x402 intent's terms as the ones its domain is expected to ask for next time. */
export function pin(db: Db, intent: PayIntent, now: Date): void {
  if (intent.kind !== 'x402' || intent.domain === undefined) {
    return
  }
  const terms = {
    chain: intent.chain,
    token: intent.token,
    recipient: intent.recipient,
    amount: intent.amount,
    updatedAt: now.toISOString(),
  }
  db.insert(x402Pins)
    .values({ agentId: intent.agentId, domain: intent.domain, ...terms })
    .onConflictDoUpdate({ target: [x402Pins.agentId, x402Pins.domain], set: terms })
    .run()
}
