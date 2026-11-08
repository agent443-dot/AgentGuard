import type { Address } from 'viem'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChainAdapter } from '../src/ChainAdapter.js'
import { base, hot, intent, merchant, module, safe, uint, usdc } from './evm-fixture.js'
import { serveLedger, type Ledger } from './evm-rpc.js'

let node: ReturnType<typeof base>['node']
let adapter: ChainAdapter

beforeEach(() => {
  ;({ node, adapter } = base())
})

describe('simulate', () => {
  let ledger: Ledger
  const holding = (owner: Address) => ledger.balances.get(owner) ?? 0n

  beforeEach(() => {
    ledger = {
      usdc,
      module,
      safe,
      balances: new Map([
        [safe, 100_000_000n],
        [hot, 10_000_000n],
      ]),
      allowanceLeft: 100_000_000n,
    }
    serveLedger(node, ledger)
  })

  it('passes a transfer that moves exactly the amount', async () => {
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual([])
    expect(outcome.simulation.summary).toBe(`pays 1.5 USDC from ${hot} to ${merchant}`)
    expect(outcome.simulation.balanceChanges).toEqual([{ token: usdc, delta: '-1500000' }])
  })

  it('tops an empty hot wallet up from the Safe in the same simulated block', async () => {
    ledger.balances.set(hot, 0n)
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual([])
    expect(outcome.simulation.summary).toBe(
      `draws 1.5 USDC from Safe ${safe}, then pays 1.5 USDC from ${hot} to ${merchant}`,
    )
    // Simulated only: guard-core tops up for real once this has cleared.
    expect([holding(safe), holding(hot), holding(merchant)]).toEqual([100_000_000n, 0n, 0n])
    expect(node.sent).toEqual([])
  })

  it('draws only the shortfall when the hot wallet holds part of the amount', async () => {
    ledger.balances.set(hot, 1_000_000n)
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual([])
    expect(outcome.simulation.summary).toMatch(/^draws 0\.5 USDC from Safe/)
  })

  it('fails, saying so, when the allowance cannot cover the shortfall', async () => {
    ledger.balances.set(hot, 0n)
    ledger.allowanceLeft = 1_499_999n
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
    expect(outcome.simulation.summary).toBe(
      'simulation failed: the top-up of 1.5 USDC from the Safe reverted: ' +
        'newSpent > allowance.amount (the allowance cannot cover it)',
    )
  })

  it('says in words when the token issuer has frozen an address in the payment', async () => {
    ledger.frozen = [merchant]
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
    expect(outcome.simulation.summary).toBe(
      'simulation failed: the transfer of 1.5 USDC reverted: the token issuer has frozen an ' +
        'address in this payment (AddressFrozen)',
    )
  })

  it('names the reverted call and its revert string', async () => {
    ledger.usdc = merchant
    const outcome = await adapter.simulate(intent())
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
    expect(outcome.simulation.summary).toBe(
      'simulation failed: the transfer of 1.5 USDC reverted: not the token',
    )
  })

  it('refuses a transfer whose balances do not move as agreed', async () => {
    node.handlers['eth_simulateV1'] = () => [
      {
        number: '0x11',
        hash: `0x${'00'.repeat(32)}`,
        timestamp: '0x0',
        gasLimit: '0x0',
        gasUsed: '0x0',
        baseFeePerGas: '0x1',
        // The hot wallet loses one unit more than it pays.
        calls: [100n, 10_000_000n, 0n, 1n, 100n, 8_499_999n, 1_500_000n].map((value) => ({
          status: '0x1',
          returnData: uint(value),
          gasUsed: '0x0',
          logs: [],
        })),
      },
    ]
    expect((await adapter.simulate(intent())).rejectReasons).toEqual(['SIM_UNEXPECTED_EFFECT'])
  })

  it.each([['0'], ['1.5'], ['-1']])('refuses the amount %j, saying why', async (amount) => {
    const outcome = await adapter.simulate(intent({ amount }))
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
    expect(outcome.simulation.summary).toContain(`the amount ${amount} is not a positive integer`)
  })

  it('refuses a recipient that is not an EVM address', async () => {
    const outcome = await adapter.simulate(
      intent({ recipient: '9BbWVUudkPut7n1bUbn5kYQCmzVmrk88xJJ9e3EPc12J' }),
    )
    expect(outcome.rejectReasons).toEqual(['SIM_FAILED'])
    expect(outcome.simulation.summary).toContain('is not an EVM address')
  })
})
