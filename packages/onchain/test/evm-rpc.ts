import {
  createPublicClient,
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  getAddress,
  parseAbi,
  type Address,
  createWalletClient,
  custom,
  keccak256,
  parseTransaction,
  type Account,
  type Hex,
  type PublicClient,
  type TransactionSerialized,
  type WalletClient,
} from 'viem'
import { baseSepolia } from 'viem/chains'

type Handler = (params: unknown[]) => unknown

export interface FakeNode {
  client: PublicClient
  wallet: WalletClient & { account: Account }
  sent: ReturnType<typeof parseTransaction>[]
  handlers: Record<string, Handler>
}

/**
 * Just enough of a Base node for the adapter: viem signs locally with the hot wallet's account and
 * this answers the calls around it, records every raw transaction, and lets a test choose what
 * eth_call and eth_simulateV1 return.
 */
export function fakeNode(account: Account): FakeNode {
  const sent: ReturnType<typeof parseTransaction>[] = []
  const handlers: Record<string, Handler> = {
    eth_chainId: () => `0x${baseSepolia.id.toString(16)}`,
    eth_getTransactionCount: () => '0x0',
    eth_estimateGas: () => '0x5208',
    eth_maxPriorityFeePerGas: () => '0x1',
    eth_gasPrice: () => '0x1',
    eth_blockNumber: () => '0x10',
    eth_getBlockByNumber: () => ({ number: '0x10', baseFeePerGas: '0x1', timestamp: '0x0' }),
    eth_sendRawTransaction: ([raw]) => {
      sent.push(parseTransaction(raw as TransactionSerialized))
      return keccak256(raw as Hex)
    },
    eth_getTransactionReceipt: ([hash]) => ({
      transactionHash: hash,
      status: '0x1',
      blockNumber: '0x10',
      blockHash: `0x${'00'.repeat(32)}`,
      logs: [],
      cumulativeGasUsed: '0x0',
      gasUsed: '0x0',
      effectiveGasPrice: '0x1',
      type: '0x2',
      from: account.address,
      to: null,
      transactionIndex: '0x0',
      logsBloom: `0x${'00'.repeat(256)}`,
    }),
  }
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      const handler = handlers[method]
      if (!handler) {
        throw new Error(`fake node: ${method} not handled`)
      }
      return handler((params as unknown[] | undefined) ?? [])
    },
  })
  const client = createPublicClient({ chain: baseSepolia, transport }) as PublicClient
  const wallet = createWalletClient({ account, chain: baseSepolia, transport }) as WalletClient & {
    account: Account
  }
  return { client, wallet, sent, handlers }
}

const tokenAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

export interface Ledger {
  usdc: Address
  module: Address
  safe: Address
  /** USDC balances by address; anyone missing holds nothing. */
  balances: Map<Address, bigint>
  /** What the delegate may still draw from the Safe today. */
  allowanceLeft: bigint
}

/**
 * USDC and the Allowance Module as eth_call and eth_simulateV1 see them: balances move, a transfer
 * beyond the balance reverts as the token would, and a draw beyond the allowance reverts with the
 * module's own message. Simulated blocks work on a copy, so they never change the ledger.
 */
export function serveLedger(node: FakeNode, ledger: Ledger) {
  const balanceOf = (balances: Map<Address, bigint>, owner: Address) =>
    balances.get(getAddress(owner)) ?? 0n
  const move = (balances: Map<Address, bigint>, from: Address, to: Address, amount: bigint) => {
    balances.set(getAddress(from), balanceOf(balances, from) - amount)
    balances.set(getAddress(to), balanceOf(balances, to) + amount)
  }
  const revert = (message: string) => ({
    status: '0x0',
    returnData: '0x',
    error: {
      code: 3,
      message,
      data: encodeErrorResult({ abi: errorAbi, errorName: 'Error', args: [message] }),
    },
  })

  function execute(
    state: { balances: Map<Address, bigint>; allowanceLeft: bigint },
    call: { from?: Address; to: Address; data: Hex },
  ) {
    const { functionName, args } = decodeFunctionData({ abi: tokenAbi, data: call.data })
    if (functionName === 'balanceOf') {
      return { status: '0x1', returnData: uint(balanceOf(state.balances, args[0])) }
    }
    if (functionName === 'transfer') {
      if (getAddress(call.to) !== ledger.usdc) {
        return revert('not the token')
      }
      const [to, amount] = args
      if (balanceOf(state.balances, call.from!) < amount) {
        return revert('ERC20: transfer amount exceeds balance')
      }
      move(state.balances, call.from!, to, amount)
      return { status: '0x1', returnData: uint(1n) }
    }
    const [safe, , to, amount] = args
    if (getAddress(call.to) !== ledger.module || amount > state.allowanceLeft) {
      return revert('newSpent > allowance.amount')
    }
    state.allowanceLeft -= amount
    move(state.balances, safe, to, amount)
    return { status: '0x1', returnData: '0x' }
  }

  node.handlers['eth_call'] = ([call]) =>
    execute(
      { balances: new Map(ledger.balances), allowanceLeft: ledger.allowanceLeft },
      call as never,
    ).returnData
  node.handlers['eth_simulateV1'] = ([request]) => {
    const { blockStateCalls } = request as { blockStateCalls: { calls: never[] }[] }
    const state = { balances: new Map(ledger.balances), allowanceLeft: ledger.allowanceLeft }
    return blockStateCalls.map(({ calls }) => ({
      number: '0x11',
      hash: `0x${'00'.repeat(32)}`,
      timestamp: '0x0',
      gasLimit: '0x0',
      gasUsed: '0x0',
      baseFeePerGas: '0x1',
      calls: calls.map((call) => ({ gasUsed: '0x0', logs: [], ...execute(state, call) })),
    }))
  }
}

const errorAbi = parseAbi(['error Error(string)'])
const uint = (value: bigint) => encodeAbiParameters([{ type: 'uint256' }], [value])
