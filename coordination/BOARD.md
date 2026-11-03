# AgentGuard task board

Statuses: `todo` | `doing` | `blocked` | `review` | `done`.
Update **only your own rows**. To flag something on someone else's row, add a note or send a message to
their inbox (`coordination/messages/<owner>/`).

`HUMAN-n` dependencies are items in [`HUMAN_TODO.md`](./HUMAN_TODO.md) that only the human owner can do.

## Can start right now (no human input needed)

`ON-6`, `ON-8`, `GC-1`, `GC-2`, `GC-3`, `GC-9`, `MCP-1`, `MCP-4`, `BOT-1`, `INT-2`.
Everything else is either downstream of those or waiting on the owner.

Sessions 1–4 can write and unit-test their whole package against mocks before any wallet exists. Only
running against Base Sepolia needs `HUMAN-3` / `HUMAN-4`.

## manager

| id    | owner   | status | depends_on | notes                                                                                                                        |
| ----- | ------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| MGR-1 | manager | done   | —          | Repo bootstrap: pnpm workspace, strict tsconfig, ESLint/Prettier, vitest, CI, package skeletons, `coordination/`, ADR-001    |
| MGR-2 | manager | done   | MGR-1      | This board and `HUMAN_TODO.md`                                                                                               |
| MGR-3 | manager | doing  | —          | Coordination rounds: read every inbox, unblock sessions, route questions, detect interface drift against SPEC                |
| MGR-4 | manager | doing  | —          | Collect `/CHANGES_REQUESTED.md` proposals, present them to the owner with a recommendation, hand decisions to the integrator |

## Session 1 — onchain (`packages/onchain`, branch `feat/onchain`)

| id   | owner   | status | depends_on | notes                                                                                                                                                                                                             |
| ---- | ------- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ON-1 | onchain | todo   | —          | `create-safe.ts`: deploy a Safe on Base Sepolia, owner EOA from env, threshold 1. Writable now; needs HUMAN-3 to actually run                                                                                     |
| ON-2 | onchain | todo   | ON-1       | `enable-allowance.ts`: enable the Allowance Module, add the hot wallet as delegate, USDC allowance = `DAILY_CAP`, `resetTimeMin = 1440`                                                                           |
| ON-3 | onchain | todo   | ON-2       | Export `topUpHotWallet(amount)` and `getAllowanceState()` from `src/index.ts`. **guard-core GC-5 consumes this** — tell them when the signature is stable                                                         |
| ON-4 | onchain | todo   | ON-2       | `kill.ts`: build and optionally execute a Safe tx setting the allowance to 0 and removing the delegate                                                                                                            |
| ON-5 | onchain | todo   | ON-2       | `status.ts`: print Safe balance, delegate, allowance, spent, next reset                                                                                                                                           |
| ON-6 | onchain | todo   | HUMAN-2    | Foundry fork tests: delegate pulls up to the cap; `cap + 1` reverts; allowance refills after reset; nothing can be pulled after kill                                                                              |
| ON-7 | onchain | todo   | ON-1..ON-6 | Finalize `README.md` with exact commands; `.env.example` is already scaffolded                                                                                                                                    |
| ON-8 | onchain | todo   | —          | Read the Allowance Module address from the official Safe deployment list and USDC from Circle's, for Base Sepolia **and** Base mainnet, and report both in `/CHANGES_REQUESTED.md` with source links. Never guess |

## Session 2 — guard-core (`packages/guard-core`, branch `feat/guard-core`)

| id    | owner      | status  | depends_on  | notes                                                                                                                                                                              |
| ----- | ---------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GC-1  | guard-core | todo    | —           | Policy engine: pure `evaluate(intent, policy, spentToday)`. Default deny. Coverage >= 90% on `src/domain/`                                                                         |
| GC-2  | guard-core | todo    | —           | Simulation before signing: `eth_call` / viem, Tenderly when `TENDERLY_*` is set. Must raise `SIM_UNEXPECTED_EFFECT`, `APPROVAL_DETECTED`, `PERMIT_DETECTED`, `DELEGATION_DETECTED` |
| GC-3  | guard-core | todo    | —           | x402 client on the official TS SDK **>= 2.28.0** with spend controls on. Verify the current API in the official docs first                                                         |
| GC-4  | guard-core | todo    | GC-1, GC-2  | `POST /v1/agent/transfer` through the same pipeline, sending from the hot wallet                                                                                                   |
| GC-5  | guard-core | blocked | ON-3        | Top up the hot wallet when its balance is short. Build it behind an interface and mock it until ON-3 lands — do not stay blocked                                                   |
| GC-6  | guard-core | todo    | GC-1        | Approval flow: save as `pending_approval`, send the HMAC-signed webhook, handle `POST /v1/bot/decision`, expire after 10 min with `APPROVAL_TIMEOUT`. Bot side is BOT-1            |
| GC-7  | guard-core | todo    | GC-9        | Admin endpoints: pause, resume, kill, policy GET/PUT                                                                                                                               |
| GC-8  | guard-core | todo    | GC-1        | Fastify API exactly as in SPEC, zod on every input, per-role bearer auth, rate limiting                                                                                            |
| GC-9  | guard-core | todo    | —           | Drizzle + SQLite: `agents`, `policies`, `intents`, `audit_log`, `daily_spend`                                                                                                      |
| GC-10 | guard-core | todo    | GC-1..GC-4  | Tests: policy edge cases, every reject code, malicious 402 responses (whole balance, wrong asset, wrong network, approval disguised as payment, `payTo` mismatch), replayed intent |
| GC-11 | guard-core | todo    | GC-1..GC-10 | Finalize `README.md`; `pnpm dev` starts the API                                                                                                                                    |

## Session 3 — mcp (`packages/mcp-server`, branch `feat/mcp`)

| id    | owner | status | depends_on | notes                                                                                                     |
| ----- | ----- | ------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| MCP-1 | mcp   | todo   | —          | MCP server on the official SDK, stdio + streamable HTTP                                                   |
| MCP-2 | mcp   | todo   | MCP-1      | The four SPEC tools. USD -> USDC atomic units with bigint math; reject negative, `NaN`, too many decimals |
| MCP-3 | mcp   | todo   | MCP-2      | Wrap `paid_fetch` responses as untrusted content, never as instructions                                   |
| MCP-4 | mcp   | todo   | —          | Env config: `GUARD_URL`, `AGENT_ID`, `AGENT_TOKEN`. No keys, no policy logic in this package              |
| MCP-5 | mcp   | todo   | MCP-2      | Tests against a mocked guard-core (msw or a small Fastify mock)                                           |
| MCP-6 | mcp   | todo   | MCP-2      | README: config JSON for Claude Desktop / Claude Code and other MCP clients                                |
| MCP-7 | mcp   | todo   | MCP-2      | `examples/demo-agent`: a small agent paying a test x402 API through the server. A real run needs INT-3    |

## Session 4 — bot (`packages/telegram-bot`, branch `feat/bot`)

| id    | owner | status | depends_on   | notes                                                                                                                                                                             |
| ----- | ----- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOT-1 | bot   | todo   | —            | `POST /hooks/approval-request`: verify `X-Guard-Signature` with a constant-time compare, reject stale and duplicate requests                                                      |
| BOT-2 | bot   | todo   | BOT-1        | Approval message: agent, USD amount, recipient (short, full on tap), domain, agent reason labelled "agent says:", simulation summary, expiry, `[Approve]` `[Reject]`              |
| BOT-3 | bot   | todo   | BOT-2        | Button press -> `POST /v1/bot/decision`. Only `OWNER_TELEGRAM_IDS` may act. Edit the message after a decision, drop the buttons, handle expired intents. A live run needs HUMAN-4 |
| BOT-4 | bot   | todo   | BOT-1        | Owner commands: `/status`, `/budget <agentId>`, `/pause <agentId>`, `/resume <agentId>`, `/kill` (confirm, then `/v1/admin/kill`, then show the Safe tx the owner must sign)      |
| BOT-5 | bot   | todo   | BOT-1        | Notify on executed payments >= `NOTIFY_ABOVE_AMOUNT` and on every `APPROVAL_DETECTED` / `PERMIT_DETECTED` / `DELEGATION_DETECTED` rejection                                       |
| BOT-6 | bot   | todo   | BOT-1..BOT-5 | Tests with a mocked Telegram API and a mocked guard-core                                                                                                                          |
| BOT-7 | bot   | todo   | BOT-1..BOT-6 | Finalize `README.md`                                                                                                                                                              |

## Session 5 — integrator (`packages/shared`, `/e2e`, branch `feat/integrator`)

| id    | owner      | status  | depends_on                | notes                                                                                                                                                                                                             |
| ----- | ---------- | ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-1 | integrator | todo    | ON-8                      | Own `packages/shared`. `types.ts` and `constants.ts` were transcribed from SPEC by the manager to unblock sessions 2–4 — review them, add `schemas.ts` (zod), and fill `addresses.ts` from ON-8's verified values |
| INT-2 | integrator | todo    | —                         | Resolve `/CHANGES_REQUESTED.md` after owner approval; bump the SPEC version and list what changed                                                                                                                 |
| INT-3 | integrator | blocked | ON-3, GC-11, MCP-2, BOT-3 | Replace mocks with the real packages; one `pnpm dev:all` (or docker-compose) runs guard-core, telegram-bot and mcp-server against Base Sepolia                                                                    |
| INT-4 | integrator | blocked | INT-3                     | E2E: happy path under threshold; over threshold approved; rejected; timed out; kill switch with allowance at 0                                                                                                    |
| INT-5 | integrator | blocked | INT-3                     | Attack suite — every case in `e2e/README.md` must be blocked with the correct reject code                                                                                                                         |
| INT-6 | integrator | blocked | INT-3                     | Security review: secret handling, logs free of keys, auth on every endpoint, rate limits, dependency audit, x402 SDK >= 2.28.0 in the lockfile                                                                    |
| INT-7 | integrator | todo    | INT-4, INT-5, INT-6       | Write `/LAUNCH.md`: mainnet beta with low caps, deploy, secrets manager, bug bounty, incident runbook, landing page and MCP docs                                                                                  |
| INT-8 | integrator | blocked | INT-4..INT-7              | Final report: what works, test results, known risks, what must happen before raising caps                                                                                                                         |

## Interface drift watchlist (manager checks every round)

- `PayIntent` / `Policy` shape in `packages/shared/src/types.ts` vs SPEC
- guard-core routes and status codes vs the SPEC HTTP API section
- webhook body and `X-Guard-Signature` scheme: GC-6 vs BOT-1
- reject codes used anywhere vs the SPEC list
- MCP tool names and inputs vs the SPEC MCP section
- x402 SDK version `>= 2.28.0` in the lockfile
