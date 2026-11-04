import { randomBytes } from 'node:crypto'
import { Safe } from '../evm/kit.js'
import { createWalletClient, getAddress, http, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { caip2, chainOf, loadEvmConfig } from '../evm/config.js'
import { publicClient } from '../evm/safe.js'

const config = loadEvmConfig()

// A second Safe would leave two places the money might be. Refuse rather than let a repeated
// command decide that silently.
if (config.SAFE_ADDRESS) {
  console.error(`A Safe is already configured: ${config.SAFE_ADDRESS}`)
  console.error('Clear SAFE_ADDRESS in .env first if you really want a new one.')
  process.exit(1)
}

const owner = privateKeyToAccount(config.OWNER_PRIVATE_KEY as Hash)
const client = publicClient(config)

console.log(`chain: ${caip2(config)}`)
console.log(`owner: ${owner.address}`)

const kit = await Safe.init({
  provider: config.BASE_RPC_URL,
  signer: config.OWNER_PRIVATE_KEY,
  predictedSafe: {
    safeAccountConfig: { owners: [owner.address], threshold: 1 },
    // Random, so a Safe created after clearing SAFE_ADDRESS does not collide with the last one.
    safeDeploymentConfig: { saltNonce: BigInt(`0x${randomBytes(16).toString('hex')}`).toString() },
  },
})
const safeAddress = getAddress(await kit.getAddress())
const deployment = await kit.createSafeDeploymentTransaction()

const wallet = createWalletClient({
  account: owner,
  chain: chainOf(config),
  transport: http(config.BASE_RPC_URL),
})
const hash = await wallet.sendTransaction({
  to: getAddress(deployment.to),
  data: deployment.data as Hash,
  value: BigInt(deployment.value),
})
const receipt = await client.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') {
  console.error(`deployment reverted: ${hash}`)
  process.exit(1)
}

// Read back from the chain rather than trusting the prediction.
const safe = await kit.connect({ safeAddress })
const [owners, threshold] = await Promise.all([safe.getOwners(), safe.getThreshold()])

console.log()
console.log(`safe:      ${safeAddress}`)
console.log(`owners:    ${owners.join(', ')}`)
console.log(`threshold: ${threshold}`)
console.log(`tx:        ${hash}`)
console.log()
console.log('Add to packages/onchain/.env and packages/guard-core/.env:')
console.log(`SAFE_ADDRESS=${safeAddress}`)
