import { USDC_DECIMALS } from '@agentguard/shared'
import { Safe } from '../evm/kit.js'
import { getAddress, type Hash } from 'viem'
import { contractAddress, loadEvmConfig } from '../evm/config.js'
import {
  allowanceCalls,
  enableModuleCall,
  publicClient,
  readAllowance,
  requireCap,
  requireCode,
  requireDecimals,
} from '../evm/safe.js'

const config = loadEvmConfig()
if (!config.SAFE_ADDRESS) {
  console.error('SAFE_ADDRESS is not set. Run create-safe first.')
  process.exit(1)
}

const client = publicClient(config)
const safeAddress = getAddress(config.SAFE_ADDRESS)
const delegate = getAddress(config.HOT_WALLET_ADDRESS)
const cap = requireCap(BigInt(config.DAILY_CAP))
const module = contractAddress(config, 'allowanceModule')
const usdc = contractAddress(config, 'usdc')

console.log(`safe:     ${safeAddress}`)
console.log(`module:   ${module.address} (from ${module.source})`)
console.log(`usdc:     ${usdc.address} (from ${usdc.source})`)
console.log(`delegate: ${delegate}`)
console.log(`cap:      ${cap} atomic units per day`)

await requireCode(client, module.address, 'Allowance Module')
await requireCode(client, usdc.address, 'USDC')
await requireDecimals(client, usdc.address, USDC_DECIMALS)

const kit = await Safe.init({
  provider: config.BASE_RPC_URL,
  signer: config.OWNER_PRIVATE_KEY,
  safeAddress,
})
const enabled = await kit.isModuleEnabled(module.address)

// One Safe transaction: enable the module if needed, add the hot wallet as delegate, set the cap.
// Either all of it lands or none of it does.
const transactions = [
  ...(enabled ? [] : [enableModuleCall(safeAddress, module.address)]),
  ...allowanceCalls(module.address, delegate, usdc.address, cap),
]
const tx = await kit.createTransaction({ transactions })
const result = await kit.executeTransaction(tx)
const receipt = await client.waitForTransactionReceipt({ hash: result.hash as Hash })
if (receipt.status !== 'success') {
  console.error(`safe transaction reverted: ${result.hash}`)
  process.exit(1)
}

const state = await readAllowance(client, module.address, safeAddress, delegate, usdc.address)
console.log()
console.log(`tx: ${result.hash}`)
console.log(`module enabled: ${await kit.isModuleEnabled(module.address)}`)
console.log(
  `allowance: ${state.amount}, spent ${state.spent}, resets every ${state.resetTimeMin} min`,
)
