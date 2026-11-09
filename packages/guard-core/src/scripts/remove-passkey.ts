import { loadConfig } from '../config.js'
import { migrateDb, openDb } from '../db/client.js'
import { deletePasskey, listPasskeys } from '../db/passkeys.js'
import * as repo from '../db/repo.js'

// Usage: pnpm remove-passkey <id or prefix>. With no argument it lists the enrolled passkeys.
// Kept off the HTTP API on purpose: removing the owner's passkey takes a shell on this machine.
const wanted = process.argv[2]
const db = openDb(loadConfig().DATABASE_URL)
migrateDb(db)
const enrolled = listPasskeys(db)

if (wanted === undefined) {
  for (const { id, createdAt, lastUsedAt } of enrolled) {
    console.log(`${id}  created ${createdAt}  last used ${lastUsedAt ?? 'never'}`)
  }
  process.exit(0)
}

const matches = enrolled.filter(({ id }) => id.startsWith(wanted))
const [match] = matches
if (match === undefined || matches.length > 1) {
  console.error(
    matches.length === 0
      ? `no passkey starts with ${wanted}; nothing changed`
      : `${matches.length} passkeys start with ${wanted}; give more of the id`,
  )
  process.exit(1)
}
const { id } = match
deletePasskey(db, id)
repo.audit(db, { event: 'passkey_removed', detail: { id: id.slice(0, 8) } }, new Date())
console.log(`passkey ${id} removed`)
