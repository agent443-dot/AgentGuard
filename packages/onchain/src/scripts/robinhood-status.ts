import { createPublicClient, http, parseAbi } from 'viem'
import { chainOf } from '../evm/config.js'
import { loadRobinhoodConfig } from '../evm/robinhood.js'
import { hasAllowance, readAllowance } from '../evm/safe.js'

/**
 * The Robinhood Chain setup as the chain holds it: the Safe's owners and threshold, the module, the
 * USDG it holds, and the hot wallet's allowance. Read-only; nothing here signs.
 *
 *   pnpm status:robinhood
 */
const config = loadRobinhoodConfig()
const chain = chainOf(config.chainId)
const client = createPublicClient({ chain, transport: http(config.rpcUrl) })
const safeAbi = parseAbi([
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function isModuleEnabled(address module) view returns (bool)',
])
const erc20 = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

const servedChainId = await client.getChainId()
if (servedChainId !== chain.id) {
  console.error(`ROBINHOOD_RPC_URL serves chain ${servedChainId}, not ${config.chain}`)
  process.exit(1)
}
const safe = { address: config.safe, abi: safeAbi } as const
const [owners, threshold, enabled, balance, allowance] = await Promise.all([
  client.readContract({ ...safe, functionName: 'getOwners' }),
  client.readContract({ ...safe, functionName: 'getThreshold' }),
  client.readContract({ ...safe, functionName: 'isModuleEnabled', args: [config.module] }),
  client.readContract({
    address: config.usdg,
    abi: erc20,
    functionName: 'balanceOf',
    args: [config.safe],
  }),
  readAllowance(client, config.module, config.safe, config.hot, config.usdg),
])
const drawing = await hasAllowance(client, config.module, config.safe, config.hot, allowance)

console.log(`chain:     ${config.chain} at ${new URL(config.rpcUrl).host}`)
console.log(`safe:      ${config.safe}`)
console.log(`owners:    ${owners.join(', ')}`)
console.log(`threshold: ${threshold}`)
console.log(`usdg:      ${balance} base units in the Safe (${config.usdg})`)
console.log(`module:    ${config.module} ${enabled ? 'enabled' : 'NOT enabled'}`)
console.log(`delegate:  ${config.hot}`)
if (!drawing) {
  console.log('allowance: none: the hot wallet can draw nothing')
} else {
  const resetsAt = new Date(Number(allowance.lastResetMin + allowance.resetTimeMin) * 60_000)
  console.log(`allowance: cap ${allowance.amount}, spent ${allowance.spent}`)
  console.log(
    `           resets every ${allowance.resetTimeMin} min, next ${resetsAt.toISOString()}`,
  )
}
