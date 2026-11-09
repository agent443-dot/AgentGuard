import bs58 from 'bs58'
import {
  PublicKey,
  VersionedTransaction,
  type AccountInfo,
  type Connection,
  type SimulateTransactionConfig,
  type Transaction,
} from '@solana/web3.js'
import { FailedTransactionMetadata, web3Account, type Svm } from './svm.js'

/**
 * The handful of Connection methods the adapter and the Squads SDK call, answered by an in-process
 * LiteSVM instead of a cluster. The programs run for real; only the RPC transport is faked.
 */
export function liteConnection(svm: Svm, rpcEndpoint = 'http://127.0.0.1:0'): Connection {
  const statuses = new Map<string, { err: unknown }>()

  const account = (address: PublicKey): AccountInfo<Buffer> | null => svm.getAccount(address)

  function submit(tx: Transaction | VersionedTransaction): string {
    const result = svm.sendTransaction(tx)
    const failed = result instanceof FailedTransactionMetadata
    const signature = bs58.encode((failed ? result.meta() : result).signature())
    const err = failed ? result.err() : null
    // A cluster moves on to a new blockhash; without this two identical draws would share a
    // signature and the second would be refused as already processed.
    svm.expireBlockhash()
    statuses.set(signature, { err })
    if (err !== null) {
      // A cluster's preflight refuses the same way, with the logs naming the rule.
      throw new Error(`simulation failed: ${result.toString()}`)
    }
    return signature
  }

  const fake = {
    rpcEndpoint,
    getLatestBlockhash: async () => ({
      blockhash: svm.latestBlockhash(),
      lastValidBlockHeight: 0,
    }),
    getAccountInfo: async (address: PublicKey) => account(address),
    getMultipleAccountsInfo: async (addresses: PublicKey[]) => addresses.map(account),
    getBalance: async (address: PublicKey) => Number(svm.getBalance(address) ?? 0n),
    getMinimumBalanceForRentExemption: async (size: number) =>
      Number(svm.minimumBalanceForRentExemption(BigInt(size))),
    sendTransaction: async (tx: Transaction | VersionedTransaction) => submit(tx),
    sendRawTransaction: async (raw: Uint8Array) => submit(VersionedTransaction.deserialize(raw)),
    getSignatureStatuses: async (signatures: string[]) => ({
      value: signatures.map((signature) => {
        const status = statuses.get(signature)
        return status ? { ...status, confirmationStatus: 'confirmed' } : null
      }),
    }),
    simulateTransaction: async (tx: VersionedTransaction, config?: SimulateTransactionConfig) => {
      // The adapter simulates before signing, as the RPC allows with sigVerify off.
      svm.withSigverify(config?.sigVerify ?? true)
      const result = svm.simulateTransaction(tx)
      svm.withSigverify(true)
      if (result instanceof FailedTransactionMetadata) {
        return { value: { err: result.err(), logs: result.meta().logs(), accounts: null } }
      }
      const post = new Map(result.postAccounts().map((acc) => [acc.address.toString(), acc]))
      const accounts = (config?.accounts?.addresses ?? []).map((address) => {
        const touched = post.get(address)
        const state = touched ? web3Account(touched) : account(new PublicKey(address))
        if (!state || state.lamports === 0) {
          return null
        }
        return {
          lamports: state.lamports,
          owner: state.owner.toBase58(),
          executable: state.executable,
          data: [Buffer.from(state.data).toString('base64'), 'base64'],
        }
      })
      return { value: { err: null, logs: result.meta().logs(), accounts } }
    },
  }
  return fake as unknown as Connection
}
