import type {
  Address,
  AllowanceState,
  Amount,
  ChainId,
  HotWalletGas,
  PayIntent,
  RejectCode,
  SimulationResult,
  TxId,
} from '@agentguard/shared'
import type { PaymentRequirements, SchemeNetworkClient } from '@x402/core/types'

/** The transaction only the owner can sign: it zeroes the spend limit and removes the delegate. */
export interface KillTx {
  /** Shown to the owner on Telegram before they sign. */
  description: string
  /** Chain-specific: a Safe transaction on EVM, a Squads proposal on Solana. */
  payload: unknown
}

export interface SimulationOutcome {
  simulation: SimulationResult
  /** Chain-specific detections. Empty means the simulation found nothing to object to. */
  rejectReasons: RejectCode[]
}

/**
 * Everything guard-core needs from a chain. guard-core imports this and never a chain SDK, which is
 * what keeps the policy engine and the HTTP API chain-agnostic.
 */
export interface ChainAdapter {
  readonly chain: ChainId

  getAllowanceState(): Promise<AllowanceState>
  getHotWalletBalance(token: Address): Promise<Amount>
  /**
   * The chain's native coin in the hot wallet, and what a few draws and payments need. Both adapters
   * have it; it is optional only until guard-core's test stub implements it too.
   */
  getHotWalletGas?(): Promise<HotWalletGas>

  /** Pulls from the owner's multisig into the hot wallet, under the onchain cap. */
  topUpHotWallet(amount: Amount): Promise<TxId>

  simulate(intent: PayIntent): Promise<SimulationOutcome>
  send(intent: PayIntent): Promise<TxId>

  buildKillTx(): Promise<KillTx>

  /**
   * A scheme client for @x402/core that signs this intent and nothing else. Whatever the SDK puts in
   * front of it is checked first, and anything other than that one payment throws SigningRefused
   * instead of producing a signature.
   */
  x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient
}

export class SigningRefused extends Error {
  constructor(readonly reasons: RejectCode[]) {
    super(`signing_refused: ${reasons.join(',')}`)
  }
}
