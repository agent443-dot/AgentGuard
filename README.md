# AgentGuard

A security layer between AI agents and their wallets. An agent can only pay through AgentGuard: every
payment is checked against a policy, simulated, and then auto-approved, sent to the owner on Telegram
for approval, or rejected.

Funds stay in the owner's **Safe**. The onchain spend limit is enforced by the audited **Safe Allowance
Module** — there is no custom contract in v0.1. The agent never holds a key: the Guard service signs,
and only after the checks pass.

```
Owner Safe (holds funds)
  └─ Safe Allowance Module: delegate = Guard hot wallet, token = USDC, dailyCap, resetTimeMin = 1440
       └─ Guard hot wallet (small balance, key held ONLY by guard-core)
            └─ pays x402 APIs / transfers, after policy + simulation + (optional) human approval
```

Maximum loss per day is capped onchain at `dailyCap` plus whatever sits in the hot wallet, even if the
offchain Guard has a bug.

## Read these first

- [`SPEC.md`](./SPEC.md) — the source of truth for all interfaces. Do not change it without owner approval.
- [`CLAUDE.md`](./CLAUDE.md) — rules every contributor (human or AI) follows: roles, language, coordination, code standards.
- [`coordination/BOARD.md`](./coordination/BOARD.md) — the task board: who owns what, what is blocked.
- [`docs/adr/`](./docs/adr) — architecture decisions.

## Packages

| Package                                            | Owner      | What it does                                                 |
| -------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| [`packages/shared`](./packages/shared)             | integrator | Types, zod schemas, verified addresses, constants            |
| [`packages/onchain`](./packages/onchain)           | Session 1  | Safe + Allowance Module scripts, Foundry fork tests          |
| [`packages/guard-core`](./packages/guard-core)     | Session 2  | Policy engine, simulation, signer, x402 client, HTTP API, DB |
| [`packages/mcp-server`](./packages/mcp-server)     | Session 3  | MCP server exposing payment tools to agents                  |
| [`packages/telegram-bot`](./packages/telegram-bot) | Session 4  | Owner approvals and kill switch                              |
| [`e2e`](./e2e)                                     | integrator | End-to-end and attack tests                                  |

## Getting started

Requires Node 20+ (see `.nvmrc`) and pnpm 10.

```bash
pnpm install
pnpm check        # lint + typecheck + test
```

On Windows, develop inside **WSL2 + Ubuntu** and clone the repo into the Linux filesystem (`~`), not
`/mnt/c`. Foundry's installer does not run in PowerShell or Cmd, and pnpm and git are far slower across
the `/mnt/c` boundary.

Per-package commands: `pnpm --filter @agentguard/guard-core test`.

`packages/onchain` also needs [Foundry](https://getfoundry.sh) for the fork tests (`forge test`).

## Status

Scaffold. The packages are empty skeletons; implementation is tracked in
[`coordination/BOARD.md`](./coordination/BOARD.md).
