import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
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

export { schema }
