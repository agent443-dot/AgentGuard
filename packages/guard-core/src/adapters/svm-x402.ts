import { inspectTransfer, type ExpectedTransfer } from '@agentguard/onchain'
import type { ChainId, PayIntent } from '@agentguard/shared'
import { USDC_DECIMALS } from '@agentguard/shared'
import { createKeyPairSignerFromBytes, type TransactionPartialSigner } from '@solana/kit'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey, VersionedMessage } from '@solana/web3.js'
import type { PaymentRequirements } from '@x402/core/types'
import { ExactSvmScheme } from '@x402/svm/exact/client'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { SigningRefused, type PaymentScheme } from './x402.js'

/**
 * The SDK builds the transaction; this decides whether the hot wallet signs it. Each payment gets a
 * signer bound to that one intent, so a transaction that differs from it in any way the inspection
 * can see never gets a signature.
 */
export function svmPaymentScheme(
  chain: ChainId,
  wallet: TransactionPartialSigner,
  rpcUrl?: string,
): PaymentScheme {
  return {
    chain,
    forIntent(intent, requirements) {
      const signer = gatedSigner(wallet, expectedTransfer(intent, requirements, wallet.address))
      return new ExactSvmScheme(signer, rpcUrl === undefined ? undefined : { rpcUrl })
    },
  }
}

export function gatedSigner(
  wallet: TransactionPartialSigner,
  expected: ExpectedTransfer,
): TransactionPartialSigner {
  return {
    address: wallet.address,
    async signTransactions(transactions, config) {
      for (const transaction of transactions) {
        const reasons = inspectTransfer(
          VersionedMessage.deserialize(Uint8Array.from(transaction.messageBytes)),
          expected,
        )
        if (reasons.length > 0) {
          throw new SigningRefused(reasons)
        }
      }
      return wallet.signTransactions(transactions, config)
    },
  }
}

/**
 * Everything here comes from the intent the policy approved, except the fee payer: in the exact
 * scheme the facilitator pays the fee and names its key in the 402. USDC lives in the classic token
 * program; a mint under any other program yields different token accounts and fails inspection.
 */
export function expectedTransfer(
  intent: PayIntent,
  requirements: PaymentRequirements,
  walletAddress: string,
): ExpectedTransfer {
  const feePayer = requirements.extra['feePayer']
  if (typeof feePayer !== 'string') {
    throw new SigningRefused(['INVALID_402'])
  }
  try {
    const mint = new PublicKey(intent.token)
    const authority = new PublicKey(walletAddress)
    return {
      feePayer: new PublicKey(feePayer),
      authority,
      source: getAssociatedTokenAddressSync(mint, authority, false, TOKEN_PROGRAM_ID),
      destination: getAssociatedTokenAddressSync(
        mint,
        new PublicKey(intent.recipient),
        true,
        TOKEN_PROGRAM_ID,
      ),
      mint,
      amount: BigInt(intent.amount),
      decimals: USDC_DECIMALS,
    }
  } catch {
    throw new SigningRefused(['INVALID_402'])
  }
}

const keypairFile = z.array(z.number().int().min(0).max(255)).length(64)

/** A Solana CLI keypair file: a JSON array of 64 bytes. */
export async function loadKeypairSigner(path: string): Promise<TransactionPartialSigner> {
  // The zod schema right here is the validation the lint rule asks for.
  // eslint-disable-next-line no-restricted-properties
  const bytes = keypairFile.safeParse(JSON.parse(await readFile(path, 'utf8')))
  if (!bytes.success) {
    // The path, never the contents: this is the one file that must not reach a log.
    throw new Error(`invalid keypair file: ${path}`)
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(bytes.data))
}
