import { CHAINS, type PayIntent } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import {
  decodeFunctionData,
  encodeAbiParameters,
  getAddress,
  parseAbi,
  recoverTypedDataAddress,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it } from 'vitest'
import { SigningRefused, type ChainAdapter } from '../src/ChainAdapter.js'
import { evmAdapter } from '../src/evm/adapter.js'
import { allowanceModuleAbi } from '../src/evm/safe.js'
import { fakeNode } from './evm-rpc.js'

const account = privateKeyToAccount(`0x${'11'.repeat(32)}`)
const hot = account.address
const safe: Address = getAddress('0x5afe000000000000000000000000000000005afe')
const module: Address = '0xAA46724893dedD72658219405185Fb0Fc91e091C'
const usdc: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const merchant: Address = '0x2222222222222222222222222222222222222222'
const now = 1_800_000_000n

const abis = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])
const uint = (value: bigint) => encodeAbiParameters([{ type: 'uint256' }], [value])

let node: ReturnType<typeof fakeNode>
let adapter: ChainAdapter

beforeEach(() => {
  node = fakeNode(account)
  adapter = evmAdapter({
    chain: CHAINS.baseSepolia,
    client: node.client,
    wallet: node.wallet,
    safe,
    usdc,
    module,
    now: () => now,
  })
})

const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  agentId: 'agent-1',
  kind: 'transfer',
  chain: CHAINS.baseSepolia,
  token: usdc,
  amount: '1500000',
  recipient: merchant,
  reason: 'test',
  status: 'approved',
  rejectReasons: [],
  createdAt: '2026-11-04T00:00:00.000Z',
  expiresAt: '2026-11-04T00:10:00.000Z',
  ...overrides,
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

describe('simulate', () => {
  function balances(
    hotBefore: bigint,
    toBefore: bigint,
    hotAfter: bigint,
    toAfter: bigint,
    ok = true,
  ) {
    const call = (returnData: Hex) => ({
      status: ok ? '0x1' : '0x0',
      returnData,
      gasUsed: '0x0',
      logs: [],
    })
    node.handlers['eth_simulateV1'] = () => [
      {
        number: '0x11',
        hash: `0x${'00'.repeat(32)}`,
        timestamp: '0x0',
        gasLimit: '0x0',
        gasUsed: '0x0',
        baseFeePerGas: '0x1',
        calls: [
          call(uint(hotBefore)),
          call(uint(toBefore)),
          call(uint(1n)),
          call(uint(hotAfter)),
          call(uint(toAfter)),
        ],
      },
    ]
  }

  it('passes a transfer that moves exactly the amount', async () => {
    balances(10_000_000n, 5n, 8_500_000n, 1_500_005n)
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual([])
    expect(outcome.simulation.balanceChanges).toEqual([{ token: usdc, delta: '-1500000' }])
  })

  it.each([
    ['the hot wallet losing more', [10_000_000n, 0n, 8_499_999n, 1_500_000n]],
    ['the recipient getting less', [10_000_000n, 0n, 8_500_000n, 1_499_999n]],
  ])('refuses %s', async (_case, [a, b, c, d]) => {
    balances(a!, b!, c!, d!)
    expect((await adapter.simulate(intent())).rejectReasons).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })

  it('fails a transfer the chain would revert', async () => {
    balances(0n, 0n, 0n, 0n, false)
    expect((await adapter.simulate(intent())).rejectReasons).toEqual(['SIM_FAILED'])
  })

  it.each([['0'], ['1.5'], ['-1']])('refuses the amount %j', async (amount) => {
    expect((await adapter.simulate(intent({ amount }))).rejectReasons).toEqual(['SIM_FAILED'])
  })

  it('refuses a recipient that is not an EVM address', async () => {
    const outcome = await adapter.simulate(
      intent({ recipient: '9BbWVUudkPut7n1bUbn5kYQCmzVmrk88xJJ9e3EPc12J' }),
    )
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
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
