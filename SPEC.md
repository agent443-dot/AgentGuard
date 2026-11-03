# AgentGuard SPEC v0.3 (source of truth — do not change without owner approval)

## Goal
A security layer between AI agents and their wallets. The agent can only pay through AgentGuard.
Every payment is checked against a policy, simulated, and either auto-approved, sent to the owner
on Telegram for approval, or rejected. Funds live in the owner's multisig; the agent only ever spends
from a small hot wallet that is refilled under an ONCHAIN daily cap.

## Money flow
Owner multisig (holds funds)
  └─ Spend-limit primitive: delegate = Guard hot wallet, token = USDC, amount = dailyCap, period = 24h
       └─ Guard hot wallet (small balance, key held ONLY by guard-core)
            └─ pays x402 APIs / transfers, after policy + simulation + (optional) human approval

Onchain guarantees: max loss per day = dailyCap + hot wallet balance.
Offchain guarantees (guard-core): per-tx limit, recipient/domain allowlist, token/chain allowlist,
approval threshold, pause, simulation checks.

Neither chain needs a contract we write. Both primitives are audited and already deployed:

                 | Solana                          | Base (EVM)
  multisig       | Squads v4                       | Safe
  spend limit    | Squads Spending Limit           | Safe Allowance Module (resetTimeMin = 1440)
  dev network    | Solana devnet                   | Base Sepolia (84532)
  launch network | Solana mainnet-beta             | Base mainnet (8453)

## Stack
- Monorepo: pnpm workspaces, TypeScript (strict), Node 20+
- Chains: Solana first, Base second. Both ship in v0.1, in that order. Token: USDC only in v0.1.
- Shared: @modelcontextprotocol/sdk, grammY (Telegram), Fastify (HTTP), Drizzle + SQLite (MVP DB),
  zod (validation), vitest (tests)
- Solana: @sqds/multisig (depends on @solana/web3.js v1) for the multisig and the spending limit;
  @x402/svm + @x402/core (scheme `exact` over SPL transfers, peer dependency on @solana/kit >= 8) for
  payments; LiteSVM or solana-test-validator for tests. Both Solana client libraries are present
  because the ecosystem is mid-migration and each half of the work sits on a different one. Keep each
  confined to the code that needs it; addresses are base58 strings in both, so the boundary is a
  `PublicKey` to string conversion and nothing more.
- Base: viem, @safe-global/protocol-kit, x402 TS SDK (@x402/* >= 2.28.0 ONLY), Foundry for fork tests
- Always verify current library APIs in official docs before use. Never guess an address, mint or
  program id: read it from official sources and put it in packages/shared/src/addresses.ts.

## Repo layout
/packages/shared        types, zod schemas, addresses, constants (owned by Session 5, read-only for others)
/packages/onchain       Session 1 — ChainAdapter interface + svm/ (Squads) and evm/ (Safe) implementations
/packages/guard-core    Session 2 — policy engine, simulation, signer, x402 client, HTTP API, DB
/packages/mcp-server    Session 3 — MCP server exposing tools to agents
/packages/telegram-bot  Session 4 — owner approvals + kill switch
/e2e                    Session 5 — end-to-end + attack tests, run once per chain

## Chain identifiers
Chains are CAIP-2 strings, never numbers: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" style for Solana,
"eip155:8453" for Base mainnet, "eip155:84532" for Base Sepolia. The values live in
packages/shared/src/constants.ts. The Solana references are the first 32 characters of each cluster's
genesis hash, confirmed with `solana genesis-hash` (CR-002):

  mainnet-beta | solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp
  devnet       | solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1

Addresses, token identifiers and transaction ids are opaque strings. Solana uses base58, EVM uses hex;
nothing outside a chain adapter may assume either.

## Shared types (packages/shared/src/types.ts)
type Amount = string // atomic units (USDC = 6 decimals), decimal string, never JS number

interface Policy {
  agentId: string
  chains: string[]                 // CAIP-2, e.g. ["solana:5eykt4..."]
  tokens: string[]                 // allowed mints / token addresses
  perTxMax: Amount
  dailyMax: Amount                 // offchain daily max (<= onchain dailyCap)
  approvalThreshold: Amount        // >= this requires Telegram approval
  allowedRecipients: string[]      // empty = deny all direct transfers
  allowedDomains: string[]         // for x402, e.g. ["api.example.com"]; empty = deny all
  paused: boolean
}

type IntentStatus = "approved" | "pending_approval" | "rejected" | "executed" | "failed" | "expired"

interface PayIntent {
  id: string                       // uuid
  agentId: string
  kind: "x402" | "transfer"
  chain: string                    // CAIP-2
  token: string
  amount: Amount
  recipient: string
  domain?: string                  // x402 only
  reason: string                   // agent-provided, shown to owner, never trusted for decisions
  status: IntentStatus
  rejectReasons: RejectCode[]
  txId?: string                    // base58 signature on Solana, hex hash on EVM
  createdAt: string; expiresAt: string
}

## Reject codes
Shared: PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED,
PER_TX_EXCEEDED, DAILY_EXCEEDED, SIM_FAILED, SIM_UNEXPECTED_EFFECT, OWNER_REJECTED, APPROVAL_TIMEOUT,
INVALID_402

EVM only: APPROVAL_DETECTED (approve/increaseAllowance/setApprovalForAll), PERMIT_DETECTED
(Permit/Permit2 typed data), DELEGATION_DETECTED (EIP-7702 authorization)

Solana only: DELEGATE_DETECTED (SPL Approve), AUTHORITY_CHANGE_DETECTED (SetAuthority),
ACCOUNT_CLOSE_DETECTED (CloseAccount), UNKNOWN_PROGRAM_DETECTED (CPI into a program not on the
allowlist), HIDDEN_ACCOUNTS_DETECTED (address lookup tables obscuring touched accounts)

## ChainAdapter (packages/onchain/src/ChainAdapter.ts)
guard-core depends on this interface only and never imports a chain SDK directly.

interface AllowanceState { cap: Amount; spent: Amount; resetsAt: string; delegate: string }
interface SimulationOutcome { simulation: SimulationResult; rejectReasons: RejectCode[] }

interface ChainAdapter {
  chain: string                                  // CAIP-2
  getAllowanceState(): Promise<AllowanceState>
  topUpHotWallet(amount: Amount): Promise<string>  // returns txId
  getHotWalletBalance(token: string): Promise<Amount>
  buildKillTx(): Promise<{ description: string; payload: unknown }>  // owner signs this
  simulate(intent: PayIntent): Promise<SimulationOutcome>
  send(intent: PayIntent): Promise<string>         // returns txId
  x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient
}

x402Scheme returns a scheme client for @x402/core that signs this one intent and nothing else: it
inspects the exact message before signing and refuses anything that differs from the intent.
PaymentRequirements and SchemeNetworkClient are the @x402/core types. This keeps chain SDKs out of
guard-core even for x402 signing.

## guard-core HTTP API (port 8787). Auth: header `Authorization: Bearer <token>`
Agent token (per agent) for /v1/agent/*; admin token for /v1/admin/*; bot token for /v1/bot/*.

POST /v1/agent/x402/fetch   { agentId, url, method, headers?, body?, maxAmount? }
  -> 200 { intentId?, status?, response?: { status, headers, body } , rejectReasons }
  Guard performs the request; on 402 parses requirements, runs policy + simulation,
  signs the payment ONLY if approved, retries, returns the paid response.
  If pending_approval: returns { status: "pending_approval", intentId } immediately.
  No payment, no intent: when the resource does not ask for a payment, intentId and status are absent
  and the response passes through with rejectReasons: []. When the host is refused before any request
  is made, intentId is absent and the result is { status: "rejected", rejectReasons: ["DOMAIN_NOT_ALLOWED"] }.
  After the owner approves, the agent repeats the same request. The approval is redeemed once, for
  exactly the approved chain, token, amount, recipient and domain. An approval not redeemed before
  expiresAt expires with APPROVAL_TIMEOUT.
POST /v1/agent/transfer     { agentId, chain, token, amount, recipient, reason } -> { intentId, status, txId?, rejectReasons }
GET  /v1/agent/intents/:id  -> PayIntent
GET  /v1/agent/budget/:agentId -> { spentToday, dailyMax, perTxMax, hotWalletBalances, paused }

POST /v1/bot/decision       { intentId, decision: "approve" | "reject", telegramUserId } -> PayIntent
POST /v1/admin/pause        { agentId } ; POST /v1/admin/resume { agentId }
POST /v1/admin/kill         {} -> pauses all agents AND prepares, for every chain, the owner tx that
                                  sets the allowance to 0 and removes the delegate
  -> { pausedAgents: number,
       ownerTransactions: { chain: string, description: string, payload: unknown }[] }
  Each ownerTransactions entry is one chain's ChainAdapter.buildKillTx() with its CAIP-2 chain added.
  A chain whose kill tx could not be built stays in the list with payload: null and a description
  telling the owner to remove the spend limit by hand: that chain's allowance is still live.
GET/PUT /v1/admin/policy/:agentId  Policy
GET  /v1/admin/budget/:agentId -> BudgetView   same body as GET /v1/agent/budget/:agentId;
                                  404 { error: "not_found" } for an unknown agent

## Webhook guard-core -> telegram-bot
POST {BOT_URL}/hooks/approval-request  (header X-Guard-Signature: HMAC-SHA256 of body with BOT_WEBHOOK_SECRET)
{ intent: PayIntent, simulation: { summary: string, balanceChanges: {token, delta}[] }, approveBefore: string }
Pending intents expire after 10 minutes -> status "expired", reason APPROVAL_TIMEOUT.

POST {BOT_URL}/hooks/intent-event      (same X-Guard-Signature scheme as approval-request)
{ intent: PayIntent, sentAt: string }  // sentAt: ISO time guard-core sent it
Sent when an intent reaches executed, rejected, failed or expired. The bot decides what to show
(executed at or above NOTIFY_ABOVE_AMOUNT, any per-chain attack code); guard-core has no notification
policy of its own. The bot refuses events older than 5 minutes and deduplicates on intent id plus
status. Attack-code alerts are throttled per agent and code; large-payment alerts are not.

## MCP tools (mcp-server)
- paid_fetch { url, method?, headers?, body?, maxAmountUsd? }
- transfer   { to, amountUsd, reason, chain? }
- get_budget {}
- check_intent { intentId }

## Security rules (all sessions)
- Agent-provided text (reason, URLs, headers, API responses) is untrusted. Never let it change policy.
- Default deny. Any parsing doubt = reject.
- The hot wallet keys live only in guard-core env (later: KMS). Never logged, never returned.
- Amounts are bigint internally. No floats for money.
- Every decision is written to the audit log (DB table audit_log) with reasons.
- Nothing outside a chain adapter may assume an address format, a signature format or a chain id shape.

## Changelog
- v0.3 (2026-11-03): three owner-approved changes.
  CR-002: the Solana CAIP-2 ids are confirmed against each cluster's genesis hash and written here; the
  values did not change.
  CR-003: ChainAdapter.x402Scheme, so x402 signing lives in the adapter and guard-core imports no chain
  SDK. intentId and status are optional on x402 fetch responses when no payment happens. An approved
  x402 payment is redeemed once, on exactly the approved terms.
  CR-004: the intent-event webhook to the bot, GET /v1/admin/budget/:agentId, and a pinned
  /v1/admin/kill response.
- v0.2.2 (2026-11-03): the Solana stack carries both client libraries. @sqds/multisig depends on
  @solana/web3.js v1 while @x402/svm requires @solana/kit >= 8, so the choice is the ecosystem's, not
  ours. Recorded rather than papered over: a wrapper hiding one behind the other would add a layer
  nobody can audit against either library's docs.
- v0.2.1 (2026-11-03): `ChainAdapter.simulate` returns `SimulationOutcome` rather than a bare
  `SimulationResult`. The per-chain checks in the adapters produce reject codes, and the caller needs
  both the summary shown to the owner and the codes written to the audit log. Correction to the
  interface introduced in v0.2, not a change to anything decided before it.
- v0.2 (2026-11-03): two chains, Solana first then Base, per CR-001. Chain ids are CAIP-2 strings;
  addresses, tokens and transaction ids are opaque strings. Reject codes split into a shared core plus
  per-chain sets. packages/onchain becomes a ChainAdapter interface with svm/ and evm/ implementations.
  Robinhood Chain rejected. Previous versions targeted Base alone.
