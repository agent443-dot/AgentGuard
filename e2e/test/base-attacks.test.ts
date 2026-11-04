import { StubChain } from '@agentguard/guard-core'
import { SigningRefused } from '@agentguard/onchain'
import type { PayIntent, RejectCode } from '@agentguard/shared'
import { CHAINS } from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE, offer, paidApi, SOLANA, type PaidApi } from './support/paid-api.js'
import { intentIdIn, stack, type Stack } from './support/stack.js'

// INT-6 on the Base Sepolia stub chain: the Solana attack suite again, with the EVM codes in place
// of the Solana ones. What the stub cannot prove, the fork tests in packages/onchain (EVM-6) and
// the owner's live run (HUMAN-12) do: the Allowance Module cap, and the real signing gate.

let s: Stack
let api: PaidApi

async function start(chain?: StubChain) {
  s = await stack({ net: BASE, ...(chain === undefined ? {} : { chain }) })
  api = await paidApi(BASE)
  await s.setPolicy()
}

afterEach(async () => {
  await api.close()
  await s.close()
})

function codes(text: string): string[] {
  return [...text.matchAll(/^- ([A-Z0-9_]+):/gm)].map((match) => match[1] ?? '')
}

async function refusedFetch(expected: RejectCode[], args: Record<string, unknown> = {}) {
  const text = await s.tool('paid_fetch', { url: api.url, ...args })
  expect(text).toContain(': rejected.')
  expect(codes(text)).toEqual(expected)
  expect(api.payments).toHaveLength(0)
  expect(s.chain.sent).toHaveLength(0)
  return text
}

const base = (overrides: Partial<PaymentRequirements> = {}) => offer(overrides, BASE)

describe('malicious 402 responses on Base (INT-6)', () => {
  beforeEach(() => start())

  it('pays an honest offer, and says it was Base', async () => {
    const text = await s.tool('paid_fetch', { url: api.url, maxAmountUsd: '1' })
    expect(text).toContain(': executed.')
    expect(api.payments).toHaveLength(1)
    await vi.waitFor(() =>
      expect(s.telegram.messages.map((m) => m.text).join('\n')).toContain('Base Sepolia'),
    )
  })

  it('asking for the whole wallet balance', async () => {
    api.quote = [base({ amount: '100000000' })]
    await refusedFetch(['PER_TX_EXCEEDED'])
  })

  it('in a token the policy does not allow', async () => {
    api.quote = [base({ asset: '0x4200000000000000000000000000000000000006' })]
    await refusedFetch(['TOKEN_NOT_ALLOWED'])
  })

  it('on Base mainnet while only Base Sepolia is allowed', async () => {
    api.quote = [base({ network: CHAINS.base })]
    await refusedFetch(['CHAIN_NOT_ALLOWED'])
  })

  it('on Solana, to an agent allowed only on Base', async () => {
    api.quote = [offer({}, SOLANA)]
    await refusedFetch(['CHAIN_NOT_ALLOWED', 'TOKEN_NOT_ALLOWED'])
  })

  it('in a scheme the guard does not speak', async () => {
    api.quote = [base({ scheme: 'upto' })]
    await refusedFetch(['INVALID_402'])
  })

  it('moving payTo between the quote and the retry', async () => {
    api.requote = [base({ payTo: BASE.attacker })]
    const text = await s.tool('paid_fetch', { url: api.url })
    expect(codes(text)).toEqual(['INVALID_402'])
    expect(api.payments).toHaveLength(1)
    expect(api.payments[0]?.accepted.payTo).toBe(BASE.merchant)
  })

  it('from a host the policy does not allow', async () => {
    await s.setPolicy({ allowedDomains: ['api.example.com'] })
    await refusedFetch(['DOMAIN_NOT_ALLOWED'])
    expect(api.requests).toBe(0)
  })
})

describe('attacks the Base adapter catches (INT-6)', () => {
  // The EVM adapter's own codes. Detection is proven in packages/onchain (evm-gate and evm-adapter
  // tests, and the fork tests); this proves the codes stop the payment and reach the owner.
  class Hostile extends StubChain {
    constructor(private readonly found: RejectCode[]) {
      super(BASE.chain, 100_000_000n)
    }
    override async simulate(intent: PayIntent) {
      const outcome = await super.simulate(intent)
      return { ...outcome, rejectReasons: this.found }
    }
  }

  for (const code of ['APPROVAL_DETECTED', 'PERMIT_DETECTED', 'DELEGATION_DETECTED'] as const) {
    it(`${code} stops the payment and alerts the owner`, async () => {
      await start(new Hostile([code]))
      await refusedFetch([code], { maxAmountUsd: '1' })
      await vi.waitFor(() =>
        expect(s.telegram.messages.map((m) => m.text).join('\n')).toContain(
          'Possible attack blocked',
        ),
      )
    })
  }

  it('a Permit handed to the signer instead of a transfer authorization', async () => {
    // What the real Base signer does when the x402 SDK asks it to sign anything but
    // TransferWithAuthorization: it refuses, and the guard must record that, not pay.
    class PermitSigner extends StubChain {
      override x402Scheme(): SchemeNetworkClient {
        return {
          scheme: 'exact',
          createPaymentPayload: async () => {
            throw new SigningRefused(['PERMIT_DETECTED'])
          },
        }
      }
    }
    await start(new PermitSigner(BASE.chain, 100_000_000n))
    await refusedFetch(['PERMIT_DETECTED'], { maxAmountUsd: '1' })
  })

  it('a simulation showing the wallet losing more than the payment', async () => {
    class Drainer extends StubChain {
      override async simulate(intent: PayIntent) {
        const outcome = await super.simulate(intent)
        const drained = [{ token: intent.token, delta: '-100000000' }]
        return { ...outcome, simulation: { ...outcome.simulation, balanceChanges: drained } }
      }
    }
    await start(new Drainer(BASE.chain, 100_000_000n))
    await refusedFetch(['SIM_UNEXPECTED_EFFECT'], { maxAmountUsd: '1' })
  })
})

describe('the owner channel on Base (INT-6)', () => {
  beforeEach(() => start())

  it('asks the owner above the threshold, and redeems the approval once', async () => {
    api.quote = [base({ amount: '3000000' })]
    const id = intentIdIn(await s.tool('paid_fetch', { url: api.url }))
    await vi.waitFor(() => expect(s.telegram.approvalFor(id)?.text).toContain('Base Sepolia'))
    await s.telegram.press(id, 'approve')
    expect(s.telegram.lastAnswer()).toBe('Approved')
    expect(await s.tool('paid_fetch', { url: api.url })).toContain(': executed.')
    expect(await s.tool('paid_fetch', { url: api.url })).toContain(': pending_approval.')
    expect(api.payments).toHaveLength(1)
  })

  it('kill pauses the agent and hands over the Base owner transaction', async () => {
    await s.telegram.command('/kill')
    await s.telegram.tap('kill:confirm')
    await vi.waitFor(() =>
      expect(s.telegram.messages.map((m) => m.text).join('\n')).toContain(
        `stub: remove the spend limit on ${BASE.chain}`,
      ),
    )
    expect(codes(await s.tool('paid_fetch', { url: api.url, maxAmountUsd: '1' }))).toEqual([
      'PAUSED',
    ])
  })
})
