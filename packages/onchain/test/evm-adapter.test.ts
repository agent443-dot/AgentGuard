import { CHAINS } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  parseAbi,
  recoverTypedDataAddress,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { beforeEach, describe, expect, it } from 'vitest'
import { SigningRefused, type ChainAdapter } from '../src/ChainAdapter.js'
import { evmAdapter } from '../src/evm/adapter.js'
import { allowanceModuleAbi } from '../src/evm/safe.js'
import { base, hot, intent, merchant, module, safe, uint, usdc } from './evm-fixture.js'

const abis = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

let node: ReturnType<typeof base>['node']
let adapter: ChainAdapter

beforeEach(() => {
  ;({ node, adapter } = base())
})

describe('reads', () => {
  it("the hot wallet's ETH, and what four draws need at today's max fee per gas", async () => {
    node.handlers['eth_getBalance'] = ([address]) => {
      expect(address).toBe(hot)
      return '0x2386f26fc10000'
    }
    node.handlers['eth_getBlockByNumber'] = () => ({
      number: '0x10',
      baseFeePerGas: '0x3b9aca00',
      timestamp: '0x0',
    })
    node.handlers['eth_maxPriorityFeePerGas'] = () => '0x5f5e100'
    // viem's max fee: 1.2 × the 1 gwei base fee plus the 0.1 gwei tip, so 1.3 gwei per gas.
    expect(await adapter.getHotWalletGas!()).toEqual({
      balance: '10000000000000000',
      minimum: (1_300_000_000n * 250_000n * 4n).toString(),
      symbol: 'ETH',
    })
  })

  it('the hot wallet USDC balance', async () => {
    node.handlers['eth_call'] = () => uint(7_000_000n)
    expect(await adapter.getHotWalletBalance(usdc)).toBe('7000000')
  })

  const minute = 29_896_000n
  /** The module's two reads: getTokenAllowance, and the delegates list entry for a key. */
  function answers(allowance: [bigint, bigint, bigint, bigint, bigint], listed: Address) {
    node.handlers['eth_call'] = ([call]) => {
      const { functionName } = decodeFunctionData({
        abi: allowanceModuleAbi,
        data: (call as { data: Hex }).data,
      })
      return functionName === 'delegates'
        ? encodeAbiParameters(
            [{ type: 'address' }, { type: 'uint48' }, { type: 'uint48' }],
            [listed, 0, 0],
          )
        : encodeAbiParameters([{ type: 'uint256[5]' }], [allowance])
    }
  }

  it('the allowance, with its next reset', async () => {
    answers([100_000_000n, 30_000_000n, 1440n, minute, 3n], hot)
    expect(await adapter.getAllowanceState()).toEqual({
      status: 'active',
      cap: '100000000',
      spent: '30000000',
      resetsAt: new Date(Number(minute + 1440n) * 60_000).toISOString(),
      delegate: hot,
    })
  })

  it('none once the delegate is removed, as the kill leaves it', async () => {
    answers([0n, 0n, 0n, 0n, 3n], zeroAddress)
    expect(await adapter.getAllowanceState()).toEqual({ status: 'none', delegate: hot })
  })

  it('none when the delegate is listed but its allowance was deleted', async () => {
    answers([0n, 0n, 0n, 0n, 3n], hot)
    expect(await adapter.getAllowanceState()).toEqual({ status: 'none', delegate: hot })
  })

  it('none when an allowance is left but the delegate is no longer listed', async () => {
    answers([100_000_000n, 0n, 1440n, minute, 3n], zeroAddress)
    expect(await adapter.getAllowanceState()).toEqual({ status: 'none', delegate: hot })
  })

  it('throws, rather than saying none, when the read fails', async () => {
    node.handlers['eth_call'] = () => {
      throw new Error('rpc down')
    }
    await expect(adapter.getAllowanceState()).rejects.toThrow()
  })
})

describe('writes', () => {
  it('draws on the allowance as the delegate itself, paying no relayer', async () => {
    await adapter.topUpHotWallet('2000000')
    const [tx] = node.sent
    expect(tx?.to?.toLowerCase()).toBe(module.toLowerCase())
    const { functionName, args } = decodeFunctionData({ abi: abis, data: tx!.data as Hex })
    expect(functionName).toBe('executeAllowanceTransfer')
    expect(args).toEqual([safe, usdc, hot, 2_000_000n, zeroAddress, 0n, hot, '0x'])
  })

  /** The receipt log a USDC transfer emits. */
  const transferLog = (to: Address, value: bigint, token: Address = usdc) => ({
    address: token,
    topics: encodeEventTopics({ abi: abis, eventName: 'Transfer', args: { from: hot, to } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    blockNumber: '0x10',
    transactionHash: `0x${'00'.repeat(32)}`,
    transactionIndex: '0x0',
    blockHash: `0x${'00'.repeat(32)}`,
    logIndex: '0x0',
    removed: false,
  })

  it('sends a USDC transfer of the exact amount to the exact recipient', async () => {
    node.logs = [transferLog(merchant, 1_500_000n)]
    await adapter.send(intent())
    const [tx] = node.sent
    expect(tx?.to?.toLowerCase()).toBe(usdc.toLowerCase())
    expect(decodeFunctionData({ abi: abis, data: tx!.data as Hex }).args).toEqual([
      merchant,
      1_500_000n,
    ])
  })

  it.each([
    ['no Transfer event at all', []],
    ['a Transfer of another amount', [transferLog(merchant, 1_499_999n)]],
    ['a Transfer to someone else', [transferLog(hot, 1_500_000n)]],
    ['a Transfer of another token', [transferLog(merchant, 1_500_000n, merchant)]],
  ])('does not count a payment as made on %s', async (_case, logs) => {
    node.logs = logs
    await expect(adapter.send(intent())).rejects.toThrow('payment_unproven')
  })

  it('sends nothing for another chain or token', async () => {
    await expect(adapter.send(intent({ chain: CHAINS.base }))).rejects.toThrow('CHAIN_NOT_ALLOWED')
    await expect(adapter.send(intent({ token: merchant }))).rejects.toThrow('TOKEN_NOT_ALLOWED')
    expect(node.sent).toEqual([])
  })

  it('reports a reverted transaction', async () => {
    const receipt = node.handlers['eth_getTransactionReceipt']!
    node.handlers['eth_getTransactionReceipt'] = (params) => ({
      ...(receipt(params) as object),
      status: '0x0',
    })
    await expect(adapter.send(intent())).rejects.toThrow('transaction_failed')
  })
})

describe('buildKillTx', () => {
  it('is one Safe call removing the delegate and its allowances', async () => {
    const { payload } = await adapter.buildKillTx()
    const { to, data, operation } = payload as { to: Address; data: Hex; operation: number }
    expect(to).toBe(module)
    expect(operation).toBe(0)
    expect(decodeFunctionData({ abi: allowanceModuleAbi, data })).toEqual({
      functionName: 'removeDelegate',
      args: [hot, true],
    })
  })
})

describe('x402Scheme with the real @x402/evm client', () => {
  const requirements = (extra: Record<string, unknown> = {}): PaymentRequirements => ({
    scheme: 'exact',
    network: CHAINS.baseSepolia,
    asset: usdc,
    amount: '1500000',
    payTo: merchant,
    maxTimeoutSeconds: 60,
    extra: { name: 'USDC', version: '2', ...extra },
  })
  const x402 = intent({ kind: 'x402', domain: 'api.example.com' })

  it('signs the EIP-3009 authorization for the agreed payment', async () => {
    const realNow = BigInt(Math.floor(Date.now() / 1000))
    const live = evmAdapter({
      chain: CHAINS.baseSepolia,
      client: node.client,
      wallet: node.wallet,
      safe,
      usdc,
      module,
      now: () => realNow,
    })
    const { payload } = await live
      .x402Scheme(x402, requirements())
      .createPaymentPayload(2, requirements())
    const { authorization, signature } = payload as {
      authorization: Record<string, string>
      signature: Hex
    }
    const signer = await recoverTypedDataAddress({
      domain: { name: 'USDC', version: '2', chainId: 84532, verifyingContract: usdc },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: authorization['from'] as Address,
        to: authorization['to'] as Address,
        value: BigInt(authorization['value']!),
        validAfter: BigInt(authorization['validAfter']!),
        validBefore: BigInt(authorization['validBefore']!),
        nonce: authorization['nonce'] as Hex,
      },
      signature,
    })
    expect(signer).toBe(hot)
  })

  it('refuses the Permit2 path as a standing grant', async () => {
    const terms = requirements({ assetTransferMethod: 'permit2' })
    await expect(adapter.x402Scheme(x402, terms).createPaymentPayload(2, terms)).rejects.toEqual(
      new SigningRefused(['PERMIT_DETECTED']),
    )
  })

  it.each([
    ['another network', { network: CHAINS.base }],
    ['another asset', { asset: merchant }],
    ['another recipient', { payTo: safe }],
    ['another amount', { amount: '1500001' }],
  ])('refuses requirements naming %s', (_case, change) => {
    expect(() => adapter.x402Scheme(x402, { ...requirements(), ...change })).toThrow(
      new SigningRefused(['INVALID_402']),
    )
  })
})
