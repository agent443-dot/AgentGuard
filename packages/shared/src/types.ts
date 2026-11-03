/**
 * Shared types, transcribed from /SPEC.md "Shared types".
 * Owner: integrator (Session 5). Every other session imports from here and MUST NOT edit this file;
 * propose changes in /CHANGES_REQUESTED.md.
 */

export type Hex = `0x${string}`

/** Atomic units (USDC = 6 decimals), decimal string, never a JS number. Parse to bigint before any math. */
export type Amount = string

export interface Policy {
  agentId: string
  /** Allowed chain ids, e.g. [84532]. */
  chainIds: number[]
  /** Allowed token addresses. */
  tokens: Hex[]
  perTxMax: Amount
  /** Offchain daily max (must be <= the onchain Allowance Module dailyCap). */
  dailyMax: Amount
  /** At or above this amount, a payment requires Telegram approval from the owner. */
  approvalThreshold: Amount
  /** Empty = deny all direct transfers. */
  allowedRecipients: Hex[]
  /** For x402, e.g. ["api.example.com"]. Empty = deny all. */
  allowedDomains: string[]
  paused: boolean
}

export type IntentStatus =
  'approved' | 'pending_approval' | 'rejected' | 'executed' | 'failed' | 'expired'

export type PayIntentKind = 'x402' | 'transfer'

export interface PayIntent {
  /** uuid */
  id: string
  agentId: string
  kind: PayIntentKind
  chainId: number
  token: Hex
  amount: Amount
  recipient: Hex
  /** x402 only: the host of the requested URL. */
  domain?: string
  /** Agent-provided, shown to the owner, NEVER trusted for decisions. */
  reason: string
  status: IntentStatus
  /** Machine codes, see RejectCode. */
  rejectReasons: RejectCode[]
  txHash?: Hex
  createdAt: string
  expiresAt: string
}

export type RejectCode =
  | 'PAUSED'
  | 'CHAIN_NOT_ALLOWED'
  | 'TOKEN_NOT_ALLOWED'
  | 'RECIPIENT_NOT_ALLOWED'
  | 'DOMAIN_NOT_ALLOWED'
  | 'PER_TX_EXCEEDED'
  | 'DAILY_EXCEEDED'
  | 'SIM_FAILED'
  | 'SIM_UNEXPECTED_EFFECT'
  | 'APPROVAL_DETECTED'
  | 'PERMIT_DETECTED'
  | 'DELEGATION_DETECTED'
  | 'OWNER_REJECTED'
  | 'APPROVAL_TIMEOUT'
  | 'INVALID_402'

export type PolicyDecision = 'approve' | 'needs_approval' | 'reject'

export interface BalanceChange {
  token: Hex
  /** Signed atomic-unit delta as a decimal string. */
  delta: Amount
}

export interface SimulationResult {
  summary: string
  balanceChanges: BalanceChange[]
}

/** Body of POST {BOT_URL}/hooks/approval-request. */
export interface ApprovalRequest {
  intent: PayIntent
  simulation: SimulationResult
  /** ISO timestamp after which the intent expires (APPROVAL_TIMEOUT). */
  approveBefore: string
}

export interface BudgetView {
  spentToday: Amount
  dailyMax: Amount
  perTxMax: Amount
  hotWalletBalance: Amount
  paused: boolean
}
