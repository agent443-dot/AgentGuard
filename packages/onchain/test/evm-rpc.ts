import {
  createPublicClient,
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
