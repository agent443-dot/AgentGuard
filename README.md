# AgentGuard

A security layer between AI agents and their wallets. An agent can only pay through AgentGuard: every
payment is checked against a policy, simulated, and then auto-approved, sent to the owner on Telegram
for approval, or rejected.

Funds stay in a vault the owner alone controls: a **Squads multisig** on Solana, a **Safe** on EVM
chains. An audited onchain spend limit lets the guard's hot wallet draw at most a daily cap from it:
the Squads Spending Limit on Solana, the Safe Allowance Module on EVM chains. There is no custom
contract. The agent never holds a key: guard-core signs, and only after the checks pass. The owner
approves and kills from Telegram, and signs vault changes in Phantom.

```
Owner vault (Squads multisig or Safe, owned by the owner's Phantom wallet)
  └─ onchain daily cap: delegate = guard hot wallet, token = the chain's dollar, 24h period
       └─ guard hot wallet (small balance, key held ONLY by guard-core)
            └─ pays x402 APIs / transfers, after policy + simulation + (optional) human approval
```

The most a day can cost is capped onchain at the daily cap plus whatever sits in the hot wallet,
even if the offchain guard has a bug.

Launch chains: Solana and Robinhood Chain mainnet (USDG). Base Sepolia is for development, and Base
mainnet comes next.

**Run your own:** [`docs/self-host.md`](./docs/self-host.md). **Connect an agent:** "For agent
builders" in [`packages/mcp-server/README.md`](./packages/mcp-server/README.md). **Report a
vulnerability:** [`SECURITY.md`](./SECURITY.md).

## Read these first

- [`SPEC.md`](./SPEC.md) — the source of truth for all interfaces. Do not change it without owner approval.
- [`CLAUDE.md`](./CLAUDE.md) — rules every contributor (human or AI) follows: roles, language, coordination, code standards.
- [`coordination/BOARD.md`](./coordination/BOARD.md) — the task board: who owns what, what is blocked.
- [`docs/adr/`](./docs/adr) — architecture decisions.

## Packages

| Package                                            | Owner      | What it does                                                 |
| -------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| [`packages/shared`](./packages/shared)             | integrator | Types, zod schemas, verified addresses, constants            |
| [`packages/onchain`](./packages/onchain)           | Session 1  | Squads and Safe adapters, signing page, fork tests           |
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

### Running the whole stack

`pnpm dev:all` starts guard-core (:8787), telegram-bot (:8788) and mcp-server over HTTP (:8789). It
first cross-checks the three `.env` files and refuses to start if they disagree: a webhook secret or
token that differs between guard-core and the bot, a service pointed at the wrong port, or no agent.

1. Copy each `packages/<name>/.env.example` to `.env`. Generate every secret with
   `openssl rand -hex 32`. Give guard-core's `BOT_WEBHOOK_SECRET`, `BOT_TOKEN` and `ADMIN_TOKEN` to
   the bot as `BOT_WEBHOOK_SECRET`, `GUARD_BOT_TOKEN` and `GUARD_ADMIN_TOKEN`.
2. Create an agent: `pnpm --filter @agentguard/guard-core create-agent agent-1`. Put the printed
   token in mcp-server's `AGENT_TOKEN`. In mcp-server's `.env`, set `MCP_TRANSPORT=http` and an
   `MCP_HTTP_TOKEN`.
3. Set the agent's policy with `PUT /v1/admin/policy/agent-1`. A new agent's policy denies
   everything.
4. `pnpm dev:all`.

With `GUARD_STUB_CHAINS=true`, guard-core runs on an offline chain that signs nothing. For Solana
devnet, set `SOLANA_RPC_URL`, `SOLANA_HOT_WALLET_KEYPAIR` and `SQUADS_MULTISIG` instead. Without
them every payment is refused. Agent clients that start the MCP server themselves over stdio don't
need it in `dev:all`; see [`packages/mcp-server`](./packages/mcp-server).

On Windows, develop inside **WSL2 + Ubuntu** and clone the repo into the Linux filesystem (`~`), not
`/mnt/c`. Foundry's installer does not run in PowerShell or Cmd, and pnpm and git are far slower across
the `/mnt/c` boundary.

### Branches

`main` is the base: every role branches off it as `feat/<role>` and opens its PR back to it.

The repository's default branch is still `claude/agentguard-setup-smlps6`, because GitHub adopts the
first branch pushed to an empty repository and only an account with admin rights can change that. So a
plain `git clone` lands on the wrong branch. Until the default is switched, clone with `main` explicit:

```bash
git clone -b main https://github.com/kikume/AgentGuard.git
```

In a clone you already have, `git checkout main` is enough — the two branches currently point at the
same commit.

Per-package commands: `pnpm --filter @agentguard/guard-core test`.

`packages/onchain` also needs [Foundry](https://getfoundry.sh) for the fork tests (`forge test`).

## Status

Pre-launch. A real-money pilot ran on Robinhood Chain mainnet on 2026-11-09, end to end: a Safe, an
allowance, an x402 payment and the kill. Solana ran on devnet the same way, and its mainnet setup is
next. Open work, and what has to
happen before caps go up, are in [`LAUNCH.md`](./LAUNCH.md). The task board is
[`coordination/BOARD.md`](./coordination/BOARD.md). AI sessions build this repository under the rules
in [`CLAUDE.md`](./CLAUDE.md), and `coordination/` is their shared workspace.

## License

[Apache-2.0](./LICENSE).
