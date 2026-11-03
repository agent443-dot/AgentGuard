import type { ChainAdapter } from '@agentguard/onchain'
import type { ChainId } from '@agentguard/shared'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { fileURLToPath } from 'node:url'
import { StubChain, stubScheme } from './adapters/stub.js'
import { loadKeypairSigner, svmPaymentScheme } from './adapters/svm-x402.js'
import type { PaymentScheme } from './adapters/x402.js'
import { loadConfig } from './config.js'
import { openDb } from './db/client.js'
import { buildServer } from './http/server.js'
import { expirePending } from './service/approvals.js'

const config = loadConfig()

const db = openDb(config.DATABASE_URL)
migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })

const chains = new Map<ChainId, ChainAdapter>()
const schemes = new Map<ChainId, PaymentScheme>()
const chain = config.SOLANA_CHAIN
if (config.GUARD_STUB_CHAINS === 'true') {
  chains.set(chain, new StubChain(chain, 100_000_000n))
  schemes.set(chain, stubScheme(chain))
} else if (config.SOLANA_HOT_WALLET_KEYPAIR !== undefined) {
  const wallet = await loadKeypairSigner(config.SOLANA_HOT_WALLET_KEYPAIR)
  schemes.set(chain, svmPaymentScheme(chain, wallet, config.SOLANA_RPC_URL))
}

const app = await buildServer({ db, config, chains, schemes })

if (config.GUARD_STUB_CHAINS === 'true') {
  app.log.warn('stub chains: nothing is signed and no money moves')
} else if (chains.size === 0) {
  // The Solana ChainAdapter is task SVM-3. Until it is wired, the policy has no chain to clear a
  // payment on, so every payment is refused: default deny, not a degraded mode.
  app.log.warn('no chain adapter configured: every payment will be refused')
}

const sweep = setInterval(() => {
  const expired = expirePending(db, new Date())
  if (expired > 0) {
    app.log.info({ expired }, 'expired pending intents')
  }
}, config.EXPIRY_SWEEP_MS)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(sweep)
    void app.close()
  })
}

await app.listen({ port: config.PORT, host: '127.0.0.1' })
