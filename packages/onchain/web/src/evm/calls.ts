import {
  encodePacked,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { allowanceModuleAbi } from '../../../src/evm/safe.js'

export const safeAbi = parseAbi([
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
])

/**
 * The Safe's "approved by the sender" signature: r is the owner, s is zero, v is 1. The Safe takes
 * it only when msg.sender is that owner, so the owner's one Phantom transaction is the approval and
 * nothing is signed off-chain.
 */
export const preValidated = (owner: Address): Hex =>
  encodePacked(['uint256', 'uint256', 'uint8'], [BigInt(owner), 0n, 1])

/** execTransaction for a 1-of-1 Safe, sent by its owner: a plain call, no gas refund. */
export function execByOwner(owner: Address, to: Address, data: Hex): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'execTransaction',
    args: [to, 0n, data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, preValidated(owner)],
  })
}

/** The kill exactly as buildKillTx has it: the module forgets the hot wallet and its allowances. */
export const killData = (owner: Address, module: Address, hot: Address): Hex =>
  execByOwner(
    owner,
    module,
    encodeFunctionData({
      abi: allowanceModuleAbi,
      functionName: 'removeDelegate',
      args: [hot, true],
    }),
  )
