import { createRequire } from 'node:module'
import type SafeModule from '@safe-global/protocol-kit'
import type { EthSafeSignature } from '@safe-global/protocol-kit'
import type { Hex } from 'viem'
import type { EvmConfig } from './config.js'
import { keyOwner, loadLedgerOwner, safeTxHashes, type SafeOwner } from './owner.js'

// The package's types describe its CommonJS build, so that is the build loaded: under an ESM import
// the class sits one level up from where the types put it.
const require = createRequire(import.meta.url)
const kit = require('@safe-global/protocol-kit') as typeof SafeModule & {
  EthSafeSignature: typeof EthSafeSignature
}
export const { default: Safe } = kit

type SafeKit = Awaited<ReturnType<typeof Safe.init>>
type SafeTx = Awaited<ReturnType<SafeKit['createTransaction']>>

/**
 * Who signs as the owner, and who pays the gas. With a key they are the same account. With a
 * Ledger, the executor is a separate key holding only gas: it can submit a transaction the owner
 * signed, and nothing else, since the Safe checks the owner's signature.
 */
export async function safeSigners(
  config: EvmConfig,
  tell: (line: string) => void,
): Promise<{ owner: SafeOwner; executorKey: Hex }> {
  if (config.OWNER_SIGNER === 'ledger') {
    return {
      owner: await loadLedgerOwner(config.OWNER_LEDGER_PATH, tell),
      executorKey: config.EXECUTOR_PRIVATE_KEY as Hex,
    }
  }
  const key = config.OWNER_PRIVATE_KEY as Hex
  return { owner: keyOwner(key), executorKey: key }
}

/** The owner signs the exact transaction protocol-kit will submit, then the executor submits it. */
export async function signAndExecute(safe: SafeKit, owner: SafeOwner, tx: SafeTx): Promise<Hex> {
  const [address, chainId, kitHash] = await Promise.all([
    safe.getAddress(),
    safe.getChainId(),
    safe.getTransactionHash(tx),
  ])
  // Refuse rather than sign if the hash shown to the owner is not the one the Safe will check.
  const { safeTxHash } = safeTxHashes(Number(chainId), address as Hex, tx.data)
  if (safeTxHash.toLowerCase() !== kitHash.toLowerCase()) {
    throw new Error(`safe_tx_hash_mismatch: ${safeTxHash} vs ${kitHash}`)
  }
  const signature = await owner.sign(Number(chainId), address as Hex, tx.data)
  tx.addSignature(new kit.EthSafeSignature(owner.address, signature))
  const result = await safe.executeTransaction(tx)
  return result.hash as Hex
}
