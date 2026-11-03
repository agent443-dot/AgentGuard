import type { Amount } from '@agentguard/shared'
import * as multisig from '@sqds/multisig'
import { Connection, Keypair } from '@solana/web3.js'
import type { PublicKey, TransactionSignature } from '@solana/web3.js'

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
  owner: Keypair,
): Promise<CreatedMultisig> {
  const createKey = Keypair.generate()
  const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey })
  const [programConfigPda] = multisig.getProgramConfigPda({})
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda,
  )

  const sent = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programConfig.treasury,
    createKey,
    creator: owner,
    multisigPda,
    configAuthority: owner.publicKey,
    threshold: 1,
    members: [
      {
        key: owner.publicKey,
        permissions: multisig.types.Permissions.all(),
      },
    ],
    timeLock: 0,
    rentCollector: null,
  })
  const signature = await confirm(connection, sent)

  const [vault] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX })
  return { multisigPda, vault, signature }
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
  owner: Keypair,
  params: {
    multisigPda: PublicKey
    createKey: PublicKey
    mint: PublicKey
    amount: bigint
    members: PublicKey[]
    destinations: PublicKey[]
  },
): Promise<TransactionSignature> {
  const sent = await multisig.rpc.multisigAddSpendingLimit({
    connection,
    feePayer: owner,
    multisigPda: params.multisigPda,
    configAuthority: owner.publicKey,
    spendingLimit: spendingLimitPda(params.multisigPda, params.createKey),
    rentPayer: owner,
    createKey: params.createKey,
    vaultIndex: VAULT_INDEX,
    mint: params.mint,
    amount: params.amount,
    period: Period.Day,
    members: params.members,
    destinations: params.destinations,
  })
  return confirm(connection, sent)
}

export async function removeSpendingLimit(
  connection: Connection,
  owner: Keypair,
  multisigPda: PublicKey,
  spendingLimit: PublicKey,
): Promise<TransactionSignature> {
  const sent = await multisig.rpc.multisigRemoveSpendingLimit({
    connection,
    feePayer: owner,
    multisigPda,
    configAuthority: owner.publicKey,
    spendingLimit,
    rentCollector: owner.publicKey,
  })
  return confirm(connection, sent)
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

/**
 * The hot wallet drawing on its limit. The SDK takes the amount as a JS number while every amount
 * we handle is a bigint, so the conversion is confined here and refuses anything a double cannot
 * hold exactly rather than rounding it.
 */
export async function useSpendingLimit(
  connection: Connection,
  member: Keypair,
  params: {
    multisigPda: PublicKey
    spendingLimit: PublicKey
    mint: PublicKey
    amount: bigint
    decimals: number
    destination: PublicKey
  },
): Promise<TransactionSignature> {
  if (params.amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amount_exceeds_sdk_precision: ${params.amount}`)
  }
  const sent = await multisig.rpc.spendingLimitUse({
    connection,
    feePayer: member,
    member,
    multisigPda: params.multisigPda,
    spendingLimit: params.spendingLimit,
    mint: params.mint,
    vaultIndex: VAULT_INDEX,
    amount: Number(params.amount),
    decimals: params.decimals,
    destination: params.destination,
  })
  return confirm(connection, sent)
}
