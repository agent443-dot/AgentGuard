import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema.js'

export type Db = ReturnType<typeof openDb>

/**
 * `url` follows the DATABASE_URL form "file:./data/guard.db"; ":memory:" is accepted for tests.
 * WAL keeps the expiry sweep from blocking writes on the request path.
 */
export function openDb(url: string) {
  const file = url.startsWith('file:') ? url.slice('file:'.length) : url
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true })
  }
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

/** Applies this package's migrations, wherever the caller runs from. */
export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
}

export { schema }
