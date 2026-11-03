import type {
  Amount,
  ChainId,
  PayIntent,
  Policy,
  PolicyDecision,
  RejectCode,
} from '@agentguard/shared'
import { and, eq, gt, sql } from 'drizzle-orm'
import { matchesHash } from '../domain/auth.js'
import type { Db } from './client.js'
import { agents, auditLog, dailySpend, intents, policies } from './schema.js'

export function findAgentByToken(db: Db, token: string): { id: string } | undefined {
  // Tokens are hashed with a salt-free digest, so the lookup is a scan over a small table rather
  // than an index hit. Comparing every row also keeps the work constant per request.
  const rows = db
    .select({ id: agents.id, hash: agents.tokenHash, revokedAt: agents.revokedAt })
    .from(agents)
    .all()
  let match: { id: string } | undefined
  for (const row of rows) {
    if (matchesHash(token, row.hash) && row.revokedAt === null) {
      match = { id: row.id }
    }
  }
  return match
}

export function agentExists(db: Db, id: string): boolean {
  return db.select({ id: agents.id }).from(agents).where(eq(agents.id, id)).get() !== undefined
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

type IntentRow = typeof intents.$inferSelect

function toIntent(row: IntentRow): PayIntent {
  const { domain, txId, ...rest } = row
  return {
    ...rest,
    ...(domain === null ? {} : { domain }),
    ...(txId === null ? {} : { txId }),
  }
}

export function getIntent(db: Db, id: string): PayIntent | undefined {
  const row = db.select().from(intents).where(eq(intents.id, id)).get()
  return row && toIntent(row)
}

export function saveIntent(db: Db, intent: PayIntent): void {
  const row = { ...intent, domain: intent.domain ?? null, txId: intent.txId ?? null }
  db.insert(intents).values(row).onConflictDoUpdate({ target: intents.id, set: row }).run()
}

/**
 * An x402 payment the owner approved, waiting for the agent to come back for it. It matches only on
 * the terms the owner saw, and only once: executing it moves it out of `approved`.
 */
export function findApprovedX402(db: Db, terms: PayIntent, now: Date): PayIntent | undefined {
  const row = db
    .select()
    .from(intents)
    .where(
      and(
        eq(intents.agentId, terms.agentId),
        eq(intents.kind, 'x402'),
        eq(intents.status, 'approved'),
        eq(intents.chain, terms.chain),
        eq(intents.token, terms.token),
        eq(intents.amount, terms.amount),
        eq(intents.recipient, terms.recipient),
        eq(intents.domain, terms.domain ?? ''),
        gt(intents.expiresAt, now.toISOString()),
      ),
    )
    .get()
  return row && toIntent(row)
}

export interface AuditEntry {
  event: string
  intentId?: string
  agentId?: string
  decision?: PolicyDecision
  reasons?: RejectCode[]
  detail?: Record<string, unknown>
}

export function audit(db: Db, entry: AuditEntry, at: Date): void {
  db.insert(auditLog)
    .values({ ...entry, at: at.toISOString() })
    .run()
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
