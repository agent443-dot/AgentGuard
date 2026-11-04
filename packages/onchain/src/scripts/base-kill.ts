import { encodeFunctionData, getAddress } from 'viem'
import { contractAddress, loadEvmConfig } from '../evm/config.js'
import { Safe, safeSigners, signAndExecute } from '../evm/kit.js'
import { allowanceModuleAbi, publicClient, readAllowance } from '../evm/safe.js'

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

const before = await readAllowance(client, module, safeAddress, delegate, usdc)
console.log(`safe ${safeAddress}, delegate ${delegate}`)
console.log(`  cap ${before.amount}, spent ${before.spent}`)

// Removing the delegate takes the hot wallet's access to the Safe away entirely. Only
// enable-allowance undoes it, so it asks first.
if (!process.argv.includes('--yes')) {
  console.log()
  console.log('This removes the hot wallet access to the Safe. Re-run with --yes to do it.')
  process.exit(0)
}

const { owner, executorKey } = await safeSigners(config, console.log)
const kit = await Safe.init({ provider: config.BASE_RPC_URL, signer: executorKey, safeAddress })
// removeAllowances = true deletes the USDC allowance with the delegate, so one call does both.
const tx = await kit.createTransaction({
  transactions: [
    {
      to: module,
      value: '0',
      data: encodeFunctionData({
        abi: allowanceModuleAbi,
        functionName: 'removeDelegate',
        args: [delegate, true],
      }),
    },
  ],
})
const hash = await signAndExecute(kit, owner, tx)
const receipt = await client.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') {
  console.error(`safe transaction reverted: ${hash}`)
  process.exit(1)
}
const after = await readAllowance(client, module, safeAddress, delegate, usdc)
console.log(`removed. tx: ${hash}`)
console.log(`  cap ${after.amount}, spent ${after.spent}`)
