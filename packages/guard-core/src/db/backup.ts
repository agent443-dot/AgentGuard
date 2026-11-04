import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Db } from './client.js'

/**
 * Copies the live database with SQLite's online backup API, which takes a consistent snapshot
 * while the guard keeps writing. Copying the file by hand can catch it mid-write, and in WAL mode
 * misses whatever has not been checkpointed yet. Never overwrites an existing file.
 */
export async function backupDb(db: Db, destination: string): Promise<void> {
  if (existsSync(destination)) {
    throw new Error(`refusing to overwrite ${destination}`)
  }
  mkdirSync(dirname(destination), { recursive: true })
  await db.$client.backup(destination)
}
