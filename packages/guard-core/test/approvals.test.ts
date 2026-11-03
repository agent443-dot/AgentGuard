import type { ApprovalRequest, PayIntent, SimulationResult } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { httpBotNotifier, type BotNotifier } from '../src/adapters/bot.js'
import { loadConfig } from '../src/config.js'
import { openDb, schema, type Db } from '../src/db/client.js'
import { webhookSignatureValid } from '../src/domain/auth.js'
import { decide, expirePending, expiresAt, requestApproval } from '../src/service/approvals.js'

const SECRET = 'd'.repeat(64)
const CREATED = new Date('2026-11-03T12:00:00Z')
const INTENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

const config = loadConfig({
  ADMIN_TOKEN: 'a'.repeat(64),
  BOT_TOKEN: 'b'.repeat(64),
  BOT_URL: 'http://bot.local',
  BOT_WEBHOOK_SECRET: SECRET,
})

const simulation: SimulationResult = { summary: 'sends 1 USDC', balanceChanges: [] }

function intent(overrides: Partial<PayIntent> = {}): PayIntent {
  return {
    id: INTENT_ID,
    agentId: 'agent-1',
    kind: 'transfer',
    chain: CHAINS.solanaDevnet,
    token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    amount: '3000000',
    recipient: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    reason: 'over the threshold',
    status: 'pending_approval',
    rejectReasons: [],
    createdAt: CREATED.toISOString(),
    expiresAt: expiresAt(CREATED),
    ...overrides,
  }
}

let db: Db
const notifier: BotNotifier = { requestApproval: vi.fn(async () => {}) }

beforeEach(() => {
  db = openDb(':memory:')
  migrate(db, { migrationsFolder: 'migrations' })
  db.insert(schema.agents)
    .values({ id: 'agent-1', name: 'a', tokenHash: 'h', createdAt: CREATED.toISOString() })
    .run()
  vi.clearAllMocks()
})

describe('requestApproval', () => {
  it('persists the intent before asking, so a silent bot still leaves something to expire', async () => {
    await requestApproval(db, notifier, intent(), simulation)
    const [row] = db.select().from(schema.intents).all()
    expect(row?.status).toBe('pending_approval')
    expect(notifier.requestApproval).toHaveBeenCalledOnce()
  })

  it('gives the owner ten minutes', () => {
    expect(expiresAt(CREATED)).toBe('2026-11-03T12:10:00.000Z')
  })
})

describe('decide', () => {
  beforeEach(async () => {
    await requestApproval(db, notifier, intent(), simulation)
  })

  it('approves while the window is open', () => {
    const result = decide(db, INTENT_ID, 'approve', new Date('2026-11-03T12:05:00Z'))
    expect(result).toMatchObject({ ok: true, intent: { status: 'approved', rejectReasons: [] } })
  })

  it('records why a rejection happened', () => {
    const result = decide(db, INTENT_ID, 'reject', new Date('2026-11-03T12:05:00Z'))
    expect(result).toMatchObject({
      ok: true,
      intent: { status: 'rejected', rejectReasons: ['OWNER_REJECTED'] },
    })
  })

  it('treats a late approval as an expiry, not as consent', () => {
    const result = decide(db, INTENT_ID, 'approve', new Date('2026-11-03T12:10:01Z'))
    expect(result).toEqual({ ok: false, reason: 'expired' })

    const [row] = db.select().from(schema.intents).all()
    expect(row?.status).toBe('expired')
    expect(row?.rejectReasons).toEqual(['APPROVAL_TIMEOUT'])
  })

  it('refuses a second decision', () => {
    decide(db, INTENT_ID, 'approve', new Date('2026-11-03T12:05:00Z'))
    const again = decide(db, INTENT_ID, 'reject', new Date('2026-11-03T12:06:00Z'))
    expect(again).toEqual({ ok: false, reason: 'already_decided' })
  })

  it('reports an unknown intent as missing', () => {
    const result = decide(db, '00000000-0000-4000-8000-000000000000', 'approve', CREATED)
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('expirePending', () => {
  it('closes only what is pending and past its window', async () => {
    await requestApproval(db, notifier, intent(), simulation)
    db.insert(schema.intents)
      .values({
        ...intent({ id: '11111111-1111-4111-8111-111111111111', status: 'executed' }),
        expiresAt: '2026-11-03T00:00:00Z',
      })
      .run()

    expect(expirePending(db, new Date('2026-11-03T12:09:00Z'))).toBe(0)
    expect(expirePending(db, new Date('2026-11-03T12:11:00Z'))).toBe(1)

    const statuses = db
      .select()
      .from(schema.intents)
      .all()
      .map((r) => r.status)
    expect(statuses.sort()).toEqual(['executed', 'expired'])
  })
})

describe('httpBotNotifier', () => {
  it('signs the exact bytes it sends', async () => {
    let seen: { body: string; signature: string } | undefined
    const fakeFetch = (async (_url, init) => {
      const headers = init?.headers as Record<string, string>
      seen = { body: init?.body as string, signature: headers['x-guard-signature'] ?? '' }
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    const request: ApprovalRequest = {
      intent: intent(),
      simulation,
      approveBefore: expiresAt(CREATED),
    }
    await httpBotNotifier(config, fakeFetch).requestApproval(request)

    expect(seen).toBeDefined()
    expect(webhookSignatureValid(seen!.body, SECRET, seen!.signature)).toBe(true)
    expect(webhookSignatureValid(seen!.body + ' ', SECRET, seen!.signature)).toBe(false)
  })

  it('fails loudly when the bot refuses the webhook', async () => {
    const failing = (async () => new Response('nope', { status: 401 })) as typeof fetch
    await expect(
      httpBotNotifier(config, failing).requestApproval({
        intent: intent(),
        simulation,
        approveBefore: expiresAt(CREATED),
      }),
    ).rejects.toThrow(/bot_webhook_failed: 401/)
  })
})
