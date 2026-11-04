# Final report (INT-9)

> **DRAFT, 2026-11-04, against `main` at `5b377a2`.** Not the final report. It closes once Base has
> run live (HUMAN-12), the Ledger path has run on real hardware, and the owner has answered D1–D6 in
> `LAUNCH.md`. Until then, every "open" below is open.

AgentGuard puts a policy, a simulation and an owner on Telegram between an AI agent and its money.
The agent never holds a key. It asks guard-core, through MCP, to pay. guard-core checks the request
against the owner's policy and simulates it. Above a threshold it asks the owner. Only then does it
sign with a hot wallet that can draw no more than a daily cap set onchain.

## What works

| Area                    | Solana                                                                    | Base                                                                       |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Onchain cap             | Squads v4 spending limit, hot wallet as the only destination              | Safe Allowance Module 0.1.1. The delegate can send to any address (risk 1) |
| Cap proven              | LiteSVM against the real program: cap, cap + 1, daily refill, after kill  | Foundry, on a Base mainnet fork with the official module (EVM-6)           |
| Transfer and x402       | Live on devnet (HUMAN-11): a transfer and two x402 payments, one approved | Stub chain only (INT-6). The live run waits on HUMAN-12                    |
| Attack suite            | 24 cases, stub and devnet (INT-5)                                         | 15 cases on the stub chain (INT-6)                                         |
| Signing gate            | Transaction inspection, then a simulation of the exact transfer           | `TransferWithAuthorization` only, every field checked; `eth_simulateV1`    |
| Kill                    | The spending limit is removed, signed by the owner                        | `removeDelegate(hot, true)`, proven on the fork                            |
| Owner signs with Ledger | Built, proven against a fake device (SVM-9)                               | Built (EVM-9, #41), proven against a fake device. Real hardware is open    |

Across both chains, guard-core has:

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
- attack alerts are throttled.

The MCP server exposes four tools: `transfer`, `paid_fetch`, `check_intent` and `get_budget`. Content
returned by `paid_fetch` is marked as data, not instructions.

## Test results

`pnpm check` (lint, typecheck, tests) on `5b377a2`, all passing:

| Package      | Tests   |
| ------------ | ------- |
| guard-core   | 269     |
| telegram-bot | 105     |
| mcp-server   | 123     |
| onchain      | 159     |
| e2e          | 53      |
| **Total**    | **709** |

Coverage on guard-core's `domain/` meets the 90% threshold. CI also runs:

- the Foundry tests for `packages/onchain`;
- a probe that the public Base Sepolia RPC supports `eth_simulateV1`.

Two mutations of the guard each made the e2e suite fail, so it detects real regressions.

What only a person ran, recorded in `coordination/HUMAN_TODO.md`:

- HUMAN-11, the full stack on Solana devnet with real Telegram;
- the devnet attack cases in INT-5.

## Known risks

1. **On Base, a stolen hot key can send the day's cap to any address** without guard-core seeing
   it. On Solana it can only move the cap into the hot wallet. The loss bound is the same
   (cap + hot wallet balance), but the path differs. This bears on D6.
2. **The Base hot key is read raw from the environment** (`HOT_WALLET_PRIVATE_KEY`). Solana's comes
   from a file. Open until the owner decides D5 (`docs/security-review.md`).
3. **The Ledger message hash is unproven on real hardware.** If the formula does not match the
   Solana app, the owner would see a mismatch on every signature, including the kill. This is a
   launch blocker (`LAUNCH.md`).
4. **Rate limits count per socket address.** guard-core, the bot hooks and the MCP HTTP endpoint
   each have one, but behind a proxy every client shares the proxy's address. The host chosen in
   HUMAN-7 needs its own per-client limit in front.
5. **Single process, in-memory rate limits, SQLite.** This is fine for one guard. The database must
   be on a persistent volume, or the day's spend resets on redeploy. guard-core refuses to start on
   mainnet with an unsafe database location.
6. **Not reachable from runtime, but in the lockfile:** one high-severity advisory (`bigint-buffer`,
   through `@solana/spl-token`, no patch) and several moderate ones. Each is triaged in
   `docs/security-review.md`.
7. **Prompt injection through paid content** is limited, not solved. Tool output marks it as data,
   and every payment still needs the policy and, above the threshold, the owner. A model that ignores
   the marking can still ask to pay. It cannot pay more than the policy allows.

## Before raising caps

Start mainnet with a low cap (D1), and raise it only after each of these holds:

- [ ] The Ledger path runs on real hardware on devnet: hashes match, and the kill lands (`LAUNCH.md`).
- [ ] The kill has been rehearsed end to end on mainnet with a small cap, timed from the Telegram
      `/kill` to the transaction confirming.
- [ ] The hot key is in the secrets manager (D5), delivered as a file, on both chains.
- [ ] The deployment review is done (TLS, what fronts each service, the persistent volume, backups).
- [ ] A week on mainnet at the starting cap, with no unexplained intent in the audit log and no
      alert the owner could not account for.
- [ ] For Base: HUMAN-12 has passed, the Base addresses in `shared/addresses.ts` are confirmed
      (CR-005), and the owner has accepted risk 1 in writing (D6).
- [ ] The owner's written go-ahead (HUMAN-8).
