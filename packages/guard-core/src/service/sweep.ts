import { expireMandates } from '../db/mandates.js'
import { pruneExpired } from '../db/passkeys.js'
import * as repo from '../db/repo.js'
import { expirePending } from './approvals.js'
import { notify } from './events.js'
import type { PaymentDeps } from './payments.js'

/** Expires what the owner and the agents left waiting, and tells the bot about each one. */
export function sweep(deps: PaymentDeps): number {
  expireMandates(deps.db, deps.now())
  pruneExpired(deps.db, deps.now())
  const expired = expirePending(deps.db, deps.now())
  for (const id of expired) {
    const intent = repo.getIntent(deps.db, id)
    if (intent !== undefined) {
      notify(deps, intent)
    }
  }
  return expired.length
}
