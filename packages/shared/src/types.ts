/**
 * Shared types, transcribed from /SPEC.md. Owner: integrator (Session 5).
 * Other sessions import from here and propose changes in /CHANGES_REQUESTED.md.
 */

/** Atomic units (USDC = 6 decimals) as a decimal string. Parse to bigint before any math. */
export type Amount = string

/**
 * CAIP-2 chain identifier, e.g. "eip155:8453". Chains are never numbers: Solana has no numeric id.
 */
export type ChainId = string

/**
 * An address, mint or program id. Base58 on Solana, hex on EVM. Nothing outside a chain adapter
 * may assume which.
 */
export type Address = string

/** Base58 signature on Solana, hex hash on EVM. */
export type TxId = string

export interface Policy {
  agentId: string
  chains: ChainId[]
  tokens: Address[]
  perTxMax: Amount
  dailyMax: Amount
  /** At or above this amount, the owner must approve on Telegram. */
  approvalThreshold: Amount
  /** Empty denies all direct transfers. */
  allowedRecipients: Address[]
  /** x402 hosts, e.g. ["api.example.com"]. Empty denies all. */
  allowedDomains: string[]
  paused: boolean
}

export type IntentStatus =
  'approved' | 'pending_approval' | 'rejected' | 'executed' | 'failed' | 'expired'

export type PayIntentKind = 'x402' | 'transfer'

export interface PayIntent {
  id: string
  agentId: string
  kind: PayIntentKind
  chain: ChainId
  token: Address
  amount: Amount
  recipient: Address
  /** x402 only: the host of the requested URL. */
  domain?: string
  /** Agent-provided, shown to the owner, never used in a decision. */
  reason: string
  status: IntentStatus
  rejectReasons: RejectCode[]
  txId?: TxId
  createdAt: string
  expiresAt: string
}

/** Applies on every chain. */
export type SharedRejectCode =
  | 'PAUSED'
  | 'CHAIN_NOT_ALLOWED'
  | 'TOKEN_NOT_ALLOWED'
  | 'RECIPIENT_NOT_ALLOWED'
  | 'DOMAIN_NOT_ALLOWED'
  | 'PER_TX_EXCEEDED'
  | 'DAILY_EXCEEDED'
  | 'SIM_FAILED'
  | 'SIM_UNEXPECTED_EFFECT'
  | 'OWNER_REJECTED'
  | 'APPROVAL_TIMEOUT'
  | 'INVALID_402'

/** Standing authority an EVM payment must never grant. */
export type EvmRejectCode = 'APPROVAL_DETECTED' | 'PERMIT_DETECTED' | 'DELEGATION_DETECTED'

/** The Solana equivalents are different mechanisms, not renames of the EVM ones. */
export type SvmRejectCode =
  | 'DELEGATE_DETECTED'
  | 'AUTHORITY_CHANGE_DETECTED'
  | 'ACCOUNT_CLOSE_DETECTED'
  | 'UNKNOWN_PROGRAM_DETECTED'
  | 'HIDDEN_ACCOUNTS_DETECTED'

export type RejectCode = SharedRejectCode | EvmRejectCode | SvmRejectCode

export type PolicyDecision = 'approve' | 'needs_approval' | 'reject'

export interface BalanceChange {
  token: Address
  /** Signed atomic-unit delta as a decimal string. */
  delta: Amount
}

export interface SimulationResult {
  summary: string
  balanceChanges: BalanceChange[]
}

export interface AllowanceState {
  cap: Amount
  spent: Amount
  resetsAt: string
  delegate: Address
}

/** Body of POST {BOT_URL}/hooks/approval-request. */
export interface ApprovalRequest {
  intent: PayIntent
  simulation: SimulationResult
  approveBefore: string
}

export interface BudgetView {
  spentToday: Amount
  dailyMax: Amount
  perTxMax: Amount
  hotWalletBalances: Record<ChainId, Amount>
  paused: boolean
}

/** Body of POST {BOT_URL}/hooks/intent-event, sent when an intent reaches a final status. */
export interface IntentEvent {
  intent: PayIntent
  /** When guard-core sent it. The bot refuses events older than 5 minutes. */
  sentAt: string
}

export interface OwnerTransaction {
  chain: ChainId
  description: string
  /** Null when the transaction could not be built: that chain's allowance is still live. */
  payload: unknown
}

/** Response of POST /v1/admin/kill. */
export interface KillResponse {
  pausedAgents: number
  ownerTransactions: OwnerTransaction[]
}

/** Response of POST /v1/agent/x402/fetch. No intent exists when no payment was asked for. */
export interface X402FetchResponse {
  intentId?: string
  status?: IntentStatus
  response?: { status: number; headers: Record<string, string>; body: string }
  rejectReasons: RejectCode[]
}
