import { USDC_DECIMALS } from '@agentguard/shared'
import {
  decodeErrorResult,
  encodeFunctionData,
  parseAbi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import type { SimulationOutcome } from '../ChainAdapter.js'
import { formatUnits } from '../svm/transfer.js'
import { TOKEN_ERRORS, tokenErrorsAbi } from './tokens.js'

export const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])
export const executeAbi = parseAbi([
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

export interface Accounts {
  /** The token's symbol for the summary: USDC on Base, USDG on Robinhood Chain. */
  symbol: string
  safe: Address
  hot: Address
  usdc: Address
  module: Address
}

/** The module call that moves `amount` from the Safe to the hot wallet, sent by the hot wallet. */
export function topUpData(accounts: Omit<Accounts, 'symbol'>, amount: bigint): Hex {
  const { safe, usdc, hot } = accounts
  // An empty signature makes the module authenticate the delegate as the caller.
  return encodeFunctionData({
    abi: executeAbi,
    functionName: 'executeAllowanceTransfer',
    args: [safe, usdc, hot, amount, zeroAddress, 0n, hot, '0x'],
  })
}

/**
 * The payment as guard-core will make it: guard-core tops the hot wallet up from the Safe only after
 * this clears, so a hot wallet short of the amount is topped up first here too, in the same
 * simulated block. Nothing moves before the simulation has passed.
 */
export async function simulatePayment(
  client: PublicClient,
  accounts: Accounts,
  to: Address,
  amount: bigint,
): Promise<SimulationOutcome> {
  const { safe, hot, usdc, module } = accounts
  const balanceOf = (owner: Address) =>
    ({ to: usdc, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }) as const
  const held = await client.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [hot],
  })
  const shortfall = held < amount ? amount - held : 0n

  const usd = (value: bigint) => `${formatUnits(value, USDC_DECIMALS)} ${accounts.symbol}`
  const paying = `pays ${usd(amount)} from ${hot} to ${to}`
  const summary = shortfall ? `draws ${usd(shortfall)} from Safe ${safe}, then ${paying}` : paying
  const simulation = {
    summary,
    balanceChanges: [{ token: usdc, delta: (-amount).toString() }],
  }

  const watched = [balanceOf(safe), balanceOf(hot), balanceOf(to)]
  const topUp = { account: hot, to: module, data: topUpData(accounts, shortfall) }
  const transfer = {
    account: hot,
    to: usdc,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }),
  }
  const moves = shortfall ? [topUp, transfer] : [transfer]
  const labels = [
    ...watched.map(() => 'balanceOf'),
    ...(shortfall ? [`the top-up of ${usd(shortfall)} from the Safe`] : []),
    `the transfer of ${usd(amount)}`,
    ...watched.map(() => 'balanceOf'),
  ]
  // One simulated block, so the balances before and after are read against the same state.
  const [block] = await client.simulateBlocks({
    blocks: [{ calls: [...watched, ...moves, ...watched] }],
  })
  const results = block?.calls ?? []
  const failed = results.findIndex((call) => call.status !== 'success')
  if (results.length !== labels.length || failed >= 0) {
    const call = results[failed]
    return {
      simulation: { ...simulation, summary: failure(labels[failed], call?.data, shortfall > 0) },
      rejectReasons: ['SIM_FAILED'],
    }
  }

  const values = results.map((call) => (typeof call.result === 'bigint' ? call.result : -1n))
  const [safeBefore, hotBefore, toBefore] = values
  const [safeAfter, hotAfter, toAfter] = values.slice(-3)
  const exact =
    safeBefore !== undefined &&
    safeAfter === safeBefore - shortfall &&
    hotBefore !== undefined &&
    hotAfter === hotBefore + shortfall - amount &&
    toBefore !== undefined &&
    toAfter === toBefore + amount
  return { simulation, rejectReasons: exact ? [] : ['SIM_UNEXPECTED_EFFECT'] }
}

function failure(label: string | undefined, data: Hex | undefined, toppingUp: boolean): string {
  if (!label) {
    return 'simulation failed: the node returned an incomplete block'
  }
  const reverted = `simulation failed: ${label} reverted${data && data !== '0x' ? `: ${revert(data)}` : ''}`
  return toppingUp && label.startsWith('the top-up')
    ? `${reverted} (the allowance cannot cover it)`
    : reverted
}

/** A revert string when the data is one, else the raw data. */
function revert(data: Hex): string {
  try {
    const { errorName, args } = decodeErrorResult({ abi: tokenErrorsAbi, data })
    if (errorName === 'Error' && typeof args[0] === 'string') {
      return args[0]
    }
    return TOKEN_ERRORS[errorName] ?? errorName
  } catch {
    return data
  }
}
