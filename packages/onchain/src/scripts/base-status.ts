import { getAddress, parseAbi } from 'viem'
import { contractAddress, loadEvmConfig } from '../evm/config.js'
import { Safe } from '../evm/kit.js'
import { publicClient, readAllowance } from '../evm/safe.js'

const config = loadEvmConfig()
if (!config.SAFE_ADDRESS) {
  console.error('SAFE_ADDRESS is not set.')
  process.exit(1)
}

const client = publicClient(config)
const safeAddress = getAddress(config.SAFE_ADDRESS)
const delegate = getAddress(config.HOT_WALLET_ADDRESS)
const module = contractAddress(config, 'allowanceModule').address
const usdc = contractAddress(config, 'usdc').address
const erc20 = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

// Everything below is read from the chain; nothing is taken from .env but the addresses to read.
const kit = await Safe.init({ provider: config.BASE_RPC_URL, safeAddress })
const [owners, threshold, enabled, balance, allowance] = await Promise.all([
  kit.getOwners(),
  kit.getThreshold(),
  kit.isModuleEnabled(module),
  client.readContract({
    address: usdc,
    abi: erc20,
    functionName: 'balanceOf',
    args: [safeAddress],
  }),
  readAllowance(client, module, safeAddress, delegate, usdc),
])

console.log(`safe:      ${safeAddress}`)
console.log(`owners:    ${owners.join(', ')}`)
console.log(`threshold: ${threshold}`)
console.log(`usdc:      ${balance} atomic units in the Safe`)
console.log(`module:    ${module} ${enabled ? 'enabled' : 'NOT enabled'}`)
console.log(`delegate:  ${delegate}`)
if (allowance.nonce === 0n) {
  console.log('allowance: none for this delegate')
} else {
  const resetsAt = new Date(Number(allowance.lastResetMin + allowance.resetTimeMin) * 60_000)
  console.log(`allowance: cap ${allowance.amount}, spent ${allowance.spent}`)
  console.log(
    `           resets every ${allowance.resetTimeMin} min, next ${resetsAt.toISOString()}`,
  )
}
