import {
  concat,
  encodePacked,
  size,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { allowanceCalls, allowanceModuleAbi, enableModuleCall } from '../../../src/evm/safe.js'

// Safe 1.4.1's canonical deployments (safe-global/safe-deployments). forge checks each one's code
// hash on Robinhood (RobinhoodProbe.t.sol, SigningPage.t.sol).
export const SAFE_L2 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762'
export const PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
export const FALLBACK_HANDLER = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
export const MULTI_SEND_CALL_ONLY = '0x9641d764fc13c8B624c04430C7356C1C7C8102e2'

export const safeAbi = parseAbi([
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function isModuleEnabled(address module) view returns (bool)',
  'function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
])

/**
 * The Safe's "approved by the sender" signature: r is the owner, s is zero, v is 1. The Safe takes
 * it only when msg.sender is that owner, so the owner's one Phantom transaction is the approval and
 * nothing is signed off-chain.
 */
export const preValidated = (owner: Address): Hex =>
  encodePacked(['uint256', 'uint256', 'uint8'], [BigInt(owner), 0n, 1])

const factoryAbi = parseAbi([
  'function createProxyWithNonce(address singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
])
const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable'])

/**
 * execTransaction for a 1-of-1 Safe, sent by its owner, with no gas refund. Operation 1 is a
 * delegatecall, used only into MultiSendCallOnly, which itself refuses delegatecalls.
 */
export function execByOwner(owner: Address, to: Address, data: Hex, operation: 0 | 1 = 0): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'execTransaction',
    args: [to, 0n, data, operation, 0n, 0n, 0n, zeroAddress, zeroAddress, preValidated(owner)],
  })
}

/** A Safe exactly as create-safe makes it: the owner alone, threshold 1, the 1.4.1 fallback handler. */
export function createData(owner: Address, saltNonce: bigint): Hex {
  const initializer = encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [[owner], 1n, zeroAddress, '0x', FALLBACK_HANDLER, zeroAddress, 0n, zeroAddress],
  })
  return encodeFunctionData({
    abi: factoryAbi,
    functionName: 'createProxyWithNonce',
    args: [SAFE_L2, initializer, saltNonce],
  })
}

/**
 * enable-allowance's three calls in one Safe transaction: the module (unless it is on already, as
 * after a kill), the hot wallet as its delegate, and the daily allowance in the dollar token.
 */
export function enableData(
  owner: Address,
  safe: Address,
  allowance: { module: Address; hot: Address; usd: Address; cap: bigint },
  moduleEnabled: boolean,
): Hex {
  const { module, hot, usd, cap } = allowance
  const calls = [
    ...(moduleEnabled ? [] : [enableModuleCall(safe, module)]),
    ...allowanceCalls(module, hot, usd, cap),
  ]
  const transactions = concat(
    calls.map(({ to, data }) =>
      encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [0, to, 0n, BigInt(size(data)), data],
      ),
    ),
  )
  const batch = encodeFunctionData({
    abi: multiSendAbi,
    functionName: 'multiSend',
    args: [transactions],
  })
  return execByOwner(owner, MULTI_SEND_CALL_ONLY, batch, 1)
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
