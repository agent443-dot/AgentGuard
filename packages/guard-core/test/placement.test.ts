import { CHAINS } from '@agentguard/shared'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { backupDb } from '../src/db/backup.js'
import { createAgent } from '../src/db/agents.js'
import { migrateDb, openDb } from '../src/db/client.js'
import { dbPlacementProblem, requirePersistentDb } from '../src/db/placement.js'
import { schema } from '../src/db/client.js'

const places = {
  repoRoot: '/srv/agentguard',
  tempDirs: ['/tmp'],
  cwd: '/srv/agentguard/packages/guard-core',
}

describe('dbPlacementProblem', () => {
  it.each([
    ['the default ./data path, inside the repo', './data/guard.db', /inside the repository/],
    ['an absolute path inside the repo', '/srv/agentguard/guard.db', /inside the repository/],
    ['a temp directory', '/tmp/guard.db', /temporary directory/],
    ['memory', ':memory:', /in memory/],
  ])('refuses %s', (_case, file, message) => {
    expect(dbPlacementProblem(file, places)).toMatch(message)
  })

  it.each(['/var/lib/agentguard/guard.db', '/srv/agentguard-data/guard.db'])(
    'accepts a persistent volume such as %s',
    (file) => {
      expect(dbPlacementProblem(file, places)).toBeUndefined()
    },
  )
})

describe('requirePersistentDb', () => {
  const env = {
    ADMIN_TOKEN: 'a'.repeat(64),
    BOT_TOKEN: 'b'.repeat(64),
    BOT_URL: 'http://bot.local',
    BOT_WEBHOOK_SECRET: 'c'.repeat(64),
    DATABASE_URL: 'file:./data/guard.db',
  }

  it('lets devnet run from the repo', () => {
    expect(() => requirePersistentDb(loadConfig(env), places)).not.toThrow()
  })

  it.each([
    ['Solana mainnet', { SOLANA_CHAIN: CHAINS.solanaMainnet }],
    ['Base mainnet', { BASE_CHAIN: CHAINS.base }],
  ])('refuses to start on %s with the database in the repo', (_case, chain) => {
    expect(() => requirePersistentDb(loadConfig({ ...env, ...chain }), places)).toThrow(
      /^invalid configuration: DATABASE_URL is inside the repository/,
    )
  })

  it('starts on mainnet with the database on a volume', () => {
    const config = loadConfig({
      ...env,
      SOLANA_CHAIN: CHAINS.solanaMainnet,
      DATABASE_URL: 'file:/var/lib/agentguard/guard.db',
    })
    expect(() => requirePersistentDb(config, places)).not.toThrow()
  })
})

describe('backupDb', () => {
  it('writes a consistent copy that opens with the same rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-backup-'))
    const db = openDb(`file:${join(dir, 'guard.db')}`)
    migrateDb(db)
    createAgent(db, 'agent-1')
    const copy = join(dir, 'backups', 'guard.db')

    await backupDb(db, copy)

    expect(existsSync(copy)).toBe(true)
    const restored = openDb(`file:${copy}`)
    expect(
      restored
        .select()
        .from(schema.agents)
        .all()
        .map((row) => row.id),
    ).toEqual(['agent-1'])
  })

  it('never overwrites an existing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'guard-backup-'))
    const db = openDb(`file:${join(dir, 'guard.db')}`)
    migrateDb(db)
    const copy = join(dir, 'copy.db')
    await backupDb(db, copy)
    await expect(backupDb(db, copy)).rejects.toThrow(/refusing to overwrite/)
  })
})
