import { formatUnits, type Address, type PublicClient } from 'viem'
import { USDC_DECIMALS } from '@agentguard/shared'
import { hasAllowance, readAllowance, RESET_TIME_MIN } from '../../../src/evm/safe.js'
import { MULTI_SEND_CALL_ONLY, enableData, safeAbi } from './calls.js'
import { notSoleOwner, type EvmPlan } from './plan.js'

export interface EvmEnableRequest {
  cluster: string
  safe: Address
  /** Fixed when the page was built, as are the module and the token: never taken from the link. */
  hot: Address
  module: Address
  usd: Address
  symbol: string
  amount: bigint
}

/**
 * The onchain cap, as enable-allowance sets it: the module, the hot wallet as its only delegate,
 * and a daily allowance in the dollar token. The amount is the one value the link chooses, so it
 * leads the summary.
 */
export async function prepareEvmEnable(
  client: PublicClient,
  request: EvmEnableRequest,
  owner: Address,
): Promise<EvmPlan> {
  const { cluster, safe, hot, module, usd, symbol, amount } = request
  const refusal = await notSoleOwner(client, safe, owner, cluster)
  if (refusal) {
    return { kind: 'refused', reason: refusal }
  }
  const allowance = () => readAllowance(client, module, safe, hot, usd)
  const enabled = () =>
    client.readContract({
      address: safe,
      abi: safeAbi,
      functionName: 'isModuleEnabled',
      args: [module],
    })
  const [moduleOn, before] = await Promise.all([enabled(), allowance()])
  if (moduleOn && (await hasAllowance(client, module, safe, hot, before))) {
    return {
      kind: 'refused',
      reason:
        `The hot wallet already has an allowance, ${before.amount} base units per day. To change ` +
        'it, kill it first, then set the new one.',
    }
  }
  const cap = `${formatUnits(amount, USDC_DECIMALS)} ${symbol}`
  return {
    kind: 'sign',
    title: 'Set the daily cap',
    to: safe,
    data: enableData(owner, safe, { module, hot, usd, cap: amount }, moduleOn),
    after: 'Daily cap set',
    summary: [
      `Daily cap: ${cap} (${amount} base units of ${usd}), refilled every 24 hours.`,
      `Only the hot wallet ${hot} may draw on it.`,
      `Safe ${safe}, on ${cluster}; Allowance Module ${module}` +
        (moduleOn ? ', already enabled.' : ', enabled by this same transaction.'),
      `Contract ${safe}, function execTransaction, batching through MultiSendCallOnly ` +
        `${MULTI_SEND_CALL_ONLY}.`,
      'Phantom should show no token and no ETH leaving your account, only the network fee. ' +
        'Reject anything else.',
    ],
    landed: async () => {
      const after = await allowance()
      if (!(await enabled()) || !(await hasAllowance(client, module, safe, hot, after))) {
        return undefined
      }
      return after.amount === amount && after.resetTimeMin === BigInt(RESET_TIME_MIN)
        ? [`The hot wallet ${hot} may now draw up to ${cap} a day from the Safe.`]
        : [`The allowance on ${safe} does not match what was signed. Run status now.`]
    },
  }
}
