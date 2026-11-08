import { CHAINS, getAddress as sharedAddress, type PayIntent } from '@agentguard/shared'
import type { PaymentRequirements } from '@x402/core/types'
import { getAddress, recoverTypedDataAddress, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { SigningRefused } from '../src/ChainAdapter.js'
import { evmAdapter } from '../src/evm/adapter.js'
import { chainOf } from '../src/evm/config.js'
import { loadRobinhoodConfig } from '../src/evm/robinhood.js'
import { account, merchant, safe } from './evm-fixture.js'
import { fakeNode } from './evm-rpc.js'

const usdg = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'usd')!)
const module = getAddress(sharedAddress(CHAINS.robinhoodTestnet, 'allowanceModule')!)
const hot = account.address

const fields = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const

const intent: PayIntent = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  agentId: 'agent-1',
  kind: 'x402',
  chain: CHAINS.robinhoodTestnet,
  token: usdg,
  amount: '1500000',
  recipient: merchant,
  reason: 'test',
  domain: 'api.example.com',
  status: 'approved',
  rejectReasons: [],
  createdAt: '2026-11-08T00:00:00.000Z',
  expiresAt: '2026-11-08T00:10:00.000Z',
}

const requirements = (extra: Record<string, unknown> = {}): PaymentRequirements => ({
  scheme: 'exact',
  network: CHAINS.robinhoodTestnet,
  asset: usdg,
  amount: '1500000',
  payTo: merchant,
  maxTimeoutSeconds: 60,
  extra: { name: 'Global Dollar', version: '1', ...extra },
})

function adapter() {
  const node = fakeNode(account)
  return evmAdapter({
    chain: CHAINS.robinhoodTestnet,
    client: node.client,
    wallet: node.wallet,
    safe,
    usdc: usdg,
    module,
    now: () => BigInt(Math.floor(Date.now() / 1000)),
  })
}

describe('Robinhood Chain testnet with the real @x402/evm client', () => {
  it("signs USDG's EIP-3009 authorization over its own domain, (Global Dollar, 1)", async () => {
    const { payload } = await adapter()
      .x402Scheme(intent, requirements())
      .createPaymentPayload(2, requirements())
    const { authorization, signature } = payload as {
      authorization: Record<string, string>
      signature: Hex
    }
    const signer = await recoverTypedDataAddress({
      domain: { name: 'Global Dollar', version: '1', chainId: 46630, verifyingContract: usdg },
      types: { TransferWithAuthorization: fields },
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

  it.each([
    ['USDC', { name: 'USDC', version: '2' }],
    ['the right name at another version', { version: '2' }],
  ])('refuses a server that names another domain: %s', async (_case, extra) => {
    const terms = requirements(extra)
    await expect(
      adapter().x402Scheme(intent, terms).createPaymentPayload(2, terms),
    ).rejects.toEqual(new SigningRefused(['SIM_UNEXPECTED_EFFECT']))
  })

  it('knows the chain', () => {
    expect(chainOf('46630').id).toBe(46630)
    expect(chainOf('4663').id).toBe(4663)
  })
})

describe('loadRobinhoodConfig', () => {
  const env = {
    ROBINHOOD_RPC_URL: 'https://rpc.testnet.chain.robinhood.com',
    ROBINHOOD_SAFE_ADDRESS: safe,
    ROBINHOOD_HOT_WALLET_ADDRESS: hot,
  }

  it('takes USDG and the module from shared, with testnet by default', () => {
    expect(loadRobinhoodConfig(env)).toMatchObject({
      chain: CHAINS.robinhoodTestnet,
      chainId: '46630',
      usdg,
      module,
    })
  })

  it('takes mainnet when named, with its own USDG', () => {
    const config = loadRobinhoodConfig({ ...env, ROBINHOOD_CHAIN: CHAINS.robinhood })
    expect(config.chainId).toBe('4663')
    expect(config.usdg).toBe(getAddress(sharedAddress(CHAINS.robinhood, 'usd')!))
  })

  it('refuses any other chain, and names the bad fields only', () => {
    expect(() => loadRobinhoodConfig({ ...env, ROBINHOOD_CHAIN: CHAINS.base })).toThrow(
      'invalid robinhood configuration: ROBINHOOD_CHAIN',
    )
    expect(() => loadRobinhoodConfig({ ...env, ROBINHOOD_SAFE_ADDRESS: 'nope' })).toThrow(
      'ROBINHOOD_SAFE_ADDRESS',
    )
  })
})
