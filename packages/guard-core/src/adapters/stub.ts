import type { ChainAdapter, KillTx, SimulationOutcome } from '@agentguard/onchain'
import type { AllowanceState, Amount, ChainId, PayIntent } from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'

/**
 * An offline chain for tests and for `pnpm dev` before the real adapters land. It moves no money:
 * it keeps a balance in memory and records what it was asked to do.
 */
export class StubChain implements ChainAdapter {
  balance: bigint
  readonly sent: PayIntent[] = []
  readonly topUps: Amount[] = []

  constructor(
    readonly chain: ChainId,
    balance = 0n,
  ) {
    this.balance = balance
  }

  async getAllowanceState(): Promise<AllowanceState> {
    return {
      status: 'active',
      cap: '100000000',
      spent: '0',
      resetsAt: '1970-01-01T00:00:00.000Z',
      delegate: 'stub',
    }
  }

  async getHotWalletBalance(): Promise<Amount> {
    return this.balance.toString()
  }

  /** Offline there is no gas to run out of, so the stub always has enough. */
  async getHotWalletGas(): Promise<{ balance: Amount; minimum: Amount; symbol: string }> {
    return { balance: '0', minimum: '0', symbol: 'TEST' }
  }

  async topUpHotWallet(amount: Amount): Promise<string> {
    this.topUps.push(amount)
    this.balance += BigInt(amount)
    return `stub-topup-${this.topUps.length}`
  }

  async simulate(intent: PayIntent): Promise<SimulationOutcome> {
    return {
      simulation: {
        summary: `sends ${intent.amount} of ${intent.token} to ${intent.recipient}`,
        balanceChanges: [{ token: intent.token, delta: `-${intent.amount}` }],
      },
      rejectReasons: [],
    }
  }

  async send(intent: PayIntent): Promise<string> {
    this.sent.push(intent)
    this.balance -= BigInt(intent.amount)
    return `stub-tx-${this.sent.length}`
  }

  /** Signs nothing: the payload only names the intent, which is enough for a stub server. */
  x402Scheme(intent: PayIntent, _requirements: PaymentRequirements): SchemeNetworkClient {
    return {
      scheme: 'exact',
      createPaymentPayload: async (x402Version) => ({
        x402Version,
        payload: { stub: true, intentId: intent.id },
      }),
    }
  }

  async buildKillTx(): Promise<KillTx> {
    return { description: `stub: remove the spend limit on ${this.chain}`, payload: {} }
  }
}
