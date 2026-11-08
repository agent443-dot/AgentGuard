import {
  bytesToBigInt,
  decodeFunctionResult,
  isAddressEqual,
  parseAbi,
  type Address,
  type PublicClient,
} from 'viem'
import { PROXY_FACTORY, SAFE_L2, createData, safeAbi } from './calls.js'
import type { EvmPlan } from './plan.js'

const created = parseAbi([
  'function createProxyWithNonce(address, bytes, uint256) returns (address)',
])

/**
 * A Safe for the connected account, as create-safe makes it, through Safe's canonical factory. The
 * salt is new for each page load, and the dry run of the very call Phantom will send says where the
 * Safe will be, so the page names the address before the owner signs.
 */
export async function prepareEvmCreate(
  client: PublicClient,
  cluster: string,
  owner: Address,
): Promise<EvmPlan> {
  const salt = bytesToBigInt(crypto.getRandomValues(new Uint8Array(32)))
  const data = createData(owner, salt)
  const { data: result } = await client.call({ account: owner, to: PROXY_FACTORY, data })
  const safe = decodeFunctionResult({
    abi: created,
    functionName: 'createProxyWithNonce',
    data: result!,
  })
  return {
    kind: 'sign',
    title: 'Create the Safe',
    to: PROXY_FACTORY,
    data,
    after: 'Safe created',
    summary: [
      `Create a Safe at ${safe}, on ${cluster}.`,
      `Its only owner: this account, ${owner}. Threshold 1.`,
      `Contract ${PROXY_FACTORY} (Safe's proxy factory), function createProxyWithNonce, Safe ` +
        `${SAFE_L2} (SafeL2 1.4.1).`,
      'Phantom should show no token and no ETH leaving your account, only the network fee. ' +
        'Reject anything else.',
    ],
    landed: async () => {
      if (!(await client.getCode({ address: safe }))) {
        return undefined
      }
      const read = { address: safe, abi: safeAbi } as const
      const [owners, threshold] = await Promise.all([
        client.readContract({ ...read, functionName: 'getOwners' }),
        client.readContract({ ...read, functionName: 'getThreshold' }),
      ])
      if (owners.length !== 1 || !isAddressEqual(owners[0]!, owner) || threshold !== 1n) {
        return [`The Safe at ${safe} does not match what was signed.`]
      }
      return [
        `Safe ${safe} exists, owned by ${owner} alone.`,
        `Set ROBINHOOD_SAFE_ADDRESS=${safe} for guard-core.`,
        'Next: fund it with USDG and set the allowance, from the link for that.',
      ]
    },
  }
}
