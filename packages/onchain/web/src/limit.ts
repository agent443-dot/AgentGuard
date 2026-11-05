import type { Connection, PublicKey } from '@solana/web3.js'
import * as multisig from '@sqds/multisig'
import { USDC_DECIMALS } from '@agentguard/shared'
import { formatUnits } from '../../src/svm/transfer.js'
import { addSpendingLimitInstruction, spendingLimitPda } from '../../src/svm/squads.js'
import { controlled, decode, program, refused, type Plan } from './plan.js'

export interface LimitRequest {
  cluster: string
  multisig: PublicKey
  hotWallet: PublicKey
  /** USDC for the cluster, fixed when the page was built; never taken from the link. */
  usdc: PublicKey
  amount: bigint
}

/**
 * The onchain cap, exactly as add-spending-limit sets it: USDC, per day, only the hot wallet may
 * draw and only into itself, at the address derived from the hot wallet so the adapter finds it.
 * The amount is the one value the link chooses, so it leads the summary.
 */
export async function prepareLimit(
  connection: Connection,
  request: LimitRequest,
  owner: PublicKey,
): Promise<Plan> {
  const limit = spendingLimitPda(request.multisig, request.hotWallet)
  const [msInfo, limitInfo] = await connection.getMultipleAccountsInfo([request.multisig, limit])
  const ms = controlled(msInfo, request.multisig, request.cluster, owner)
  if (typeof ms === 'string') {
    return refused(ms)
  }
  const existing = decode(limitInfo, multisig.accounts.SpendingLimit)
  if (existing) {
    return refused(
      `The hot wallet already has a spending limit, ${existing.amount.toString()} base units per ` +
        'period. To change it, kill it first, then add the new one.',
    )
  }
  const hot = request.hotWallet.toBase58()
  const usdc = `${formatUnits(request.amount, USDC_DECIMALS)} USDC`
  return {
    kind: 'sign',
    title: 'Set the daily cap',
    instructions: [
      addSpendingLimitInstruction(owner, {
        multisigPda: request.multisig,
        createKey: request.hotWallet,
        mint: request.usdc,
        amount: request.amount,
        members: [request.hotWallet],
        destinations: [request.hotWallet],
      }),
    ],
    coSigners: [],
    after: 'Daily cap set',
    summary: [
      `Daily cap: ${usdc} (${request.amount} base units of ${request.usdc.toBase58()}), refilled ` +
        'every 24 hours.',
      `Only the hot wallet ${hot} may draw on it, and only into itself.`,
      `Multisig ${request.multisig.toBase58()}, on ${request.cluster}; limit account ${limit.toBase58()}.`,
      program('multisigAddSpendingLimit', `the config authority ${owner.toBase58()}`),
      "Phantom should show only a little SOL leaving your wallet, the limit account's rent. " +
        'Reject anything else.',
    ],
    landed: async () => {
      const sl = decode(await connection.getAccountInfo(limit), multisig.accounts.SpendingLimit)
      if (!sl) {
        return undefined
      }
      const only = (keys: PublicKey[]) => keys.length === 1 && keys[0]!.equals(request.hotWallet)
      const exact =
        sl.mint.equals(request.usdc) &&
        BigInt(sl.amount.toString()) === request.amount &&
        sl.period === multisig.generated.Period.Day &&
        only(sl.members) &&
        only(sl.destinations)
      return exact
        ? [`The hot wallet ${hot} may now draw up to ${usdc} a day from the vault.`]
        : [`The limit at ${limit.toBase58()} does not match what was signed. Run status now.`]
    },
  }
}
