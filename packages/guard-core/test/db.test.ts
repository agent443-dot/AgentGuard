import { CHAINS } from '@agentguard/shared'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDb, schema, type Db } from '../src/db/client.js'

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  migrate(db, { migrationsFolder: 'migrations' })
  db.insert(schema.agents)
    .values({
      id: 'agent-1',
      name: 'demo',
      tokenHash: 'hash-1',
      createdAt: '2026-11-03T00:00:00Z',
    })
    .run()
})

describe('schema', () => {
  it('round-trips a policy with its json columns intact', () => {
    db.insert(schema.policies)
      .values({
        agentId: 'agent-1',
        chains: [CHAINS.solanaDevnet],
        tokens: ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'],
        perTxMax: '5000000',
        dailyMax: '100000000',
        approvalThreshold: '2000000',
        allowedRecipients: [],
        allowedDomains: ['api.example.com'],
        paused: false,
        updatedAt: '2026-11-03T00:00:00Z',
      })
      .run()

    const [row] = db
      .select()
      .from(schema.policies)
      .where(eq(schema.policies.agentId, 'agent-1'))
      .all()
    expect(row?.chains).toEqual([CHAINS.solanaDevnet])
    expect(row?.allowedDomains).toEqual(['api.example.com'])
    expect(row?.allowedRecipients).toEqual([])
    expect(row?.paused).toBe(false)
  })

  it('keeps an amount exactly as written, past what a double can hold', () => {
    db.insert(schema.intents)
      .values({
        id: 'intent-1',
        agentId: 'agent-1',
        kind: 'x402',
        chain: CHAINS.solanaDevnet,
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: '9007199254740993',
        recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
        domain: 'api.example.com',
        reason: 'agent said so',
        status: 'pending_approval',
        rejectReasons: [],
        createdAt: '2026-11-03T00:00:00Z',
        expiresAt: '2026-11-03T00:10:00Z',
      })
      .run()

    const [row] = db.select().from(schema.intents).all()
    expect(row?.amount).toBe('9007199254740993')
    expect(BigInt(row?.amount ?? '0')).toBe(9_007_199_254_740_993n)
  })

  it('stores reject reasons as a list', () => {
    db.insert(schema.auditLog)
      .values({
        at: '2026-11-03T00:00:01Z',
        agentId: 'agent-1',
        event: 'policy_evaluated',
        decision: 'reject',
        reasons: ['DOMAIN_NOT_ALLOWED', 'PER_TX_EXCEEDED'],
      })
      .run()

    const [row] = db.select().from(schema.auditLog).all()
    expect(row?.reasons).toEqual(['DOMAIN_NOT_ALLOWED', 'PER_TX_EXCEEDED'])
  })

  it('tracks daily spend per chain for the same agent and day', () => {
    db.insert(schema.dailySpend)
      .values([
        { agentId: 'agent-1', chain: CHAINS.solanaDevnet, day: '2026-11-03', spent: '1000000' },
        { agentId: 'agent-1', chain: CHAINS.baseSepolia, day: '2026-11-03', spent: '2000000' },
      ])
      .run()

    const rows = db.select().from(schema.dailySpend).all()
    expect(rows).toHaveLength(2)
    expect(rows.reduce((sum, r) => sum + BigInt(r.spent), 0n)).toBe(3_000_000n)
  })

  it('refuses a second agent with the same token hash', () => {
    expect(() =>
      db
        .insert(schema.agents)
        .values({
          id: 'agent-2',
          name: 'clone',
          tokenHash: 'hash-1',
          createdAt: '2026-11-03T00:00:00Z',
        })
        .run(),
    ).toThrow(/UNIQUE/)
  })

  it('refuses an intent for an agent that does not exist', () => {
    expect(() =>
      db
        .insert(schema.intents)
        .values({
          id: 'intent-2',
          agentId: 'ghost',
          kind: 'transfer',
          chain: CHAINS.solanaDevnet,
          token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          amount: '1',
          recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
          reason: '',
          status: 'approved',
          rejectReasons: [],
          createdAt: '2026-11-03T00:00:00Z',
          expiresAt: '2026-11-03T00:10:00Z',
        })
        .run(),
    ).toThrow(/FOREIGN KEY/)
  })
})
