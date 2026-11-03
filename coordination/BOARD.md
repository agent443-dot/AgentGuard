# AgentGuard task board

Statuses: `todo` | `doing` | `blocked` | `review` | `done`.
Update **only your own rows**. To flag something on someone else's row, add a note or send a message to
their inbox (`coordination/messages/<owner>/`).

`HUMAN-n` dependencies are items in [`HUMAN_TODO.md`](./HUMAN_TODO.md) that only the human owner can do.

Target: [`/SPEC.md`](../SPEC.md) v0.2 — **Solana first, then Base**, both in v0.1. See
[ADR 002](../docs/adr/002-two-chains.md) for why.

## Can start right now (no human input needed)

`SVM-1`, `SVM-7`, `EVM-7`, `GC-2`, `GC-3`, `MCP-1`, `MCP-4`, `BOT-1`, `INT-1`.

`ON-0`, `GC-1` and `GC-9` are done.

The Base adapter (`EVM-*`) is deliberately held until the Solana attack suite is green: proving it once
tells us what the second adapter has to satisfy.

## manager

| id    | owner   | status | depends_on | notes                                                                                                                     |
| ----- | ------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| MGR-1 | manager | done   | —          | Repo bootstrap: pnpm workspace, strict tsconfig, ESLint/Prettier, vitest, CI, package skeletons, `coordination/`, ADR-001 |
| MGR-2 | manager | done   | MGR-1      | Board and `HUMAN_TODO.md`                                                                                                 |
| MGR-3 | manager | doing  | —          | Coordination rounds: read every inbox, unblock, route questions, detect drift against SPEC                                |
| MGR-4 | manager | done   | —          | CR-001 presented and applied: SPEC v0.2, two chains, ADR-002                                                              |

## Session 1 — onchain (`packages/onchain`, branch `feat/onchain`)

| id   | owner   | status | depends_on | notes                                                                                                                                                                                                         |
| ---- | ------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ON-0 | onchain | todo   | —          | `ChainAdapter.ts`: the interface in SPEC §ChainAdapter. No chain SDK imports. Landed; `simulate` returns `SimulationOutcome` (SPEC v0.2.1) because the per-chain checks produce reject codes the caller needs |

### Solana (Squads v4)

| id    | owner   | status  | depends_on | notes                                                                                                                                                                                                                                                                                    |
| ----- | ------- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVM-1 | onchain | done    | —          | `create-multisig.ts`. Multisig `3UUSmTssQT7xAnH7SKiStPyy1Tn2SUqUM53Ns7XnUcVu` live on devnet. Refuses to run when `SQUADS_MULTISIG` is already set                                                                                                                                       |
| SVM-2 | onchain | blocked | SVM-1      | `add-spending-limit.ts`: add a Spending Limit with the guard hot wallet as the designated member, USDC mint, `DAILY_CAP`, daily period. Set the destination whitelist if it does not fight the x402 flow — part of our offchain allowlist is enforceable onchain here                    |
| SVM-3 | onchain | blocked | SVM-2      | Implement `ChainAdapter` for Solana: `getAllowanceState`, `topUpHotWallet`, `getHotWalletBalance`, `send`. **GC-5 consumes this**                                                                                                                                                        |
| SVM-4 | onchain | blocked | SVM-2      | `kill.ts`: the owner tx that zeroes the limit and removes the member                                                                                                                                                                                                                     |
| SVM-5 | onchain | done    | SVM-2      | `status.ts`: multisig threshold, members and config authority, vault USDC, and the spending limit cap, spent, reset time, members and destinations, all read back from the chain                                                                                                         |
| SVM-6 | onchain | blocked | ON-0       | `simulate()` for Solana: `simulateTransaction` plus the instruction checks behind `DELEGATE_DETECTED`, `AUTHORITY_CHANGE_DETECTED`, `ACCOUNT_CLOSE_DETECTED`, `UNKNOWN_PROGRAM_DETECTED`, `HIDDEN_ACCOUNTS_DETECTED`. Design against the Solana threat model; do not port the EVM checks |
| SVM-7 | onchain | doing   | —          | **Done:** USDC mint for devnet and mainnet from Circle, Squads v4 program id from the official SDK, all in `shared/addresses.ts` with sources. **Left:** the Solana genesis hashes behind the CAIP-2 ids, which need a cluster `getGenesisHash` this container cannot reach              |
| SVM-8 | onchain | blocked | SVM-3      | Tests (LiteSVM or `solana-test-validator`): the member can pull up to the limit in a period; limit + 1 fails; the limit refills after the period; after kill nothing can be pulled                                                                                                       |

### Base (Safe + Allowance Module)

| id    | owner   | status  | depends_on | notes                                                                                                                                                                                          |
| ----- | ------- | ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EVM-1 | onchain | blocked | INT-5      | `create-safe.ts`: deploy a Safe on Base Sepolia, owner EOA from env, threshold 1                                                                                                               |
| EVM-2 | onchain | blocked | EVM-1      | `enable-allowance.ts`: enable the Allowance Module, add the hot wallet as delegate, USDC allowance = `DAILY_CAP`, `resetTimeMin = 1440`                                                        |
| EVM-3 | onchain | blocked | EVM-2      | Implement `ChainAdapter` for EVM                                                                                                                                                               |
| EVM-4 | onchain | blocked | EVM-2      | `kill.ts` and `status.ts` for the Safe                                                                                                                                                         |
| EVM-5 | onchain | blocked | ON-0       | `simulate()` for EVM: `APPROVAL_DETECTED`, `PERMIT_DETECTED`, `DELEGATION_DETECTED`                                                                                                            |
| EVM-6 | onchain | blocked | EVM-3      | Foundry fork tests on Base Sepolia: delegate pulls up to the cap; `cap + 1` reverts; refills after reset; nothing after kill                                                                   |
| EVM-7 | onchain | todo    | —          | Read the Allowance Module address from the official Safe deployment list and USDC from Circle's, for Base and Base Sepolia, and report in `/CHANGES_REQUESTED.md`. Needs no funds, can run now |

## Session 2 — guard-core (`packages/guard-core`, branch `feat/guard-core`)

| id    | owner      | status | depends_on  | notes                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ---------- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GC-1  | guard-core | todo   | —           | Policy engine: pure `evaluate(intent, policy, spentToday)`. Default deny. Chain-agnostic — it compares CAIP-2 strings and opaque addresses. Coverage >= 90% on `src/domain/`                                                                                                                                                                                                |
| GC-2  | guard-core | todo   | ON-0        | Simulation gate: call `ChainAdapter.simulate` and reject unless the effect is a single USDC transfer of the exact amount to the exact recipient. The per-chain detection lives in the adapters (SVM-6, EVM-5); the gate here is chain-agnostic                                                                                                                              |
| GC-3  | guard-core | doing  | ON-0        | x402 client. `@x402/core`, `@x402/svm` and `@x402/evm` are all at 2.29.0, above the floor, and the SDK's `Network` type is CAIP-2 so chain ids match ours with no conversion. **Done:** `domain/x402.ts` picks an acceptable offer and catches terms moving between the quote and the retry, 23 tests. **Left:** wire the SDK transport, sign through `ChainAdapter`, retry |
| GC-4  | guard-core | todo   | GC-1, GC-2  | `POST /v1/agent/transfer` through the same pipeline                                                                                                                                                                                                                                                                                                                         |
| GC-5  | guard-core | todo   | SVM-3       | Top up the hot wallet when short, via `ChainAdapter.topUpHotWallet`. Build against `ON-0` with a stub adapter and do not wait for SVM-3                                                                                                                                                                                                                                     |
| GC-6  | guard-core | done   | GC-1        | Approval flow. The intent is persisted before the webhook goes out, so a bot that never answers still leaves something for the sweep to close. A late approval expires rather than consenting: the figures the owner saw may be stale. `POST /v1/bot/decision` with 409 on a second decision. 14 tests                                                                      |
| GC-7  | guard-core | todo   | GC-9        | Admin endpoints: pause, resume, kill, policy GET/PUT. `kill` prepares the owner tx for **every** chain                                                                                                                                                                                                                                                                      |
| GC-8  | guard-core | doing  | —           | Fastify API, zod on every input, per-role bearer auth, rate limiting. **Done:** server, error handler, agent and admin routes, 16 route tests including role separation and cross-agent access. **Left:** the payment routes, which land with GC-4 and GC-6                                                                                                                 |
| GC-9  | guard-core | todo   | —           | Drizzle + SQLite: `agents`, `policies`, `intents`, `audit_log`, `daily_spend`. Intents carry a CAIP-2 chain                                                                                                                                                                                                                                                                 |
| GC-10 | guard-core | todo   | GC-1..GC-4  | Tests: policy edge cases, every reject code, malicious 402 responses (whole balance, wrong asset, wrong network, approval disguised as payment, `payTo` mismatch), replayed intent                                                                                                                                                                                          |
| GC-11 | guard-core | todo   | GC-1..GC-10 | Finalize README; `pnpm dev` starts the API. One hot wallet key per chain in env                                                                                                                                                                                                                                                                                             |

## Session 3 — mcp (`packages/mcp-server`, branch `feat/mcp`)

| id    | owner | status | depends_on | notes                                                                                                                                           |
| ----- | ----- | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP-1 | mcp   | todo   | —          | MCP server on the official SDK, stdio + streamable HTTP                                                                                         |
| MCP-2 | mcp   | todo   | MCP-1      | The four SPEC tools. USD -> USDC atomic units with bigint math; reject negative, `NaN`, too many decimals. `transfer` takes an optional `chain` |
| MCP-3 | mcp   | todo   | MCP-2      | Wrap `paid_fetch` responses as untrusted content, never as instructions                                                                         |
| MCP-4 | mcp   | todo   | —          | Env config: `GUARD_URL`, `AGENT_ID`, `AGENT_TOKEN`. No keys, no policy logic here                                                               |
| MCP-5 | mcp   | todo   | MCP-2      | Tests against a mocked guard-core                                                                                                               |
| MCP-6 | mcp   | todo   | MCP-2      | README: config JSON for Claude Desktop / Claude Code and other MCP clients                                                                      |
| MCP-7 | mcp   | todo   | MCP-2      | `examples/demo-agent` paying a test x402 API. A real run needs INT-3                                                                            |

## Session 4 — bot (`packages/telegram-bot`, branch `feat/bot`)

| id    | owner | status | depends_on   | notes                                                                                                                                                                                                                                                                                      |
| ----- | ----- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BOT-1 | bot   | todo   | —            | `POST /hooks/approval-request`: verify `X-Guard-Signature` with a constant-time compare, reject stale and duplicate requests                                                                                                                                                               |
| BOT-2 | bot   | todo   | BOT-1        | Approval message: agent, USD amount, **chain**, recipient (short, full on tap), domain, agent reason labelled "agent says:", simulation summary, expiry, `[Approve]` `[Reject]`                                                                                                            |
| BOT-3 | bot   | todo   | BOT-2        | Button press -> `POST /v1/bot/decision`. Only `OWNER_TELEGRAM_IDS` may act. Edit the message, drop the buttons, handle expired intents. A live run needs HUMAN-5                                                                                                                           |
| BOT-4 | bot   | todo   | BOT-1        | Commands: `/status`, `/budget <agentId>`, `/pause <agentId>`, `/resume <agentId>`, `/kill` (confirm, then `/v1/admin/kill`, then show the owner tx **per chain**)                                                                                                                          |
| BOT-5 | bot   | todo   | BOT-1        | Notify on executed payments >= `NOTIFY_ABOVE_AMOUNT` and on every per-chain attack code: `APPROVAL_DETECTED`, `PERMIT_DETECTED`, `DELEGATION_DETECTED`, `DELEGATE_DETECTED`, `AUTHORITY_CHANGE_DETECTED`, `ACCOUNT_CLOSE_DETECTED`, `UNKNOWN_PROGRAM_DETECTED`, `HIDDEN_ACCOUNTS_DETECTED` |
| BOT-6 | bot   | todo   | BOT-1..BOT-5 | Tests with a mocked Telegram API and a mocked guard-core                                                                                                                                                                                                                                   |
| BOT-7 | bot   | todo   | BOT-1..BOT-6 | Finalize README                                                                                                                                                                                                                                                                            |

## Session 5 — integrator (`packages/shared`, `/e2e`, branch `feat/integrator`)

| id    | owner      | status  | depends_on                 | notes                                                                                                                                                                                                                                     |
| ----- | ---------- | ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-1 | integrator | todo    | SVM-7, EVM-7               | Own `packages/shared`. Types, constants and addresses were updated to SPEC v0.2 by the manager — review them, add `schemas.ts` (zod), fill `addresses.ts`, and **unmark the Solana CAIP-2 values** once SVM-7 confirms the genesis hashes |
| INT-2 | integrator | todo    | —                          | Resolve `/CHANGES_REQUESTED.md` after owner approval; bump the SPEC version and list what changed                                                                                                                                         |
| INT-3 | integrator | blocked | SVM-3, GC-11, MCP-2, BOT-3 | Replace stubs with the real adapters; one `pnpm dev:all` runs guard-core, telegram-bot and mcp-server against Solana devnet                                                                                                               |
| INT-4 | integrator | blocked | INT-3                      | E2E on Solana: happy path under threshold; over threshold approved; rejected; timed out; kill switch with the limit at 0                                                                                                                  |
| INT-5 | integrator | blocked | INT-4                      | Attack suite on Solana — every case in `e2e/README.md` blocked with the correct reject code. **This gate releases the `EVM-*` tasks**                                                                                                     |
| INT-6 | integrator | blocked | INT-5                      | Repeat INT-3..INT-5 for Base once the EVM adapter lands                                                                                                                                                                                   |
| INT-7 | integrator | blocked | INT-5                      | Security review: secret handling, logs free of keys, auth on every endpoint, rate limits, dependency audit, x402 SDK versions in the lockfile                                                                                             |
| INT-8 | integrator | todo    | INT-5, INT-7               | Write `/LAUNCH.md`: mainnet beta with low caps, deploy, secrets manager, bug bounty, incident runbook, landing page and MCP docs                                                                                                          |
| INT-9 | integrator | blocked | INT-6, INT-8               | Final report: what works, test results, known risks, what must happen before raising caps                                                                                                                                                 |

## Interface drift watchlist (manager checks every round)

- `PayIntent` / `Policy` in `packages/shared/src/types.ts` vs SPEC v0.2 — above all, that no package has
  reintroduced `0x${string}` or a numeric chain id
- `ChainAdapter` as implemented in `svm/` and `evm/` vs the interface in SPEC
- guard-core routes and status codes vs the SPEC HTTP API section
- webhook body and `X-Guard-Signature` scheme: GC-6 vs BOT-1
- reject codes used anywhere vs the SPEC lists, and that chain-specific codes stay in their adapter
- MCP tool names and inputs vs the SPEC MCP section
- x402 SDK versions in the lockfile: `@x402/svm` for Solana, `>= 2.28.0` for EVM
