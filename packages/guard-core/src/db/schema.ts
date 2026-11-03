import type {
  Address,
  Amount,
  ChainId,
  IntentStatus,
  PayIntentKind,
  PolicyDecision,
  RejectCode,
} from '@agentguard/shared'
import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Amounts are stored as text, not integers. They are decimal strings of atomic units everywhere else,
 * and text keeps that contract end to end with no chance of a driver handing back a double.
 * Timestamps are ISO-8601 strings for the same reason: they survive a round trip unchanged.
 */

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** SHA-256 of the bearer token. The token itself is shown once, at creation, and never stored. */
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
})

export const policies = sqliteTable('policies', {
  agentId: text('agent_id')
    .primaryKey()
    .references(() => agents.id),
  chains: text('chains', { mode: 'json' }).$type<ChainId[]>().notNull(),
  tokens: text('tokens', { mode: 'json' }).$type<Address[]>().notNull(),
  perTxMax: text('per_tx_max').$type<Amount>().notNull(),
  dailyMax: text('daily_max').$type<Amount>().notNull(),
  approvalThreshold: text('approval_threshold').$type<Amount>().notNull(),
  allowedRecipients: text('allowed_recipients', { mode: 'json' }).$type<Address[]>().notNull(),
  allowedDomains: text('allowed_domains', { mode: 'json' }).$type<string[]>().notNull(),
  paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})

export const intents = sqliteTable(
  'intents',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    kind: text('kind').$type<PayIntentKind>().notNull(),
    chain: text('chain').$type<ChainId>().notNull(),
    token: text('token').$type<Address>().notNull(),
    amount: text('amount').$type<Amount>().notNull(),
    recipient: text('recipient').$type<Address>().notNull(),
    domain: text('domain'),
    /** Agent-provided. Stored so the owner sees it, never read back into a decision. */
    reason: text('reason').notNull(),
    status: text('status').$type<IntentStatus>().notNull(),
    rejectReasons: text('reject_reasons', { mode: 'json' }).$type<RejectCode[]>().notNull(),
    txId: text('tx_id'),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    index('intents_agent_status').on(t.agentId, t.status),
    /** The expiry sweep scans this; without it every pass is a full table read. */
    index('intents_expires_at').on(t.expiresAt),
  ],
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: text('at').notNull(),
    intentId: text('intent_id').references(() => intents.id),
    agentId: text('agent_id'),
    /** policy_evaluated | simulated | signed | sent | owner_decision | expired | paused | killed */
    event: text('event').notNull(),
    decision: text('decision').$type<PolicyDecision>(),
    reasons: text('reasons', { mode: 'json' }).$type<RejectCode[]>(),
    /** Anything chain- or event-specific. Never a key, a token or a full header. */
    detail: text('detail', { mode: 'json' }),
  },
  (t) => [index('audit_log_intent').on(t.intentId), index('audit_log_at').on(t.at)],
)

/**
 * Kept per chain so the offchain total can be reconciled against each chain's onchain cap, which is
 * enforced separately. The policy's dailyMax applies to the sum across chains.
 */
export const dailySpend = sqliteTable(
  'daily_spend',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    chain: text('chain').$type<ChainId>().notNull(),
    /** UTC calendar day, YYYY-MM-DD. The onchain caps reset on their own schedule. */
    day: text('day').notNull(),
    spent: text('spent')
      .$type<Amount>()
      .notNull()
      .default(sql`'0'`),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.chain, t.day] })],
)
