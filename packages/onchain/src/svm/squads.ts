import type { Amount } from '@agentguard/shared'
import * as multisig from '@sqds/multisig'
import {
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  type PublicKey,
  type TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js'
import type { OwnerSigner } from './owner.js'

const { Period } = multisig.generated

/** One vault per multisig in the MVP. Squads supports more; we have no use for them yet. */
export const VAULT_INDEX = 0

export function connect(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed')
}

/**
 * The Squads rpc helpers return as soon as a transaction is submitted, not when it lands, and never
 * look at whether it failed. Every call goes through here so that a returned signature means the
 * transaction actually executed.
 */
export async function confirm(
  connection: Connection,
  signature: TransactionSignature,
  timeoutMs = 60_000,
): Promise<TransactionSignature> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const {
      value: [status],
    } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true })
    if (status?.err) {
      throw new Error(`transaction_failed: ${signature} ${JSON.stringify(status.err)}`)
    }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return signature
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`transaction_unconfirmed: ${signature}`)
}

/**
 * Everything the owner signs goes through here rather than the SDK's rpc helpers, which only take a
 * keypair. The owner pays the fee, so on mainnet one Ledger approval covers the whole transaction.
 * A legacy message, because it is the format every version of the Ledger Solana app reads.
 */
export async function sendAsOwner(
  connection: Connection,
  owner: OwnerSigner,
  instructions: TransactionInstruction[],
  coSigners: Keypair[] = [],
): Promise<TransactionSignature> {
  const { blockhash } = await connection.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: owner.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToLegacyMessage()
  const transaction = new VersionedTransaction(message)
  transaction.sign(coSigners)
  await owner.sign(transaction)
  return confirm(connection, await connection.sendRawTransaction(transaction.serialize()))
}

export interface CreatedMultisig {
  multisigPda: PublicKey
  vault: PublicKey
  signature: TransactionSignature
}

/**
 * A controlled multisig: the owner is the config authority and can add or remove a spending limit
 * directly. With one member and a threshold of one that grants nothing extra, and it keeps the
 * setup scripts from needing a propose-approve-execute round trip for every change.
 */
export async function createMultisig(
  connection: Connection,
  owner: OwnerSigner,
): Promise<CreatedMultisig> {
  const createKey = Keypair.generate()
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey })
  const [programConfigPda] = multisig.getProgramConfigPda({})
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda,
  )

  const create = createMultisigInstruction(
    owner.publicKey,
    createKey.publicKey,
    programConfig.treasury,
  )
  const signature = await sendAsOwner(connection, owner, [create], [createKey])

  const [vault] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX })
  return { multisigPda, vault, signature }
}

/** The owner as config authority and sole member, threshold one; `createKey` must co-sign. */
export function createMultisigInstruction(
  owner: PublicKey,
  createKey: PublicKey,
  treasury: PublicKey,
): TransactionInstruction {
  const [multisigPda] = multisig.getMultisigPda({ createKey })
  return multisig.instructions.multisigCreateV2({
    treasury,
    creator: owner,
    multisigPda,
    configAuthority: owner,
    threshold: 1,
    members: [{ key: owner, permissions: multisig.types.Permissions.all() }],
    timeLock: 0,
    createKey,
    rentCollector: null,
  })
}

export function spendingLimitPda(multisigPda: PublicKey, createKey: PublicKey): PublicKey {
  const [pda] = multisig.getSpendingLimitPda({ multisigPda, createKey })
  return pda
}

/**
 * The onchain cap. `members` are the keys allowed to draw on it and `destinations` restricts where
 * the money may go — part of what we enforce offchain is enforceable here, so we use both.
 */
export async function addDailySpendingLimit(
  connection: Connection,
  owner: OwnerSigner,
  params: DailyLimit,
): Promise<TransactionSignature> {
  return sendAsOwner(connection, owner, [addSpendingLimitInstruction(owner.publicKey, params)])
}

export interface DailyLimit {
  multisigPda: PublicKey
  createKey: PublicKey
  mint: PublicKey
  amount: bigint
  members: PublicKey[]
  destinations: PublicKey[]
}

export function addSpendingLimitInstruction(
  configAuthority: PublicKey,
  params: DailyLimit,
): TransactionInstruction {
  return multisig.instructions.multisigAddSpendingLimit({
    multisigPda: params.multisigPda,
    configAuthority,
    spendingLimit: spendingLimitPda(params.multisigPda, params.createKey),
    rentPayer: configAuthority,
    createKey: params.createKey,
    vaultIndex: VAULT_INDEX,
    mint: params.mint,
    amount: params.amount,
    period: Period.Day,
    members: params.members,
    destinations: params.destinations,
  })
}

/** The kill switch: without its spending limit the hot wallet cannot draw on the vault at all. */
export function removeSpendingLimitInstruction(
  multisigPda: PublicKey,
  configAuthority: PublicKey,
  spendingLimit: PublicKey,
): TransactionInstruction {
  return multisig.instructions.multisigRemoveSpendingLimit({
    multisigPda,
    configAuthority,
    spendingLimit,
    rentCollector: configAuthority,
  })
}

export async function removeSpendingLimit(
  connection: Connection,
  owner: OwnerSigner,
  multisigPda: PublicKey,
  spendingLimit: PublicKey,
): Promise<TransactionSignature> {
  const remove = removeSpendingLimitInstruction(multisigPda, owner.publicKey, spendingLimit)
  return sendAsOwner(connection, owner, [remove])
}

export interface SpendingLimitState {
  cap: Amount
  spent: Amount
  resetsAt: string
  members: string[]
  destinations: string[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function readSpendingLimit(
  connection: Connection,
  spendingLimit: PublicKey,
): Promise<SpendingLimitState> {
  const account = await multisig.accounts.SpendingLimit.fromAccountAddress(
    connection,
    spendingLimit,
  )
  const cap = BigInt(account.amount.toString())
  const remaining = BigInt(account.remainingAmount.toString())
  const lastReset = Number(account.lastReset.toString()) * 1000

  return {
    cap: cap.toString(),
    spent: (cap - remaining).toString(),
    resetsAt: new Date(lastReset + DAY_MS).toISOString(),
    members: account.members.map((m) => m.toBase58()),
    destinations: account.destinations.map((d) => d.toBase58()),
  }
}
