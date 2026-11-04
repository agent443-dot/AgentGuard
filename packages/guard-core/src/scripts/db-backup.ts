import { dirname, join } from 'node:path'
import { loadConfig } from '../config.js'
import { backupDb } from '../db/backup.js'
import { dbFile, openDb } from '../db/client.js'

// Usage: pnpm db:backup [destination]. Safe while guard-core is running. With no destination it
// writes backups/guard-<time>.db next to the database.
const file = dbFile(loadConfig().DATABASE_URL)
if (file === ':memory:') {
  console.error('DATABASE_URL is in memory; there is nothing to back up')
  process.exit(1)
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const destination = process.argv[2] ?? join(dirname(file), 'backups', `guard-${stamp}.db`)

try {
  await backupDb(openDb(`file:${file}`), destination)
  console.log(`backed up to ${destination}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
