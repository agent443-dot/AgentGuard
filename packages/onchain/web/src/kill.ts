import {
  PublicKey,
  type AccountInfo,
  type Connection,
  type TransactionInstruction,
} from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { removeSpendingLimitInstruction, spendingLimitPda } from '../../src/svm/squads.js'

export interface KillRequest {
  cluster: string
  multisig: PublicKey
  hotWallet: PublicKey
}

export type KillPlan =
  | { kind: 'sign'; summary: string[]; instruction: TransactionInstruction; limit: PublicKey }
  | { kind: 'done'; summary: string[] }
  | { kind: 'refused'; reason: string }

/** The two accounts the kill depends on, as the chain holds them now. */
export async function readKillState(connection: Connection, request: KillRequest) {
  const limit = spendingLimitPda(request.multisig, request.hotWallet)
  const [multisigInfo, limitInfo] = await connection.getMultipleAccountsInfo([
    request.multisig,
    limit,
  ])
  return { limit, multisigInfo: multisigInfo ?? null, limitInfo: limitInfo ?? null }
}

/**
 * What the owner is asked to sign, or why nothing is offered. The limit's address is derived from the
 * hot wallet exactly as the adapter derives it, so the page cannot remove a different limit from the
 * one guard-core draws on. A limit with unexpected members is still removed, with a warning: the
 * kill is the one action that is always safe to take.
 */
export function planKill(
  request: KillRequest,
  owner: PublicKey,
  state: Awaited<ReturnType<typeof readKillState>>,
): KillPlan {
  const { limit, multisigInfo, limitInfo } = state
  const ms = decode(multisigInfo, multisig.accounts.Multisig)
  if (!ms) {
    return {
      kind: 'refused',
      reason: `There is no Squads multisig at ${request.multisig.toBase58()} on ${request.cluster}.`,
    }
  }
  if (!ms.configAuthority.equals(owner)) {
    return {
      kind: 'refused',
      reason:
        `The connected wallet ${owner.toBase58()} is not this multisig's config authority ` +
        `(${ms.configAuthority.toBase58()}). Connect the owner wallet and open the link again.`,
    }
  }
  const sl = decode(limitInfo, multisig.accounts.SpendingLimit)
  if (!sl) {
    return {
      kind: 'done',
      summary: [
        `The hot wallet ${request.hotWallet.toBase58()} has no spending limit on multisig ` +
          `${request.multisig.toBase58()}: there is nothing to remove.`,
        'It cannot draw from the vault.',
      ],
    }
  }
  if (!sl.multisig.equals(request.multisig)) {
    return {
      kind: 'refused',
      reason: `The account at ${limit.toBase58()} belongs to another multisig.`,
    }
  }

  const expected = (keys: PublicKey[]) => keys.length === 1 && keys[0]!.equals(request.hotWallet)
  const listed = (keys: PublicKey[]) => keys.map((key) => key.toBase58()).join(', ') || '(any)'
  const warnings = [
    ...(expected(sl.members) ? [] : [`Warning: the limit's members are ${listed(sl.members)}.`]),
    ...(expected(sl.destinations)
      ? []
      : [`Warning: the limit's destinations are ${listed(sl.destinations)}.`]),
  ]
  return {
    kind: 'sign',
    limit,
    instruction: removeSpendingLimitInstruction(request.multisig, owner, limit),
    summary: [
      `Kill: remove the spending limit of hot wallet ${request.hotWallet.toBase58()}.`,
      `Multisig ${request.multisig.toBase58()}, on ${request.cluster}.`,
      `Spending limit ${limit.toBase58()}: ${sl.amount.toString()} base units of ` +
        `${sl.mint.toBase58()} per period, ${sl.remainingAmount.toString()} left.`,
      ...warnings,
      'Afterwards the hot wallet cannot draw from the vault until a new limit is added.',
      `Program ${multisig.PROGRAM_ID.toBase58()}, instruction multisigRemoveSpendingLimit, signed by ` +
        `the config authority ${owner.toBase58()}.`,
      'Phantom should show no token leaving your wallet, only the small SOL rent of the limit ' +
        'coming back to you. Reject anything else.',
    ],
  }
}

interface Decoder<T> {
  fromAccountInfo(info: AccountInfo<Buffer>): [T, number]
}

/** An account of the Squads program, decoded, or null when it is missing or someone else's. */
function decode<T>(info: AccountInfo<Buffer> | null, type: Decoder<T>): T | null {
  if (!info || !info.owner.equals(multisig.PROGRAM_ID)) {
    return null
  }
  try {
    return type.fromAccountInfo(info)[0]
  } catch {
    return null
  }
}

export const isPublicKey = (value: string) => {
  try {
    return new PublicKey(value).toBase58() === value
  } catch {
    return false
  }
}
