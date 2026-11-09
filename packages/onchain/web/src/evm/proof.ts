import { formatUnits, isAddressEqual, parseAbi, type Address, type PublicClient } from 'viem'
import { USDC_DECIMALS } from '@agentguard/shared'
import { readAllowance } from '../../../src/evm/safe.js'
import type { Proof } from '../proof.js'
import { safeAbi } from './calls.js'

export interface EvmProofRequest {
  cluster: string
  safe: Address
  /** Fixed when the page was built, as are the module and the token: never taken from the link. */
  hot: Address
  module: Address
  usd: Address
  symbol: string
}

const SENTINEL = '0x0000000000000000000000000000000000000001'
const readAbi = parseAbi([
  'function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)',
  'function getDelegates(address safe, uint48 start, uint8 pageSize) view returns (address[] results, uint48 next)',
  'function getTokens(address safe, address delegate) view returns (address[])',
  'function balanceOf(address owner) view returns (uint256)',
])

/**
 * How much the hot wallet can draw from a Safe today, read from the chain. Every enabled module and
 * every delegate counts: another module can move funds on its own terms, and another delegate, or
 * an allowance in another token, is a draw this page cannot bound.
 */
export async function proveEvm(client: PublicClient, request: EvmProofRequest): Promise<Proof> {
  const { cluster, safe, hot, module, usd, symbol } = request
  if (!(await client.getCode({ address: safe }))) {
    return {
      verified: false,
      title: 'Not verified',
      lines: [`There is no Safe at ${safe} on ${cluster}.`],
    }
  }
  const read = { address: safe, abi: safeAbi } as const
  const [owners, threshold, [modules], [delegates], balance] = await Promise.all([
    client.readContract({ ...read, functionName: 'getOwners' }),
    client.readContract({ ...read, functionName: 'getThreshold' }),
    client.readContract({
      address: safe,
      abi: readAbi,
      functionName: 'getModulesPaginated',
      args: [SENTINEL, 20n],
    }),
    client.readContract({
      address: module,
      abi: readAbi,
      functionName: 'getDelegates',
      args: [safe, 0, 50],
    }),
    client.readContract({ address: usd, abi: readAbi, functionName: 'balanceOf', args: [safe] }),
  ])
  const amount = (value: bigint) => `${formatUnits(value, USDC_DECIMALS)} ${symbol}`
  const facts = [
    `Safe ${safe} on ${cluster}. Owners: ${owners.join(', ')}, threshold ${threshold}.`,
    `It holds ${amount(balance)}.`,
  ]
  const moduleOn = modules.some((m) => isAddressEqual(m, module))
  const problems = modules
    .filter((m) => !isAddressEqual(m, module))
    .map((m) => `Module ${m} is enabled: it can move the Safe's funds on its own terms.`)
  const tokens = moduleOn
    ? await Promise.all(
        delegates.map((delegate) =>
          client.readContract({
            address: module,
            abi: readAbi,
            functionName: 'getTokens',
            args: [safe, delegate],
          }),
        ),
      )
    : []
  delegates.forEach((delegate, i) => {
    if (!isAddressEqual(delegate, hot)) {
      problems.push(`Delegate ${delegate} of the Allowance Module can draw too.`)
    }
    const others = (tokens[i] ?? []).filter((token) => !isAddressEqual(token, usd))
    if (others.length > 0) {
      problems.push(`Delegate ${delegate} has allowances in ${others.join(', ')}, not ${symbol}.`)
    }
  })
  if (problems.length > 0) {
    return {
      verified: false,
      title: 'Not verified',
      lines: [
        `This Safe's spending rights are not only the hot wallet ${hot} drawing ${symbol} through ` +
          'the Allowance Module, so this page cannot say how much can be drawn.',
        ...problems,
        ...facts,
      ],
    }
  }
  const drawing = moduleOn && delegates.some((d) => isAddressEqual(d, hot))
  const allowance = drawing ? await readAllowance(client, module, safe, hot, usd) : undefined
  if (!allowance || allowance.amount === 0n) {
    return {
      verified: true,
      title: `The most this agent can draw today: 0 ${symbol}`,
      lines: [
        'No allowance: the hot wallet cannot draw from the Safe. This is how a Safe looks after a ' +
          'kill, or before the allowance is set.',
        ...facts,
      ],
    }
  }
  // The module applies the daily reset when it is read, so spent is already today's.
  const left = allowance.amount - allowance.spent
  const most = left < balance ? left : balance
  const resetsAt = new Date(Number(allowance.lastResetMin + allowance.resetTimeMin) * 60_000)
  return {
    verified: true,
    title: `The most this agent can draw today: ${amount(most)}`,
    lines: [
      `Verified from the chain: the Allowance Module ${module} lets only the hot wallet ${hot} draw, ` +
        `and only ${symbol}.`,
      `Daily cap: ${amount(allowance.amount)} every ${allowance.resetTimeMin} minutes. Left today: ` +
        `${amount(left)}. It resets at ${resetsAt.toISOString()}.`,
      ...facts,
      ...(balance < left
        ? ['The Safe holds less than is left today, so the Safe is the limit.']
        : []),
    ],
  }
}
