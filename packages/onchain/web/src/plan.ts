import {
  PublicKey,
  type AccountInfo,
  type Keypair,
  type TransactionInstruction,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'

/**
 * What the page asks the owner to sign, or why it asks nothing. `landed` reads the chain after
 * Phantom has sent the transaction and returns what to tell the owner once the change is there.
 */
export type Plan =
  | {
      kind: 'sign'
      title: string
      summary: string[]
      instructions: TransactionInstruction[]
      /** Keys the page itself made for this transaction, which sign before Phantom does. */
      coSigners: Keypair[]
      /** The heading once `landed` has found the change. */
      after: string
      landed: () => Promise<string[] | undefined>
    }
  | { kind: 'done'; title: string; summary: string[] }
  | { kind: 'refused'; reason: string }

export const refused = (reason: string): Plan => ({ kind: 'refused', reason })

interface Decoder<T> {
  fromAccountInfo(info: AccountInfo<Buffer>): [T, number]
}

/** An account of the Squads program, decoded, or null when it is missing or someone else's. */
export function decode<T>(
  info: AccountInfo<Buffer> | null | undefined,
  type: Decoder<T>,
): T | null {
  if (!info || !info.owner.equals(multisig.PROGRAM_ID)) {
    return null
  }
  try {
    return type.fromAccountInfo(info)[0]
  } catch {
    return null
  }
}

/** The multisig, if it exists and the connected wallet is its config authority. */
export function controlled(
  info: AccountInfo<Buffer> | null | undefined,
  address: PublicKey,
  cluster: string,
  owner: PublicKey,
): multisig.accounts.Multisig | string {
  const ms = decode(info, multisig.accounts.Multisig)
  if (!ms) {
    return `There is no Squads multisig at ${address.toBase58()} on ${cluster}.`
  }
  if (!ms.configAuthority.equals(owner)) {
    return (
      `The connected wallet ${owner.toBase58()} is not this multisig's config authority ` +
      `(${ms.configAuthority.toBase58()}). Connect the owner wallet and open the link again.`
    )
  }
  return ms
}

export const isPublicKey = (value: string) => {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}

export const program = (instruction: string, signers: string) =>
  `Program ${multisig.PROGRAM_ID.toBase58()}, instruction ${instruction}, signed by ${signers}.`
