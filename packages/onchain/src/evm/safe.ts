import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem'
import { chainOf, type EvmConfig } from './config.js'

/** Safe's reset period, one day, as the Allowance Module counts it: minutes. */
export const RESET_TIME_MIN = 1440

const UINT96_MAX = 2n ** 96n - 1n

// From the module's source, safe-global/safe-modules, modules/allowances/contracts/AllowanceModule.sol.
export const allowanceModuleAbi = parseAbi([
  'function addDelegate(address delegate)',
  'function setAllowance(address delegate, address token, uint96 allowanceAmount, uint16 resetTimeMin, uint32 resetBaseMin)',
  'function deleteAllowance(address delegate, address token)',
  'function removeDelegate(address delegate, bool removeAllowances)',
  'function getTokenAllowance(address safe, address delegate, address token) view returns (uint256[5])',
])

const safeAbi = parseAbi(['function enableModule(address module)'])
const erc20Abi = parseAbi(['function decimals() view returns (uint8)'])

export function publicClient(config: EvmConfig): PublicClient {
  return createPublicClient({ chain: chainOf(config), transport: http(config.BASE_RPC_URL) })
}

/** An address from .env could be anything; an empty account is the cheapest thing to rule out. */
export async function requireCode(client: PublicClient, address: Address, label: string) {
  const code = await client.getCode({ address })
  if (!code || code === '0x') {
    throw new Error(`no contract at ${address} (${label}) on chain ${client.chain?.id}`)
  }
}

export async function requireDecimals(client: PublicClient, token: Address, decimals: number) {
  const actual = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  if (actual !== decimals) {
    throw new Error(`token ${token} has ${actual} decimals, expected ${decimals}`)
  }
}

export function requireCap(amount: bigint): bigint {
  if (amount <= 0n || amount > UINT96_MAX) {
    throw new Error(`cap must be between 1 and 2^96 - 1 atomic units, got ${amount}`)
  }
  return amount
}

export interface Call {
  to: Address
  value: string
  data: Hash
}

export function enableModuleCall(safe: Address, module: Address): Call {
  return {
    to: safe,
    value: '0',
    data: encodeFunctionData({ abi: safeAbi, functionName: 'enableModule', args: [module] }),
  }
}

export function allowanceCalls(
  module: Address,
  delegate: Address,
  token: Address,
  cap: bigint,
): Call[] {
  const call = (data: Hash): Call => ({ to: module, value: '0', data })
  return [
    call(
      encodeFunctionData({
        abi: allowanceModuleAbi,
        functionName: 'addDelegate',
        args: [delegate],
      }),
    ),
    // resetBaseMin 0: the day starts from the moment the allowance is set.
    call(
      encodeFunctionData({
        abi: allowanceModuleAbi,
        functionName: 'setAllowance',
        args: [delegate, token, cap, RESET_TIME_MIN, 0],
      }),
    ),
  ]
}

export interface AllowanceState {
  amount: bigint
  spent: bigint
  resetTimeMin: bigint
  lastResetMin: bigint
  nonce: bigint
}

export async function readAllowance(
  client: PublicClient,
  module: Address,
  safe: Address,
  delegate: Address,
  token: Address,
): Promise<AllowanceState> {
  const [amount, spent, resetTimeMin, lastResetMin, nonce] = await client.readContract({
    address: module,
    abi: allowanceModuleAbi,
    functionName: 'getTokenAllowance',
    args: [safe, delegate, token],
  })
  return { amount, spent, resetTimeMin, lastResetMin, nonce }
}
