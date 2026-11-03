import { createSvmAdapter, type ChainAdapter } from '@agentguard/onchain'
import type { ChainId } from '@agentguard/shared'
import { requireAddress } from '@agentguard/shared'
import { readKeypairFile } from './adapters/keypair.js'
import { StubChain } from './adapters/stub.js'
import { loadConfig } from './config.js'
import { migrateDb, openDb } from './db/client.js'
import { buildServer } from './http/server.js'

const config = loadConfig()

const db = openDb(config.DATABASE_URL)
migrateDb(db)

const chains = new Map<ChainId, ChainAdapter>()
const chain = config.SOLANA_CHAIN
if (config.GUARD_STUB_CHAINS === 'true') {
  chains.set(chain, new StubChain(chain, 100_000_000n))
} else if (config.SOLANA_HOT_WALLET_KEYPAIR !== undefined) {
  if (config.SOLANA_RPC_URL === undefined || config.SQUADS_MULTISIG === undefined) {
    throw new Error('invalid configuration: SOLANA_RPC_URL, SQUADS_MULTISIG')
  }
  chains.set(
    chain,
    createSvmAdapter({
      chain,
      rpcUrl: config.SOLANA_RPC_URL,
      hotWalletSecretKey: await readKeypairFile(config.SOLANA_HOT_WALLET_KEYPAIR),
      multisig: config.SQUADS_MULTISIG,
      mint: requireAddress(chain, 'usdc'),
    }),
  )
}

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
