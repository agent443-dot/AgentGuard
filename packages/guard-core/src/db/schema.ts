import type {
  Address,
  Mandate,
  Receipt,
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
  // The defaults here and in POLICY_DEFAULTS are the same values: a policy written before these
  // columns existed reads back with them.
  mode: text('mode').$type<'live' | 'shadow'>().notNull().default('live'),
  priceIncreaseMaxPct: integer('price_increase_max_pct').notNull().default(100),
  maxPaymentsPerMinute: integer('max_payments_per_minute').notNull().default(10),
  requireMandate: integer('require_mandate', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
})

/**
 * What an agent last paid each x402 domain. A later 402 from the same domain that names another
 * payee, chain or token, or a much higher price, is the shape of a compromised or swapped API, so
 * it goes to the owner even when the amount alone would not.
 */
export const x402Pins = sqliteTable(
  'x402_pins',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    domain: text('domain').notNull(),
    chain: text('chain').$type<ChainId>().notNull(),
    token: text('token').$type<Address>().notNull(),
    recipient: text('recipient').$type<Address>().notNull(),
    amount: text('amount').$type<Amount>().notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.domain] })],
)

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
    /** The task budget this payment counts against, if any. */
    mandateId: text('mandate_id'),
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

/**
 * One row per payment cleared to be signed, for the breaker's rolling minute. Keyed by intent, so
 * a payment cleared twice (asked of the owner, then redeemed) counts once. In the database rather
 * than in memory, so a restart does not hand a runaway agent a fresh minute.
 */
export const clearedPayments = sqliteTable(
  'cleared_payments',
  {
    intentId: text('intent_id')
      .primaryKey()
      .references(() => intents.id),
    agentId: text('agent_id').notNull(),
    at: text('at').notNull(),
  },
  (t) => [index('cleared_payments_agent_at').on(t.agentId, t.at)],
)

/**
 * A budget for one task, inside the policy. A payment that names one must also fit it, and its
 * spend is counted here as well as in the day's total.
 */
export const mandates = sqliteTable(
  'mandates',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    budget: text('budget').$type<Amount>().notNull(),
    spent: text('spent')
      .$type<Amount>()
      .notNull()
      .default(sql`'0'`),
    domains: text('domains', { mode: 'json' }).$type<string[]>().notNull(),
    recipients: text('recipients', { mode: 'json' }).$type<Address[]>().notNull(),
    /** Agent-provided. Shown to the owner, never read back into a decision. */
    reason: text('reason').notNull(),
    status: text('status').$type<Mandate['status']>().notNull(),
    /** How long it runs once active. The clock starts when the owner approves, not when asked. */
    ttlSeconds: integer('ttl_seconds').notNull(),
    createdAt: text('created_at').notNull(),
    /** While pending, the owner's deadline; once active, the end of the task. */
    expiresAt: text('expires_at').notNull(),
  },
  (t) => [
    index('mandates_agent_status').on(t.agentId, t.status),
    index('mandates_expires_at').on(t.expiresAt),
  ],
)

/**
 * What cleared a payment, kept for its receipt: a hash of the policy in force, the simulation's
 * summary, and who approved it. Written at clearance, because by the time the payment executes the
 * policy may have changed.
 */
export const clearances = sqliteTable('clearances', {
  intentId: text('intent_id')
    .primaryKey()
    .references(() => intents.id),
  policyHash: text('policy_hash').notNull(),
  simulation: text('simulation').notNull(),
  approvedBy: text('approved_by').$type<Receipt['approvedBy']>().notNull(),
})

/** How the owner approved an intent: by a Telegram tap, or with a passkey. */
export const ownerApprovals = sqliteTable('owner_approvals', {
  intentId: text('intent_id')
    .primaryKey()
    .references(() => intents.id),
  method: text('method').$type<'owner' | 'passkey'>().notNull(),
})

/** One signed receipt per executed intent. */
export const receipts = sqliteTable(
  'receipts',
  {
    intentId: text('intent_id')
      .primaryKey()
      .references(() => intents.id),
    issuedAt: text('issued_at').notNull(),
    body: text('body', { mode: 'json' }).$type<Receipt>().notNull(),
  },
  (t) => [index('receipts_issued_at').on(t.issuedAt)],
)
