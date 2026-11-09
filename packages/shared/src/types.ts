/**
 * Shared types, transcribed from /SPEC.md.
 * Every other package imports from here; changes are proposed in /CHANGES_REQUESTED.md.
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
  /** CR-010. Shadow evaluates and simulates every payment and signs none. Default 'live'. */
  mode?: 'live' | 'shadow'
  /** CR-010. An x402 price above the pinned one by more than this goes to the owner. Default 100. */
  priceIncreaseMaxPct?: number
  /** CR-010. The payment that would exceed it trips the breaker and pauses the agent. Default 10. */
  maxPaymentsPerMinute?: number
  /** CR-010. When true, a payment without an open mandate is refused. Default false. */
  requireMandate?: boolean
}

/** CR-010: a budget for one task, inside the policy. */
export interface Mandate {
  id: string
  agentId: string
  budget: Amount
  spent: Amount
  /** x402 domains it may pay, a subset of the policy's. */
  domains: string[]
  /** Transfer recipients it may pay, a subset of the policy's. */
  recipients: Address[]
  /** Agent-provided, shown to the owner, never used in a decision. */
  reason: string
  status: 'pending_approval' | 'active' | 'exhausted' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
}

/** CR-010: why a payment goes to the owner even below the threshold. */
export type ApprovalFlag = 'RECIPIENT_CHANGED' | 'PRICE_JUMP'

/** CR-010: one per executed intent, signed by RECEIPT_SIGNING_KEY. */
export interface Receipt {
  intent: PayIntent
  /** Hex SHA-256 of the canonical JSON of the policy in force. */
  policyHash: string
  /** The simulation summary. */
  simulation: string
  approvedBy: 'policy' | 'owner' | 'passkey'
  issuedAt: string
  /** Hex Ed25519 signature over the canonical JSON of the fields above. */
  signature: string
}

/** Body of POST {BOT_URL}/hooks/alert (CR-010). */
export interface AlertEvent {
  kind: 'breaker_tripped'
  agentId: string
  detail: string
  sentAt: string
}

export type IntentStatus =
  | 'approved'
  | 'pending_approval'
  | 'rejected'
  | 'executed'
  | 'failed'
  | 'expired'
  /** CR-010: would have been sent; shadow mode signs nothing. */
  | 'shadowed'

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
  /** CR-010: the mandate this payment counts against. */
  mandateId?: string
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
  | 'MANDATE_REQUIRED'
  | 'MANDATE_EXCEEDED'
  | 'MANDATE_EXPIRED'
  | 'BREAKER_TRIPPED'

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

/**
 * CR-008. `none` means the chain shows no limit for the hot wallet, as a kill leaves it. A read that
 * fails throws instead, so a kill is never mistaken for an outage, nor an outage for a kill.
 */
export type AllowanceState =
  | { status: 'active'; cap: Amount; spent: Amount; resetsAt: string; delegate: Address }
  | { status: 'none'; delegate: Address }

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
  /**
   * CR-006: chains guard-core runs an adapter for that this agent's policy allows. Optional only
   * until guard-core returns it; consumers must treat its absence as "not reported".
   */
  chains?: ChainId[]
}

/** One entry of GET /v1/admin/chains (CR-006). */
export interface ChainStatus {
  chain: ChainId
  /** Null when the adapter's allowance could not be read. */
  allowance: AllowanceState | null
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
