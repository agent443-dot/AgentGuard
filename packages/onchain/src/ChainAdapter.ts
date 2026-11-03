import type {
  Address,
  AllowanceState,
  Amount,
  ChainId,
  PayIntent,
  RejectCode,
  SimulationResult,
  TxId,
} from '@agentguard/shared'

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

  /** Pulls from the owner's multisig into the hot wallet, under the onchain cap. */
  topUpHotWallet(amount: Amount): Promise<TxId>

  simulate(intent: PayIntent): Promise<SimulationOutcome>
  send(intent: PayIntent): Promise<TxId>

  buildKillTx(): Promise<KillTx>
}
