import { isAddressEqual, type Address, type Hex, type PublicClient } from 'viem'
import type { Plan } from '../plan.js'
import { safeAbi } from './calls.js'

/** What the page asks the owner to send on an EVM chain: one call from the owner's account. */
export type EvmPlan =
  | Exclude<Plan, { kind: 'sign' }>
  | {
      kind: 'sign'
      title: string
      summary: string[]
      to: Address
      data: Hex
      after: string
      landed: () => Promise<string[] | undefined>
    }

/** The page only drives a Safe whose one owner, at threshold 1, is the connected account. */
export async function notSoleOwner(
  client: PublicClient,
  safe: Address,
  owner: Address,
  cluster: string,
): Promise<string | undefined> {
  if (!(await client.getCode({ address: safe }))) {
    return `There is no Safe at ${safe} on ${cluster}.`
  }
  const read = { address: safe, abi: safeAbi } as const
  const [owners, threshold] = await Promise.all([
    client.readContract({ ...read, functionName: 'getOwners' }),
    client.readContract({ ...read, functionName: 'getThreshold' }),
  ])
  if (owners.length === 1 && isAddressEqual(owners[0]!, owner) && threshold === 1n) {
    return undefined
  }
  return (
    `The connected account ${owner} is not this Safe's only owner (owners ${owners.join(', ')}, ` +
    `threshold ${threshold}). Connect the owner account and open the link again.`
  )
}
