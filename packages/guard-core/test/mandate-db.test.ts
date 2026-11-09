import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { addMandateSpend, getMandate, insertMandate, revokeMandate } from '../src/db/mandates.js'
import { getPin } from '../src/db/pins.js'
import { openDb, schema, type Db } from '../src/db/client.js'
import { CHAIN, MERCHANT, MINT, NOW } from './harness.js'

const ID = '11111111-1111-4111-8111-111111111111'

function db(): Db {
  const d = openDb(':memory:')
  migrate(d, { migrationsFolder: 'migrations' })
  d.insert(schema.agents)
    .values({ id: 'agent-1', name: 'agent-1', tokenHash: 'h', createdAt: NOW.toISOString() })
    .run()
  return d
}

describe('a mandate revoked while a payment is in flight', () => {
  it('stays revoked when that payment then uses up the budget', () => {
    const d = db()
    insertMandate(
      d,
      {
        id: ID,
        agentId: 'agent-1',
        budget: '1000000',
        spent: '0',
        domains: [],
        recipients: [MERCHANT],
        reason: 'task',
        status: 'active',
        createdAt: NOW.toISOString(),
        expiresAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
      },
      3600,
    )
    expect(revokeMandate(d, ID).ok).toBe(true)
    addMandateSpend(d, ID, '1000000')
    expect(getMandate(d, ID)).toMatchObject({ status: 'revoked', spent: '1000000' })
  })
})

describe('the pin backfill on upgrade', () => {
  it("pins each agent's domains from its latest executed x402 payment", () => {
    const d = db()
    const intent = (n: number, at: string, recipient: string, status = 'executed') => ({
      id: `00000000-0000-4000-8000-00000000000${n}`,
      agentId: 'agent-1',
      kind: 'x402' as const,
      chain: CHAIN,
      token: MINT,
      amount: `${n}00000`,
      recipient,
      domain: 'api.example.com',
      reason: 'GET',
      status: status as 'executed',
      rejectReasons: [],
      createdAt: at,
      expiresAt: at,
    })
    d.insert(schema.intents)
      .values([
        intent(1, '2026-11-01T00:00:00.000Z', 'OldPayee'),
        intent(2, '2026-11-02T00:00:00.000Z', MERCHANT),
        intent(3, '2026-11-03T00:00:00.000Z', 'RejectedPayee', 'rejected'),
      ])
      .run()
    // The migration already ran on the empty database; running its statement again is what an
    // upgrade of a database with history does, and it must be safe to repeat.
    d.$client.exec(readFileSync('migrations/0004_backfill_x402_pins.sql', 'utf8'))
    d.$client.exec(readFileSync('migrations/0004_backfill_x402_pins.sql', 'utf8'))
    expect(getPin(d, 'agent-1', 'api.example.com')).toEqual({
      chain: CHAIN,
      token: MINT,
      recipient: MERCHANT,
      amount: '200000',
    })
  })
})
