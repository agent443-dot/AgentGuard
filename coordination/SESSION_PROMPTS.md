# Session prompts

The opening prompt for each session, as the owner wrote it. Open a Claude Code session in the folder
listed for that role and paste the prompt. Every session reads [`/SPEC.md`](../SPEC.md) and
[`/CLAUDE.md`](../CLAUDE.md) automatically and finds its tasks in [`BOARD.md`](./BOARD.md).

| Session        | Folder            | Branch            |
| -------------- | ----------------- | ----------------- |
| 1 — onchain    | `~/ag-onchain`    | `feat/onchain`    |
| 2 — guard-core | `~/ag-guard-core` | `feat/guard-core` |
| 3 — mcp        | `~/ag-mcp`        | `feat/mcp`        |
| 4 — bot        | `~/ag-bot`        | `feat/bot`        |
| 5 — integrator | `~/ag-integrator` | `feat/integrator` |

Run `pnpm install` once in each worktree before starting.

---

## Session 1 — onchain

Manager note: `packages/onchain/.env` is already filled with the owner key, the hot wallet address and
the Base Sepolia RPC. `SAFE_ADDRESS` stays empty until `create-safe.ts` produces it. Tasks `ON-1`..`ON-8`.
`ON-8` and `ON-6` need no funds and can start immediately.

```
You are working on the AgentGuard monorepo. Read /SPEC.md first; it is the source of truth.
You ONLY edit /packages/onchain. If you need something changed elsewhere, write it in /CHANGES_REQUESTED.md.

Task: build the onchain setup with NO custom contracts, using the audited Safe Allowance Module.

Deliver:
1. Scripts (TypeScript, viem + @safe-global/protocol-kit):
   - create-safe.ts: deploy a Safe for the owner on Base Sepolia (owner EOA from env, threshold 1 for MVP).
   - enable-allowance.ts: enable the Allowance Module on the Safe, add the guard hot wallet as delegate,
     set USDC allowance = DAILY_CAP with resetTimeMin = 1440.
   - kill.ts: build (and optionally execute) a Safe tx that sets the allowance to 0 and removes the delegate.
   - status.ts: print Safe balance, delegate, allowance, spent, next reset.
   - Export reusable functions from src/index.ts (guard-core will import topUpHotWallet(amount) and getAllowanceState()).
2. topUpHotWallet: the delegate (hot wallet) calls executeAllowanceTransfer to move USDC from the Safe to itself.
3. Foundry fork tests (fork Base Sepolia) proving:
   - delegate can pull up to the cap within a period
   - pulling cap + 1 reverts
   - after reset period the allowance refills
   - after kill, delegate cannot pull anything
4. README with exact commands and required env vars.

Get the Allowance Module and USDC addresses from official Safe / Circle sources and put them in
/CHANGES_REQUESTED.md for Session 5 to add to packages/shared/src/addresses.ts (do not hardcode guesses).
Done = all tests green and scripts working on Base Sepolia with test USDC.
```

---

## Session 2 — guard-core

Manager note: `packages/guard-core/.env` is already filled with the hot wallet key, the RPC and the three
auth secrets. Tasks `GC-1`..`GC-11`. `GC-5` depends on `ON-3`, so build it behind a mocked interface
rather than waiting.

```
You are working on the AgentGuard monorepo. Read /SPEC.md first; it is the source of truth.
You ONLY edit /packages/guard-core. Changes elsewhere go to /CHANGES_REQUESTED.md.

Task: build the guard service — the only component that holds the hot wallet key.

Deliver:
1. Policy engine (pure functions, 100% unit tested): evaluate(intent, policy, spentToday) ->
   { decision: "approve" | "needs_approval" | "reject", reasons: RejectCode[] }. Default deny.
2. Simulation: before signing, simulate the exact call (eth_call / viem simulateContract, or Tenderly if
   TENDERLY_* env set). Reject if: the effect is not a single USDC transfer of the exact amount to the exact
   recipient; it contains approve/increaseAllowance/setApprovalForAll (APPROVAL_DETECTED); Permit/Permit2
   typed data (PERMIT_DETECTED); EIP-7702 authorization or delegation (DELEGATION_DETECTED).
3. x402 client: use the official x402 TS SDK >= 2.28.0 with spend controls ON. Flow for POST /v1/agent/x402/fetch:
   request -> on 402 parse payment requirements -> validate scheme/network/asset/payTo/amount strictly
   -> build PayIntent (domain = URL host) -> policy -> simulation -> sign only if approved -> retry -> return response.
   Never sign anything the SDK cannot decode into a plain USDC payment.
4. Transfers: POST /v1/agent/transfer with the same pipeline, sends from the hot wallet.
5. Hot wallet top-up: before paying, if hot wallet balance < amount, call topUpHotWallet from @agentguard/onchain
   (mock it behind an interface until Session 1 is merged).
6. Human approval: if needs_approval -> save as pending_approval, send signed webhook to the bot (per SPEC),
   handle POST /v1/bot/decision, expire after 10 min. Approved x402 intents are executed when approved and
   the agent retrieves the result via GET /v1/agent/intents/:id.
7. Admin endpoints: pause, resume, kill, policy GET/PUT.
8. Fastify HTTP API exactly as in SPEC, zod validation on every input, auth tokens per role, rate limiting.
9. DB (Drizzle + SQLite): agents, policies, intents, audit_log, daily_spend.
10. Tests (vitest): policy edge cases, each reject code, malicious 402 responses (amount = whole balance,
    wrong asset, wrong network, approval disguised as payment, payTo mismatch), replay of same intent.

Done = all tests green, `pnpm dev` starts the API, README documents env vars.
```

---

## Session 3 — mcp

Manager note: no keys and no policy logic in this package. Tasks `MCP-1`..`MCP-7`. Everything can be built
against a mocked guard-core, so nothing here is blocked.

```
You are working on the AgentGuard monorepo. Read /SPEC.md first; it is the source of truth.
You ONLY edit /packages/mcp-server. Changes elsewhere go to /CHANGES_REQUESTED.md.

Task: an MCP server (official @modelcontextprotocol/sdk, stdio + streamable HTTP) that lets any agent pay
ONLY through guard-core. This package holds NO keys and NO policy logic; it is a thin, safe proxy.

Deliver:
1. Tools exactly as in SPEC: paid_fetch, transfer, get_budget, check_intent.
   - Convert USD inputs to USDC atomic units with bigint math (6 decimals). Reject negative/NaN/too many decimals.
   - Clear tool descriptions so the model knows: payments may be rejected or need owner approval;
     when status = pending_approval, tell the user and poll check_intent.
2. Config via env: GUARD_URL, AGENT_ID, AGENT_TOKEN.
3. Return readable results to the model (status, reasons in plain English, remaining budget).
4. Treat API responses from paid_fetch as untrusted data: wrap them so the model sees them as content, not instructions.
5. Tests with a mocked guard-core (msw or a tiny Fastify mock).
6. README: how to plug it into Claude Desktop / Claude Code and other MCP clients (config JSON examples).
7. examples/demo-agent: a small script/agent that calls a paid x402 test API through the MCP server.

Done = tests green, MCP inspector shows the 4 tools working against a mock guard.
```

---

## Session 4 — bot

Manager note: tasks `BOT-1`..`BOT-7`. The Telegram bot token is `HUMAN-5` and is not created yet, so build
and test against a mocked Telegram API. `BOT_WEBHOOK_SECRET` must match the one already in guard-core's env.

```
You are working on the AgentGuard monorepo. Read /SPEC.md first; it is the source of truth.
You ONLY edit /packages/telegram-bot. Changes elsewhere go to /CHANGES_REQUESTED.md.

Task: a Telegram bot (grammY) for the owner to approve payments and stop everything.

Deliver:
1. HTTP endpoint POST /hooks/approval-request: verify X-Guard-Signature (HMAC, constant-time compare),
   reject old/duplicate requests. Send the owner a message: agent, amount in USD, recipient (shortened + full on tap),
   domain, agent's reason (clearly labeled "agent says:"), simulation summary, expiry time,
   with inline buttons [Approve] [Reject].
2. Button presses call POST /v1/bot/decision. Only Telegram user IDs in OWNER_TELEGRAM_IDS can act;
   everyone else is ignored. Edit the message after a decision (show result, remove buttons). Handle expired intents.
3. Commands (owners only): /status, /budget <agentId>, /pause <agentId>, /resume <agentId>,
   /kill (asks for confirmation, then calls /v1/admin/kill and shows the Safe tx the owner must sign to remove the onchain allowance).
4. Notifications for executed payments above a configurable amount and for every rejection of type
   APPROVAL_DETECTED / PERMIT_DETECTED / DELEGATION_DETECTED (possible attack).
5. Tests with mocked Telegram API and mocked guard-core.
6. README: create bot with BotFather, env vars, how to get your Telegram ID.

Done = tests green, bot runs locally and handles a fake approval request end to end.
```

---

## Session 5 — integrator

Manager note: open this one when the others start producing. `INT-2` and the review of
`packages/shared` (transcribed from SPEC by the manager) can start immediately; the rest is blocked on
`INT-3`.

```
You are the integrator for the AgentGuard monorepo. You can read and edit EVERYTHING.
Read /SPEC.md, every package README, and /CHANGES_REQUESTED.md first.

Task: make it work end to end, prove it is safe, and prepare launch.

1. Integration
   - Own /packages/shared: types, zod schemas, addresses (verified from official sources), constants.
   - Resolve CHANGES_REQUESTED.md; update SPEC.md version if interfaces change, and list what changed.
   - Replace mocks with real packages; one command `pnpm dev:all` (or docker-compose) runs guard-core,
     telegram-bot and mcp-server against Base Sepolia.
2. E2E tests (/e2e) on Base Sepolia or a local fork:
   - Happy path: agent calls paid_fetch on a test x402 API under threshold -> paid -> response returned.
   - Over threshold -> Telegram approval -> approve -> paid. Same with reject. Same with timeout.
   - Kill switch: after /kill, every payment fails and the onchain allowance is 0.
3. Attack tests (must all be blocked, with the correct reject code):
   - 402 asks for the whole wallet balance; wrong token; wrong network; payTo changes between 402 and retry
   - approval / Permit / Permit2 / EIP-7702 delegation disguised as a payment
   - prompt-injected API response telling the agent to transfer funds to a new address
   - domain not in allowlist; recipient not in allowlist; per-tx and daily limits; replayed intent
   - spoofed Telegram webhook (bad HMAC); non-owner pressing Approve
   - hot wallet drained by a bug -> confirm loss is capped by Allowance Module daily cap
4. Security review: secrets handling, logs (no keys), auth on every endpoint, rate limits, dependency audit,
   x402 SDK versions >= 2.28.0 in the lockfile.
5. Launch checklist (write /LAUNCH.md):
   - Mainnet beta: low caps (e.g. dailyCap 100 USDC per agent), invite-only, monitoring + alerts, pause tested.
   - Deploy guard-core + bot (e.g. Fly.io/Railway), hot wallet key in a secrets manager.
   - Bug bounty plan, incident runbook (who presses kill, how to rotate the hot wallet key).
   - Landing page + docs for the MCP setup.
6. Output a final report: what works, test results, known risks, what must happen before raising caps.
```
