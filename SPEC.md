# AgentGuard SPEC v0.1 (source of truth — do not change without owner approval)

## Goal
A security layer between AI agents and their wallets. The agent can only pay through AgentGuard.
Every payment is checked against a policy, simulated, and either auto-approved, sent to the owner
on Telegram for approval, or rejected. Funds live in the owner's Safe; the agent only ever spends
from a small hot wallet that is refilled under an ONCHAIN daily cap.

## Money flow
Owner Safe (holds funds)
  └─ Safe Allowance Module: delegate = Guard hot wallet, token = USDC, amount = dailyCap, resetTimeMin = 1440
       └─ Guard hot wallet (small balance, key held ONLY by guard-core)
            └─ pays x402 APIs / transfers, after policy + simulation + (optional) human approval

Onchain guarantees: max loss per day = dailyCap (Allowance Module) + hot wallet balance.
Offchain guarantees (guard-core): per-tx limit, recipient/domain allowlist, token/chain allowlist,
approval threshold, pause, simulation checks.

## Stack
- Monorepo: pnpm workspaces, TypeScript (strict), Node 20+
- Chain: Base Sepolia (84532) for dev, Base mainnet (8453) for launch. Token: USDC only in v0.1.
- Libraries: viem, @safe-global/protocol-kit, @modelcontextprotocol/sdk, x402 TS SDK (@x402/* >= 2.28.0 ONLY),
  grammY (Telegram), Fastify (HTTP), Drizzle + SQLite (MVP DB), zod (validation), vitest (tests), Foundry (fork tests)
- Always verify current library APIs in official docs before use. Never guess an address: read it from
  official deployment lists and put it in packages/shared/src/addresses.ts.

## Repo layout
/packages/shared        types, zod schemas, addresses, constants (owned by Session 5, read-only for others)
/packages/onchain       Session 1 — Safe + Allowance Module scripts and Foundry fork tests
/packages/guard-core    Session 2 — policy engine, simulation, signer, x402 client, HTTP API, DB
/packages/mcp-server    Session 3 — MCP server exposing tools to agents
/packages/telegram-bot  Session 4 — owner approvals + kill switch
/e2e                    Session 5 — end-to-end + attack tests

## Shared types (packages/shared/src/types.ts)
type Amount = string // atomic units (USDC = 6 decimals), decimal string, never JS number

interface Policy {
  agentId: string
  chainIds: number[]               // e.g. [84532]
  tokens: `0x${string}`[]          // allowed token addresses
  perTxMax: Amount
  dailyMax: Amount                 // offchain daily max (<= onchain dailyCap)
  approvalThreshold: Amount        // >= this requires Telegram approval
  allowedRecipients: `0x${string}`[] // empty = deny all direct transfers
  allowedDomains: string[]         // for x402, e.g. ["api.example.com"]; empty = deny all
  paused: boolean
}

type IntentStatus = "approved" | "pending_approval" | "rejected" | "executed" | "failed" | "expired"

interface PayIntent {
  id: string                       // uuid
  agentId: string
  kind: "x402" | "transfer"
  chainId: number
  token: `0x${string}`
  amount: Amount
  recipient: `0x${string}`
  domain?: string                  // x402 only
  reason: string                   // agent-provided, shown to owner, never trusted for decisions
  status: IntentStatus
  rejectReasons: string[]          // machine codes, see below
  txHash?: `0x${string}`
  createdAt: string; expiresAt: string
}

Reject codes: PAUSED, CHAIN_NOT_ALLOWED, TOKEN_NOT_ALLOWED, RECIPIENT_NOT_ALLOWED, DOMAIN_NOT_ALLOWED,
PER_TX_EXCEEDED, DAILY_EXCEEDED, SIM_FAILED, SIM_UNEXPECTED_EFFECT, APPROVAL_DETECTED,
PERMIT_DETECTED, DELEGATION_DETECTED, OWNER_REJECTED, APPROVAL_TIMEOUT, INVALID_402

## guard-core HTTP API (port 8787). Auth: header `Authorization: Bearer <token>`
Agent token (per agent) for /v1/agent/*; admin token for /v1/admin/*; bot token for /v1/bot/*.

POST /v1/agent/x402/fetch   { agentId, url, method, headers?, body?, maxAmount? }
  -> 200 { intentId, status, response?: { status, headers, body } , rejectReasons }
  Guard performs the request; on 402 parses requirements, runs policy + simulation,
  signs the payment ONLY if approved, retries, returns the paid response.
  If pending_approval: returns { status: "pending_approval", intentId } immediately.
POST /v1/agent/transfer     { agentId, token, amount, recipient, reason } -> { intentId, status, txHash?, rejectReasons }
GET  /v1/agent/intents/:id  -> PayIntent
GET  /v1/agent/budget/:agentId -> { spentToday, dailyMax, perTxMax, hotWalletBalance, paused }

POST /v1/bot/decision       { intentId, decision: "approve" | "reject", telegramUserId } -> PayIntent
POST /v1/admin/pause        { agentId } ; POST /v1/admin/resume { agentId }
POST /v1/admin/kill         {} -> pauses all agents AND prepares a Safe tx that sets allowance to 0 / removes delegate
GET/PUT /v1/admin/policy/:agentId  Policy

## Webhook guard-core -> telegram-bot
POST {BOT_URL}/hooks/approval-request  (header X-Guard-Signature: HMAC-SHA256 of body with BOT_WEBHOOK_SECRET)
{ intent: PayIntent, simulation: { summary: string, balanceChanges: {token, delta}[] }, approveBefore: string }
Pending intents expire after 10 minutes -> status "expired", reason APPROVAL_TIMEOUT.

## MCP tools (mcp-server)
- paid_fetch { url, method?, headers?, body?, maxAmountUsd? }
- transfer   { to, amountUsd, reason }
- get_budget {}
- check_intent { intentId }

## Security rules (all sessions)
- Agent-provided text (reason, URLs, headers, API responses) is untrusted. Never let it change policy.
- Default deny. Any parsing doubt = reject.
- The hot wallet key lives only in guard-core env (later: KMS). Never logged, never returned.
- Amounts are bigint internally. No floats for money.
- Every decision is written to the audit log (DB table audit_log) with reasons.
