import { buildChains } from './chains.js'
import { loadConfig } from './config.js'
import { migrateDb, openDb } from './db/client.js'
import { buildServer } from './http/server.js'

const config = loadConfig()

const db = openDb(config.DATABASE_URL)
migrateDb(db)

const chains = await buildChains(config)

const app = await buildServer({ db, config, chains, sweepMs: config.EXPIRY_SWEEP_MS })

if (config.GUARD_STUB_CHAINS === 'true') {
  app.log.warn('stub chains: nothing is signed and no money moves')
} else if (chains.size === 0) {
  // With no adapter the policy has no chain to clear a payment on, so every payment is refused:
  // default deny, not a degraded mode.
  app.log.warn('no chain adapter configured: every payment will be refused')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close()
  })
}

await app.listen({ port: config.PORT, host: config.HOST })
