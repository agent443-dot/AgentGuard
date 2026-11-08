import { CHAINS } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import {
  decodeFunctionData,
  encodeAbiParameters,
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
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

let node: ReturnType<typeof base>['node']
let adapter: ChainAdapter

beforeEach(() => {
  ;({ node, adapter } = base())
})

describe('reads', () => {
  it('the hot wallet USDC balance', async () => {
    node.handlers['eth_call'] = () => uint(7_000_000n)
    expect(await adapter.getHotWalletBalance(usdc)).toBe('7000000')
  })

  it('the allowance, with its next reset', async () => {
    const minute = 29_896_000n
    node.handlers['eth_call'] = () =>
      encodeAbiParameters(
        [{ type: 'uint256[5]' }],
        [[100_000_000n, 30_000_000n, 1440n, minute, 3n]],
      )
    expect(await adapter.getAllowanceState()).toEqual({
      status: 'active',
      cap: '100000000',
      spent: '30000000',
      resetsAt: new Date(Number(minute + 1440n) * 60_000).toISOString(),
      delegate: hot,
    })
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

  it('sends a USDC transfer of the exact amount to the exact recipient', async () => {
    await adapter.send(intent())
    const [tx] = node.sent
    expect(tx?.to?.toLowerCase()).toBe(usdc.toLowerCase())
    expect(decodeFunctionData({ abi: abis, data: tx!.data as Hex }).args).toEqual([
      merchant,
      1_500_000n,
    ])
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
