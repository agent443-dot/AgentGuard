import { readReceiptKeyFile } from './adapters/keypair.js'
import { buildChains } from './chains.js'
import { loadConfig } from './config.js'
import { migrateDb, openDb } from './db/client.js'
import { requirePersistentDb } from './db/placement.js'
import { buildServers } from './http/server.js'

const config = loadConfig()

requirePersistentDb(config)

const db = openDb(config.DATABASE_URL)
migrateDb(db)

const chains = await buildChains(config)
const receiptKey =
  config.RECEIPT_SIGNING_KEY_FILE === undefined
    ? undefined
    : await readReceiptKeyFile(config.RECEIPT_SIGNING_KEY_FILE)

const split = config.PUBLIC_PORT !== undefined
const [app, publicApp] = await buildServers(
  {
    db,
    config,
    chains,
    sweepMs: config.EXPIRY_SWEEP_MS,
    ...(receiptKey === undefined ? {} : { receiptKey }),
  },
  split ? (['private', 'public'] as const) : (['all'] as const),
)

if (config.GUARD_STUB_CHAINS === 'true') {
  app.log.warn('stub chains: nothing is signed and no money moves')
} else if (chains.size === 0) {
  // With no adapter the policy has no chain to clear a payment on, so every payment is refused:
  // default deny, not a degraded mode.
  app.log.warn('no chain adapter configured: every payment will be refused')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void Promise.all([app.close(), publicApp?.close()])
  })
}

await app.listen({ port: config.PORT, host: config.HOST })
if (publicApp !== undefined) {
  await publicApp.listen({ port: config.PUBLIC_PORT, host: config.PUBLIC_HOST })
}
