import { CHAINS, type PayIntent } from '@agentguard/shared'
import { encodeAbiParameters, getAddress, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { evmAdapter } from '../src/evm/adapter.js'
import { fakeNode } from './evm-rpc.js'

export const account = privateKeyToAccount(`0x${'11'.repeat(32)}`)
export const hot = account.address
export const safe: Address = getAddress('0x5afe000000000000000000000000000000005afe')
export const module: Address = '0xAA46724893dedD72658219405185Fb0Fc91e091C'
export const usdc: Address = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
export const merchant: Address = '0x2222222222222222222222222222222222222222'
export const now = 1_800_000_000n

export const uint = (value: bigint) => encodeAbiParameters([{ type: 'uint256' }], [value])

/** A Base Sepolia adapter for the hot wallet above, on a fresh fake node. */
export function base() {
  const node = fakeNode(account)
  const adapter = evmAdapter({
    chain: CHAINS.baseSepolia,
    client: node.client,
    wallet: node.wallet,
    safe,
    usdc,
    module,
    now: () => now,
  })
  return { node, adapter }
}

export const intent = (overrides: Partial<PayIntent> = {}): PayIntent => ({
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
