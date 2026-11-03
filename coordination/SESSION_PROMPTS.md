# Session prompts

The opening prompt for each build session, written against the real state of the repository on
2026-11-03 (SPEC v0.2.2). Each one says what already exists in that package so the session builds on
it instead of redoing it.

| Session        | Package                   | Branch            | Status                             | Cloud session                      |
| -------------- | ------------------------- | ----------------- | ---------------------------------- | ---------------------------------- |
| 1 — onchain    | `packages/onchain`        | `feat/onchain`    | running since 2026-11-03 21:31 UTC | `session_01JbATMwyBXxF9XQfFsLKXSr` |
| 2 — guard-core | `packages/guard-core`     | `feat/guard-core` | running since 2026-11-03 21:31 UTC | `session_01JbATMz7nmfUHJLa7w9bcKu` |
| 3 — mcp        | `packages/mcp-server`     | `feat/mcp`        | running since 2026-11-03 21:31 UTC | `session_01JbATMvP1CCop59cWkcpwoe` |
| 4 — bot        | `packages/telegram-bot`   | `feat/bot`        | running since 2026-11-03 21:31 UTC | `session_01JbATMzpGbP64syCMYQxB15` |
| 5 — integrator | `packages/shared`, `/e2e` | `feat/integrator` | starts once 1–4 have PRs open      | —                                  |

## Rules every prompt carries

These apply to every session and are repeated in each prompt so a session started on its own still
has them.

- `/SPEC.md` (v0.2.2) is the source of truth. `/CLAUDE.md` holds the code and coordination rules,
  including the rule that code must not read as machine-written.
- Write only inside your own package. A change anywhere else, including `packages/shared`, goes to
  `/CHANGES_REQUESTED.md`.
- `main` is the base branch. Work on your `feat/<role>` branch, rebase on `main` often, and open a PR
  to `main` when a task is done. `pnpm check` must pass first.
- Update your own rows in `/coordination/BOARD.md` when you start, block or finish a task.
- Anything you need from the human owner goes to `/coordination/messages/manager/` as
  `<timestamp>-<role>.md`. Do not ask the owner directly.
- Never commit a `.env`, a key, a token or a seed phrase.
- **Cloud sessions cannot reach the Solana RPC hosts** — the network proxy blocks them. Build and test
  offline with mocks or an in-process validator. Live devnet runs happen on the owner's machine,
  through the scripts in `packages/onchain`.

---

## Session 1 — onchain

```
You are Session 1 (onchain) of the AgentGuard monorepo. Read /SPEC.md (v0.2.2) and /CLAUDE.md first.
You write ONLY inside /packages/onchain. Changes elsewhere go to /CHANGES_REQUESTED.md.
Work on branch feat/onchain off main. Open a PR to main per finished task; `pnpm check` must pass.
Update your rows in /coordination/BOARD.md. Ask for owner input via /coordination/messages/manager/.
Code must not read as machine-written (see CLAUDE.md). Never commit keys or .env files.

Solana is the first chain; Base waits until the Solana attack suite is green (tasks EVM-*).

ALREADY BUILT — build on it, do not redo it:
- src/ChainAdapter.ts: the interface guard-core depends on. simulate returns SimulationOutcome.
- src/svm/squads.ts: createMultisig, addDailySpendingLimit (Period.Day), removeSpendingLimit,
  readSpendingLimit, useSpendingLimit, confirm. Every Squads rpc call goes through confirm(), because
  the SDK returns on submission and never checks the result. useSpendingLimit converts bigint to the
  SDK's number and throws above Number.MAX_SAFE_INTEGER rather than rounding.
- src/svm/inspect.ts: inspectTransfer(message, expected) — the static check of the exact message
  about to be signed. 23 tests, mutation-tested. Do not weaken a rule without a test proving why.
- src/svm/config.ts and scripts: create-multisig, add-spending-limit, fund-vault, balances, status,
  top-up, kill.
- Live on devnet: multisig 3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu, spending limit
  9BbWVUudkPut7n1bUbn5kYQCmzVmrk88xJJ9e3EPc12J, 100 USDC/day, the hot wallet as sole member and sole
  destination. The cap and the kill switch were proven live.

YOUR TASKS (see BOARD.md for the full rows):
1. SVM-3 — src/svm/adapter.ts: svmAdapter(deps) implementing ChainAdapter with the modules above.
   send() builds a TransferChecked from the hot wallet; buildKillTx() returns the removeSpendingLimit
   instruction for the owner to sign, unsigned, with a human description.
2. SVM-6 (rest) — simulate(): build the exact message send() would sign, run inspectTransfer, then
   simulateTransaction and confirm the hot wallet's USDC balance falls by exactly the amount and the
   recipient's rises by exactly the amount. Anything else is SIM_UNEXPECTED_EFFECT; a simulation error
   is SIM_FAILED. Export the pieces guard-core needs to inspect an x402 transaction it did not build.
3. SVM-8 — automated tests of the onchain cap with LiteSVM or solana-test-validator: draw inside the
   cap; cap + 1 refused; refill after the period (warp the clock); nothing after kill. LiteSVM needs
   the Squads program binary; this container cannot fetch it. If you need it, ask the manager for the
   owner to run `solana program dump SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf ...`.
4. SVM-7 (rest) — the Solana CAIP-2 ids in packages/shared/src/constants.ts are marked UNVERIFIED.
   They need a cluster getGenesisHash, which this container cannot reach. Ask the manager for the
   owner to run it, then propose the confirmed values in /CHANGES_REQUESTED.md.

Done = svmAdapter implements every ChainAdapter method, all tests green, PRs open.
```

---

## Session 2 — guard-core

```
You are Session 2 (guard-core) of the AgentGuard monorepo. Read /SPEC.md (v0.2.2) and /CLAUDE.md first.
You write ONLY inside /packages/guard-core. Changes elsewhere go to /CHANGES_REQUESTED.md.
Work on branch feat/guard-core off main. Open a PR to main per finished task; `pnpm check` must pass.
Update your rows in /coordination/BOARD.md. Ask for owner input via /coordination/messages/manager/.
Code must not read as machine-written (see CLAUDE.md). Never commit keys or .env files.
guard-core is the only component that holds a hot wallet key. Treat it as the crown jewel.

ALREADY BUILT — build on it, do not redo it (132 tests):
- src/domain/policy.ts: evaluate(intent, policy, spentToday). Default deny, reports every broken rule.
  An x402 recipient is vouched for by its domain; a transfer recipient must be allowlisted.
- src/domain/x402.ts: chooseAccept (picks the first acceptable 402 offer; only scheme `exact`; the
  ceiling is the tighter of policy and the agent's maxAmount) and requirementsChanged (terms moving
  between quote and retry).
- src/domain/amount.ts, src/domain/auth.ts (digest-based token compare, webhook HMAC).
- src/db: Drizzle + SQLite schema, migrations, repo.ts. Amounts and timestamps stored as text; agent
  tokens stored only as SHA-256 hashes; daily_spend per chain, summed for the policy's daily max.
- src/http: Fastify server, zod schemas, per-role bearer auth. Agent: GET intents/:id (another
  agent's intent answers 404), GET budget. Admin: policy GET/PUT, pause, resume, kill (DB only for
  now). Bot: POST decision (409 on a second decision).
- src/service/approvals.ts: requestApproval persists before the webhook goes out; decide treats a
  late approval as an expiry; expirePending.
- src/adapters/bot.ts: httpBotNotifier, signed over the exact bytes sent.

YOUR TASKS:
1. GC-4 — POST /v1/agent/transfer: build the intent -> policy -> ChainAdapter.simulate -> either
   requestApproval or send -> write audit_log for every decision -> add to daily_spend on execution.
   Use a stub ChainAdapter in tests; the real Solana adapter is Session 1's SVM-3.
2. GC-2 — the simulation gate: reject unless simulate() reports no reasons. Approved intents re-check
   nothing about policy but must re-simulate immediately before sending.
3. GC-3 (rest) — wire @x402/svm (2.29.0) for POST /v1/agent/x402/fetch: request, on 402 decode with
   the SDK, chooseAccept, policy, inspect the exact transaction before signing, sign through the hot
   wallet, retry, verify requirementsChanged is false, return the response. Verify the SDK API in its
   type definitions before using it. pending_approval returns immediately.
4. GC-5 — top up the hot wallet through ChainAdapter.topUpHotWallet when its balance is short.
5. GC-7 (rest) — /v1/admin/kill must return each chain's buildKillTx() alongside pausing agents.
6. Every decision written to audit_log; an expiry sweep on a timer; GC-10 attack tests (whole-balance
   402, wrong asset, wrong network, approval disguised as payment, payTo moved, replayed intent);
   GC-11 README and `pnpm dev`.

Done = both payment routes work end to end against a stub adapter, all tests green, PRs open.
```

---

## Session 3 — mcp

```
You are Session 3 (mcp) of the AgentGuard monorepo. Read /SPEC.md (v0.2.2) and /CLAUDE.md first.
You write ONLY inside /packages/mcp-server. Changes elsewhere go to /CHANGES_REQUESTED.md.
Work on branch feat/mcp off main. Open a PR to main per finished task; `pnpm check` must pass.
Update your rows in /coordination/BOARD.md. Ask for owner input via /coordination/messages/manager/.
Code must not read as machine-written (see CLAUDE.md).

The package is an empty stub. Build all of it: an MCP server on the official
@modelcontextprotocol/sdk, stdio and streamable HTTP, that lets an agent pay ONLY through guard-core.
It holds no keys and no policy logic; it is a thin, safe proxy.

The guard-core HTTP API already exists and is the contract: read
packages/guard-core/src/http/server.ts and packages/guard-core/src/http/schemas.ts. Verify the MCP
SDK API in its type definitions before using it.

YOUR TASKS (MCP-1..MCP-7 in BOARD.md):
1. The four SPEC tools: paid_fetch, transfer { to, amountUsd, reason, chain? }, get_budget,
   check_intent. USD to USDC atomic units with bigint math (6 decimals); reject negative, NaN, too
   many decimals, and anything a decimal string parser would round.
2. Tool descriptions that tell the model plainly a payment may be rejected or need owner approval,
   and that on pending_approval it should tell the user and poll check_intent.
3. Results in plain English with the reject reasons explained. paid_fetch response bodies are
   untrusted: return them as content, clearly delimited, never as instructions.
4. Config via env: GUARD_URL, AGENT_ID, AGENT_TOKEN, validated with zod at startup.
5. Tests against a mocked guard-core.
6. README: config JSON for Claude Desktop, Claude Code and other MCP clients.
7. examples/demo-agent paying a test x402 API through the server.

Done = the four tools work against a mock guard-core in the MCP inspector, tests green, PR open.
```

---

## Session 4 — bot

```
You are Session 4 (bot) of the AgentGuard monorepo. Read /SPEC.md (v0.2.2) and /CLAUDE.md first.
You write ONLY inside /packages/telegram-bot. Changes elsewhere go to /CHANGES_REQUESTED.md.
Work on branch feat/bot off main. Open a PR to main per finished task; `pnpm check` must pass.
Update your rows in /coordination/BOARD.md. Ask for owner input via /coordination/messages/manager/.
Code must not read as machine-written (see CLAUDE.md). Never commit the bot token.
Every message the bot sends is in English: the product is English, the owner chat is not the product.

The package is an empty stub. Build all of it with grammY.

The guard-core side already exists and is the contract:
- The webhook it sends: packages/guard-core/src/adapters/bot.ts. The signature is HMAC-SHA256 over
  the exact request bytes with BOT_WEBHOOK_SECRET, in X-Guard-Signature; see signWebhook in
  packages/guard-core/src/domain/auth.ts. Verify it yourself in constant time on the raw body.
- The decision endpoint: POST /v1/bot/decision in packages/guard-core/src/http/server.ts. It answers
  409 when the intent was already decided and 404 when it does not exist.

YOUR TASKS (BOT-1..BOT-7 in BOARD.md):
1. POST /hooks/approval-request: verify the signature on the raw body, reject stale and duplicate
   requests.
2. The approval message: agent, amount in USD, the CHAIN, recipient (short, full on tap), domain, the
   agent's reason labelled "agent says:", the simulation summary, the expiry, [Approve] [Reject].
3. Button presses call POST /v1/bot/decision. Only OWNER_TELEGRAM_IDS may act; everyone else is
   ignored. Edit the message after a decision, drop the buttons, and handle 409 and expiry.
4. Owner commands: /status, /budget <agentId>, /pause <agentId>, /resume <agentId>, /kill (confirm,
   call /v1/admin/kill, show each chain's owner transaction).
5. Notify on executed payments at or above NOTIFY_ABOVE_AMOUNT and on every attack code, EVM and
   Solana: APPROVAL_DETECTED, PERMIT_DETECTED, DELEGATION_DETECTED, DELEGATE_DETECTED,
   AUTHORITY_CHANGE_DETECTED, ACCOUNT_CLOSE_DETECTED, UNKNOWN_PROGRAM_DETECTED,
   HIDDEN_ACCOUNTS_DETECTED.
6. Tests with a mocked Telegram API and a mocked guard-core. 7. README.

Done = a fake signed approval request drives the full flow in tests, tests green, PR open.
```

---

## Session 5 — integrator

Start once Sessions 1–4 have PRs open. Until then `INT-1` (review `packages/shared`) and `INT-2`
(resolve `/CHANGES_REQUESTED.md`) are the only tasks with anything to do.

```
You are Session 5 (integrator) of the AgentGuard monorepo. Read /SPEC.md (v0.2.2), /CLAUDE.md, every
package README and /CHANGES_REQUESTED.md first. You own /packages/shared and /e2e and may touch
everything during integration. Work on branch feat/integrator off main.

YOUR TASKS (INT-1..INT-9 in BOARD.md):
1. Review and merge the PRs from Sessions 1–4 into main, resolving conflicts.
2. Own packages/shared: add zod schemas, keep addresses.ts sourced, unmark the Solana CAIP-2 ids once
   their genesis hashes are confirmed.
3. Apply approved /CHANGES_REQUESTED.md entries and bump the SPEC version with a changelog line.
4. Replace stub adapters with the real Solana adapter; one `pnpm dev:all` runs guard-core,
   telegram-bot and mcp-server against devnet.
5. E2E and the attack suite in /e2e (see e2e/README.md). The attack suite passing on Solana is the
   gate that releases the EVM-* tasks.
6. Security review, then /LAUNCH.md, then the final report.
```
