import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type Keypair,
  type PublicKey,
  type TransactionInstruction,
  type TransactionSignature,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { confirm, VAULT_INDEX } from './squads.js'

/** The hot wallet's own token account for the mint, which a draw on the limit pays into. */
export function hotTokenAccount(mint: PublicKey, hotWallet: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, hotWallet)
}

/** The vault's token account for the mint, which a draw on the limit pays out of. */
export function vaultTokenAccount(multisigPda: PublicKey, mint: PublicKey): PublicKey {
  const [vault] = multisig.getVaultPda({ multisigPda, index: VAULT_INDEX })
  return getAssociatedTokenAddressSync(mint, vault, true)
}

export interface Draw {
  multisigPda: PublicKey
  spendingLimit: PublicKey
  mint: PublicKey
  amount: bigint
  decimals: number
  /** The member drawing, paid into its own token account. */
  member: PublicKey
  /** Whether that token account has yet to be created. */
  createAccount: boolean
}

/**
 * The hot wallet drawing on its limit, creating its token account first when it has none. The SDK
 * takes the amount as a JS number while every amount we handle is a bigint, so the conversion is
 * confined here and refuses anything a double cannot hold exactly rather than rounding it.
 */
export function drawInstructions(draw: Draw): TransactionInstruction[] {
  if (draw.amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amount_exceeds_sdk_precision: ${draw.amount}`)
  }
  const account = hotTokenAccount(draw.mint, draw.member)
  const create = createAssociatedTokenAccountIdempotentInstruction(
    draw.member,
    account,
    draw.member,
    draw.mint,
  )
  const use = multisig.instructions.spendingLimitUse({
    multisigPda: draw.multisigPda,
    member: draw.member,
    spendingLimit: draw.spendingLimit,
    mint: draw.mint,
    vaultIndex: VAULT_INDEX,
    amount: Number(draw.amount),
    decimals: draw.decimals,
    destination: draw.member,
  })
  return draw.createAccount ? [create, use] : [use]
}

export async function useSpendingLimit(
  connection: Connection,
  member: Keypair,
  draw: Omit<Draw, 'member' | 'createAccount'>,
): Promise<TransactionSignature> {
  const account = await connection.getAccountInfo(hotTokenAccount(draw.mint, member.publicKey))
  const { blockhash } = await connection.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: member.publicKey,
    recentBlockhash: blockhash,
    instructions: drawInstructions({
      ...draw,
      member: member.publicKey,
      createAccount: account === null,
    }),
  }).compileToV0Message()
  const tx = new VersionedTransaction(message)
  tx.sign([member])
  return confirm(connection, await connection.sendRawTransaction(tx.serialize()))
}
