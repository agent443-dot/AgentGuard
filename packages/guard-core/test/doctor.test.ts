import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { StubChain } from '../src/adapters/stub.js'
import { openDb, schema } from '../src/db/client.js'
import { doctor, type DoctorDeps } from '../src/service/doctor.js'
import { basePolicy, CHAIN, MINT, NOW } from './harness.js'

function deps(overrides: Partial<DoctorDeps> = {}): DoctorDeps & { chain: StubChain } {
  const db = openDb(':memory:')
  migrate(db, { migrationsFolder: 'migrations' })
  const chain = new StubChain(CHAIN, 1_000_000n)
  return {
    db,
    chain,
    chains: new Map([[CHAIN, chain]]),
    usdc: new Map([[CHAIN, MINT]]),
    fetch: vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })),
    now: () => NOW,
    botUrl: 'http://bot.internal:8788',
    databaseUrl: ':memory:',
    ...overrides,
  }
}

const byId = async (d: DoctorDeps) => Object.fromEntries((await doctor(d)).map((c) => [c.id, c]))

describe('the doctor', () => {
  it('reports a healthy setup, and writes nothing to the database it checks', async () => {
    const d = deps()
    const checks = await byId(d)
    expect(checks['database']?.status).toBe('ok')
    expect(checks[`${CHAIN}:allowance`]?.status).toBe('ok')
    expect(checks[`${CHAIN}:gas`]?.status).toBe('ok')
    expect(checks[`${CHAIN}:balance`]?.message).toContain('1000000')
    expect(checks['bot']?.status).toBe('ok')
    expect(d.db.select().from(schema.auditLog).all()).toEqual([])
  })

  it('warns when a chain has no onchain limit, as after a kill', async () => {
    const d = deps()
    vi.spyOn(d.chain, 'getAllowanceState').mockResolvedValue({ status: 'none', delegate: 'hot' })
    expect((await byId(d))[`${CHAIN}:allowance`]).toMatchObject({
      status: 'warn',
      fix: expect.any(String),
    })
  })

  it('warns when the hot wallet is below its gas minimum', async () => {
    const d = deps()
    vi.spyOn(d.chain, 'getHotWalletGas').mockResolvedValue({
      balance: '1',
      minimum: '2',
      symbol: 'SOL',
    })
    expect((await byId(d))[`${CHAIN}:gas`]).toMatchObject({ status: 'warn' })
  })

  it('fails a read that throws without quoting the error, which may carry a URL or a key', async () => {
    const d = deps()
    vi.spyOn(d.chain, 'getAllowanceState').mockRejectedValue(
      new Error('fetch failed: https://rpc.example/v2/SECRET-KEY'),
    )
    const check = (await byId(d))[`${CHAIN}:allowance`]
    expect(check?.status).toBe('fail')
    expect(JSON.stringify(check)).not.toMatch(/SECRET|https?:/)
  })

  it('gives up on a chain read after five seconds', async () => {
    vi.useFakeTimers()
    try {
      const d = deps()
      vi.spyOn(d.chain, 'getAllowanceState').mockReturnValue(new Promise(() => {}))
      const pending = byId(d)
      await vi.advanceTimersByTimeAsync(5_000)
      expect((await pending)[`${CHAIN}:allowance`]?.status).toBe('fail')
    } finally {
      vi.useRealTimers()
    }
  })

  it('warns about an agent whose approval threshold is above PASSKEY_ABOVE', async () => {
    const d = deps()
    for (const [id, approvalThreshold] of [
      ['loose', '5000000'],
      ['tight', '1000000'],
    ] as const) {
      d.db
        .insert(schema.agents)
        .values({ id, name: id, tokenHash: id, createdAt: NOW.toISOString() })
        .run()
      d.db
        .insert(schema.policies)
        .values({ agentId: id, ...basePolicy, approvalThreshold, updatedAt: NOW.toISOString() })
        .run()
    }
    const checks = await byId({ ...d, passkeyAbove: '3000000' })
    expect(checks['loose:passkey']).toMatchObject({ status: 'warn', fix: expect.any(String) })
    expect(checks['tight:passkey']).toBeUndefined()
    expect((await byId(d))['loose:passkey']).toBeUndefined()
  })

  it.each([
    ['answers with an error', async () => new Response('no', { status: 500 })],
    ['is down', async () => Promise.reject(new TypeError('fetch failed'))],
  ])('fails when the bot %s, naming no URL', async (_case, answer) => {
    const check = (await byId(deps({ fetch: vi.fn(answer) as typeof fetch })))['bot']
    expect(check?.status).toBe('fail')
    expect(JSON.stringify(check)).not.toContain('bot.internal')
  })

  describe('backups', () => {
    function withBackup(ageMs?: number) {
      const dir = mkdtempSync(join(tmpdir(), 'guard-doctor-'))
      if (ageMs !== undefined) {
        mkdirSync(join(dir, 'backups'))
        const file = join(dir, 'backups', 'guard-1.db')
        writeFileSync(file, '')
        const at = new Date(NOW.getTime() - ageMs)
        utimesSync(file, at, at)
      }
      return deps({ databaseUrl: `file:${join(dir, 'guard.db')}` })
    }

    it('is happy with a backup from the last two days', async () => {
      expect((await byId(withBackup(3_600_000)))['backup']?.status).toBe('ok')
    })

    it('warns when the newest backup is older than two days', async () => {
      expect((await byId(withBackup(3 * 86_400_000)))['backup']?.status).toBe('warn')
    })

    it('warns when there is no backup at all', async () => {
      expect((await byId(withBackup()))['backup']).toMatchObject({
        status: 'warn',
        fix: expect.any(String),
      })
    })
  })
})
