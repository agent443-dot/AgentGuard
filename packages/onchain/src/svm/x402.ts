import type { RejectCode } from '@agentguard/shared'
import {
  address,
  createKeyPairSignerFromBytes,
  type KeyPairSigner,
  type TransactionPartialSigner,
} from '@solana/kit'
import { VersionedMessage, type Keypair } from '@solana/web3.js'
import type { SchemeNetworkClient } from '@x402/core/types'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { SigningRefused } from '../ChainAdapter.js'

/** Decides whether the hot wallet signs a message: the reasons not to, empty to sign. */
export type SigningGate = (message: VersionedMessage) => Promise<RejectCode[]>

/**
 * The x402 SDK builds the transaction; the gate decides whether the hot wallet signs it. Each payment
 * gets a scheme bound to one intent, so a transaction that differs from it in any way the gate can
 * see never gets a signature.
 */
export function gatedScheme(
  hotWallet: Keypair,
  gate: SigningGate,
  rpcUrl: string,
): SchemeNetworkClient {
  return new ExactSvmScheme(gatedSigner(hotWallet, gate), { rpcUrl })
}

export function gatedSigner(hotWallet: Keypair, gate: SigningGate): TransactionPartialSigner {
  // The SDK needs the address at once, the signing key only when it signs; kit derives the key
  // asynchronously, so it is made on first use.
  let signer: Promise<KeyPairSigner> | undefined
  return {
    address: address(hotWallet.publicKey.toBase58()),
    async signTransactions(transactions, config) {
      for (const transaction of transactions) {
        let message: VersionedMessage
        try {
          // web3.js v1 reads legacy and v0 only, so a v1 transaction is refused here.
          message = VersionedMessage.deserialize(Uint8Array.from(transaction.messageBytes))
        } catch {
          throw new SigningRefused(['SIM_FAILED'])
        }
        const reasons = await gate(message)
        if (reasons.length > 0) {
          throw new SigningRefused(reasons)
        }
      }
      signer ??= createKeyPairSignerFromBytes(hotWallet.secretKey)
      return (await signer).signTransactions(transactions, config)
    },
  }
}
