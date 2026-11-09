# Final report (INT-9)

> **Final, 2026-11-09.** Written for the launch of the open-source, self-hosted release (D7, D8),
> with Robinhood Chain and Solana live that day (D6). Base comes later. Decisions are
> in `LAUNCH.md` §1, and what is still open is in §2.

AgentGuard puts a policy, a simulation and an owner on Telegram between an AI agent and its money.
The agent never holds a key. It asks guard-core, through MCP, to pay. guard-core checks the request
against the owner's policy and simulates it. Above a threshold it asks the owner. Only then does it
sign with a hot wallet that can draw no more than a daily cap set onchain.

Each user runs their own copy (`docs/self-host.md`): their own vault, their own Phantom wallet as its
only owner, their own guard-core and bot, and their own signing page. Nothing in the path belongs to
us.

## What works

| Area              | Robinhood Chain (live)                                      | Solana (live)                                                            | Base (later)                                                                  |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Onchain cap       | Safe Allowance Module 0.1.1. The delegate can send anywhere | Squads v4 spending limit, hot wallet as the only destination             | Safe Allowance Module 0.1.1. The delegate can send anywhere                   |
| Cap proven        | Live on mainnet: the cap set and read back from the chain   | LiteSVM against the real program: cap, cap + 1, daily refill, after kill | Foundry, on a Base mainnet fork with the official module (EVM-6)              |
| Transfer and x402 | Live on mainnet: 0.50 USDG paid over x402 (HUMAN-21)        | Live on devnet (HUMAN-11), and again from an empty hot wallet (HUMAN-13) | Live on Base Sepolia (HUMAN-13): auto, approved, and from an empty hot wallet |
| Attack suite      | 15 cases on the stub chain (INT-6)                          | 24 cases, stub and devnet (INT-5)                                        | 15 cases on the stub chain (INT-6)                                            |
| Signing gate      | `TransferWithAuthorization` only, every field checked       | Transaction inspection, then a simulation of the exact transfer          | `TransferWithAuthorization` only, every field checked; `eth_simulateV1`       |
| Owner in Phantom  | Create, enable and kill signed on mainnet, through the page | Create, add limit and kill signed on mainnet, through the page           | Not run                                                                       |
| Kill              | `/kill`, then the owner's Phantom kill removed the delegate | `/kill`, then the owner's Phantom kill removed the limit, on mainnet     | `removeDelegate(hot, true)`, proven on the fork                               |

Across all chains, guard-core has:

- a deny-all policy per agent;
- per-transaction and daily limits;
- token, chain, recipient and domain allowlists;
- approvals that expire and are redeemed once;
- an audit log;
- pause and kill.

On the bot:

- only listed owners may act;
- hook requests are HMAC-signed, and replays and stale requests are refused;
- the chain is named in every message, with explorer links;
- kill buttons expire, and attack alerts are throttled.

The MCP server exposes four tools: `transfer`, `paid_fetch`, `check_intent` and `get_budget`. Content
returned by `paid_fetch` is marked as data, not instructions.

The owner signs on a static page they deploy themselves (ADR 003). It builds from `main` only, has a
strict Content-Security-Policy, and reads each result back from the chain.

## Test results

`pnpm test` on the release branch, after the pre-release review's fixes, all passing:

| Package      | Tests   |
| ------------ | ------- |
| guard-core   | 307     |
| onchain      | 218     |
| mcp-server   | 168     |
| telegram-bot | 149     |
| e2e          | 53      |
| **Total**    | **895** |

Coverage on guard-core's `domain/` meets the 90% threshold. CI also runs:

- lint, format and typecheck;
- the Foundry tests for `packages/onchain`;
- the signing page in a real Chromium, with Phantom faked;
- a check that no secret pattern reaches a Docker build context, and that both images build;
- probes of public endpoints: Base Sepolia's `eth_simulateV1`, and the Squads v4 program on Solana
  mainnet, which must be the binary the tests run.

What only a person ran, recorded in `coordination/HUMAN_TODO.md` and `docs/security-review.md`:

- HUMAN-11 and HUMAN-15, the full stack on Solana devnet with real Telegram and Phantom;
- HUMAN-12 and HUMAN-13, the Safe and the full stack on Base Sepolia, from an empty hot wallet;
- HUMAN-21, the Robinhood Chain mainnet pilot with real money, end to end;
- INT-7, the deployed review on Fly: a revoked token refused live, the logs searched for secrets
  across a payment, an approval and a kill, and a backup restored and checked against the live guard.

Live runs found real bugs, each fixed with a test:

- the simulation ran before the top-up, so an empty hot wallet could never pay (#63);
- the bot on Fly was older than `main` and lacked the Robinhood kill button. Deploys now follow CI
  on `main` (#118, #124);
- the bot offered a Phantom kill button for a Solana limit already removed. It now offers one only
  for a limit that still exists (#116);
- a pre-release review of every package found two high and six medium issues, among them a kill
  that did not reach payments already queued, and a Solana kill page that trusted the hot wallet
  in its link. All are fixed with tests; the list is in `docs/security-review.md`.

## Known risks

1. **On the Safe chains, a stolen hot key can send the day's cap to any address** without
   guard-core seeing it. On Solana it can only move the cap into the hot wallet. The loss bound is
   the same (cap + hot wallet balance), but the path differs.
2. **The owner key is in a software wallet** (D4, risk accepted). It can move the whole vault, so
   the vault holds only what the agents need for the coming days. The same Phantom wallet owns both
   vaults.
3. **The signing page is a trust root.** Whoever can redeploy it can show a harmless summary of a
   harmful transaction. Each user deploys their own, from their own protected `main`.
4. **Rate limits count per socket address.** guard-core, the bot hooks and the MCP HTTP endpoint
   each have one, but behind a proxy every client shares the proxy's address.
5. **Single process, in-memory rate limits, SQLite.** This is fine for one guard. The database is on
   a persistent volume with daily snapshots, and guard-core refuses to start on mainnet with an
   unsafe database location. A backup schedule off the volume is still open.
6. **Not reachable from runtime, but in the lockfile:** one high-severity advisory (`bigint-buffer`,
   through `@solana/spl-token`, no patch) and several moderate ones. Each is triaged in
   `docs/security-review.md`.
7. **Prompt injection through paid content** is limited, not solved. Tool output marks it as data,
   and every payment still needs the policy and, above the threshold, the owner. A model that ignores
   the marking can still ask to pay. It cannot pay more than the policy allows.

## Before raising caps

Launch at 20 a day per chain (D1), and go to 50 only after each of these holds:

- [ ] Two to three weeks on mainnet at the starting cap, with no unexplained intent in the audit log
      and no alert the owner could not account for.
- [ ] A backup schedule that copies the database off the Fly volume.
- [ ] The hot keys in a KMS (D5), once the cap rises.
- [ ] For Base: the Base addresses confirmed live (CR-005) and its own pilot, as Robinhood Chain had.
