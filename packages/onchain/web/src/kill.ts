import type { Connection, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { removeSpendingLimitInstruction, spendingLimitPda } from '../../src/svm/squads.js'
import { controlled, decode, program, refused, type Plan } from './plan.js'

export interface KillRequest {
  cluster: string
  multisig: PublicKey
  hotWallet: PublicKey
}

/**
 * The kill: removing the hot wallet's spending limit. The limit's address is derived from the hot
 * wallet exactly as the adapter derives it, so the page cannot remove a different limit from the one
 * guard-core draws on. A limit with unexpected members is still removed, with a warning: the kill is
 * the one action that is always safe to take.
 */
export async function prepareKill(
  connection: Connection,
  request: KillRequest,
  owner: PublicKey,
): Promise<Plan> {
  const limit = spendingLimitPda(request.multisig, request.hotWallet)
  const [msInfo, limitInfo] = await connection.getMultipleAccountsInfo([request.multisig, limit])
  const ms = controlled(msInfo, request.multisig, request.cluster, owner)
  if (typeof ms === 'string') {
    return refused(ms)
  }
  const sl = decode(limitInfo, multisig.accounts.SpendingLimit)
  if (!sl) {
    return {
      kind: 'done',
      title: 'Already killed',
      summary: [
        `The hot wallet ${request.hotWallet.toBase58()} has no spending limit on multisig ` +
          `${request.multisig.toBase58()}: there is nothing to remove.`,
        'It cannot draw from the vault.',
      ],
    }
  }
  if (!sl.multisig.equals(request.multisig)) {
    return refused(`The account at ${limit.toBase58()} belongs to another multisig.`)
  }

  const expected = (keys: PublicKey[]) => keys.length === 1 && keys[0]!.equals(request.hotWallet)
  const listed = (keys: PublicKey[]) => keys.map((key) => key.toBase58()).join(', ') || '(any)'
  return {
    kind: 'sign',
    title: 'Kill the hot wallet',
    instructions: [removeSpendingLimitInstruction(request.multisig, owner, limit)],
    coSigners: [],
    after: 'Killed',
    summary: [
      `Kill: remove the spending limit of hot wallet ${request.hotWallet.toBase58()}.`,
      `Multisig ${request.multisig.toBase58()}, on ${request.cluster}.`,
      `Spending limit ${limit.toBase58()}: ${sl.amount.toString()} base units of ` +
        `${sl.mint.toBase58()} per period, ${sl.remainingAmount.toString()} left.`,
      ...(expected(sl.members) ? [] : [`Warning: the limit's members are ${listed(sl.members)}.`]),
      ...(expected(sl.destinations)
        ? []
        : [`Warning: the limit's destinations are ${listed(sl.destinations)}.`]),
      'Afterwards the hot wallet cannot draw from the vault until a new limit is added.',
      program('multisigRemoveSpendingLimit', `the config authority ${owner.toBase58()}`),
      'Phantom should show no token leaving your wallet, only the small SOL rent of the limit ' +
        'coming back to you. Reject anything else.',
    ],
    landed: async () =>
      (await connection.getAccountInfo(limit))
        ? undefined
        : [
            `The spending limit ${limit.toBase58()} is gone.`,
            'The hot wallet can no longer draw from the vault.',
            // Removing the limit does not pause guard-core; only the bot's kill does.
            'In Telegram, check /status that guard-core is paused, or run /kill → Kill everything if ' +
              'you have not.',
          ],
  }
}
