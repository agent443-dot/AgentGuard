import type { Address, PublicClient } from 'viem'
import { hasAllowance, readAllowance } from '../../../src/evm/safe.js'
import { killData } from './calls.js'
import { notSoleOwner, type EvmPlan } from './plan.js'

export interface EvmKillRequest {
  cluster: string
  safe: Address
  hot: Address
  module: Address
  usd: Address
}

/**
 * The kill on an EVM chain: removeDelegate(hot, true) through the Safe, the call buildKillTx builds.
 * Like the Solana kill it is always safe to take, so it only needs the owner to be the owner.
 */
export async function prepareEvmKill(
  client: PublicClient,
  request: EvmKillRequest,
  owner: Address,
): Promise<EvmPlan> {
  const { cluster, safe, hot, module, usd } = request
  const refusal = await notSoleOwner(client, safe, owner, cluster)
  if (refusal) {
    return { kind: 'refused', reason: refusal }
  }
  const allowance = await readAllowance(client, module, safe, hot, usd)
  const drawing = () => hasAllowance(client, module, safe, hot, allowance)
  if (!(await drawing())) {
    return {
      kind: 'done',
      title: 'Already killed',
      summary: [
        `The hot wallet ${hot} has no allowance on Safe ${safe}: there is nothing to remove.`,
        'It cannot draw from the Safe.',
      ],
    }
  }
  return {
    kind: 'sign',
    title: 'Kill the hot wallet',
    safe,
    data: killData(owner, module, hot),
    after: 'Killed',
    summary: [
      `Kill: remove the hot wallet ${hot} as a delegate of the Allowance Module, with its allowances.`,
      `Safe ${safe}, on ${cluster}.`,
      `Allowance: ${allowance.amount} base units of ${usd} per ${allowance.resetTimeMin} minutes, ` +
        `${allowance.spent} spent.`,
      'Afterwards the hot wallet cannot draw from the Safe until a new allowance is set.',
      `Contract ${safe}, function execTransaction, calling removeDelegate on module ${module}.`,
      'Phantom should show no token and no ETH leaving your account, only the network fee. ' +
        'Reject anything else.',
    ],
    landed: async () =>
      (await drawing())
        ? undefined
        : [
            `The hot wallet ${hot} is no longer a delegate of Safe ${safe}.`,
            'It can no longer draw from the Safe.',
            'In Telegram, check /status that guard-core is paused, or run /kill → Kill everything if ' +
              'you have not.',
          ],
  }
}
