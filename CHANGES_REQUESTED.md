# Proposed SPEC changes

[`/SPEC.md`](./SPEC.md) is the source of truth and **no session changes it on its own**. If you need a
different interface, a verified address, or a decision that contradicts the SPEC, append a proposal
here. The manager presents it to the owner; only the owner approves; the integrator applies the
approved change and bumps the SPEC version.

Keep each proposal short and specific. Do not edit someone else's entry — add your own below it.

## Template

```markdown
### CR-00n — <short title>

- **From:** <session role>
- **Date:** <YYYY-MM-DD>
- **What:** the exact change, with the current text and the proposed text
- **Why:** what breaks or cannot be built without it
- **Blast radius:** which packages and tasks are affected
- **Status:** proposed | approved | rejected | applied
```

Verified addresses go here too, with a link to the official source, so the integrator can add them to
`packages/shared/src/addresses.ts` (task INT-1). Never guess an address.

---

## Open proposals

### CR-001 — Support Solana and Base; drop Robinhood Chain

- **From:** manager
- **Date:** 2026-11-03
- **Status:** applied to SPEC v0.2 on 2026-11-03
- **Owner decision:** the product targets **Solana and Base**. Robinhood Chain is out of scope.
- **Applied:** SPEC bumped to v0.2 with both chains, CAIP-2 chain ids, opaque address and transaction
  id types, reject codes split into a shared core plus per-chain sets, and `packages/onchain`
  restructured as a `ChainAdapter` interface over `svm/` and `evm/`. `packages/shared` types,
  constants and addresses updated to match. The board was rewritten accordingly.

#### What

Three changes to [`/SPEC.md`](./SPEC.md), which today targets Base alone.

**1. Two chains in scope, each with its own audited spend-limit primitive.**

|                   | Solana                                                                                  | Base (EVM)                                    |
| ----------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| Funds held in     | Squads v4 multisig                                                                      | Safe                                          |
| Onchain daily cap | Squads Spending Limit (per-period, refills each period, optional destination whitelist) | Safe Allowance Module (`resetTimeMin = 1440`) |
| SDK               | `@solana/kit`, `@sqds/multisig`                                                         | viem, `@safe-global/protocol-kit`             |
| x402              | `@x402/svm` + `@x402/core`, scheme `exact` over SPL transfers                           | x402 TS SDK `>= 2.28.0`                       |
| Tests             | LiteSVM or `solana-test-validator`                                                      | Foundry fork tests                            |
| Dev network       | Solana devnet                                                                           | Base Sepolia (84532)                          |
| Launch network    | Solana mainnet-beta                                                                     | Base mainnet (8453)                           |

The money flow is identical in shape on both. A Squads Spending Limit gives a designated member a
per-period withdrawable amount on one token, refilled at the start of each period. That is the same
guarantee the Allowance Module gives: a hard onchain ceiling on daily loss, from an audited program we
do not write. Neither chain needs a contract of ours.

**2. The shared types stop assuming EVM.** With two chains this is mandatory, not a preference, and it
must land before any package writes code against the current types.

| Field                 | Today                 | Proposed                                                       |
| --------------------- | --------------------- | -------------------------------------------------------------- |
| `Policy.chainIds`     | `number[]`            | `chains: string[]`, CAIP-2 (`solana:5eykt4...`, `eip155:8453`) |
| `Policy.tokens`       | `` `0x${string}`[] `` | `string[]` — Solana mints are base58                           |
| `PayIntent.chainId`   | `number`              | `chain: string`, CAIP-2                                        |
| `PayIntent.token`     | `` `0x${string}` ``   | `string`                                                       |
| `PayIntent.recipient` | `` `0x${string}` ``   | `string`                                                       |
| `PayIntent.txHash`    | `` `0x${string}` ``   | `txId?: string` — Solana signatures are base58                 |

`Amount` is unchanged: USDC has 6 decimals on both chains.

**3. `packages/onchain` gets one interface and two implementations.**

```
packages/onchain/src/
  ChainAdapter.ts     the interface guard-core depends on:
                      topUpHotWallet, getAllowanceState, buildKillTx, getStatus
  svm/                Squads v4 implementation
  evm/                Safe + Allowance Module implementation
```

`guard-core` imports only `ChainAdapter`, never a chain SDK directly. That keeps the policy engine and
the HTTP API chain-agnostic and lets the second chain land without touching them.

#### Why

- The owner states the users are on Solana, and wants Base supported as well.
- Both chains have a mature, audited spend-limit primitive and working x402 support, so the security
  argument that lets us launch with real money holds on both.
- Nothing is lost by changing now: no product code exists yet. Changing the types after four sessions
  have built on them would touch every package at once.

#### Blast radius

| Package                 | Effect                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/onchain`      | Restructured into `ChainAdapter` + `svm/` + `evm/`. The Safe work becomes `evm/`; `ON-1`..`ON-8` are rewritten and split per chain |
| `packages/guard-core`   | Domain logic and HTTP API survive. Chain client, signer, simulation and top-up become per-chain adapters (`GC-2`, `GC-3`, `GC-5`)  |
| `packages/shared`       | Types edited per the table above; `addresses.ts` holds program ids and mints as well as contract addresses (`INT-1`)               |
| `packages/mcp-server`   | Nearly unaffected; address fields become opaque strings                                                                            |
| `packages/telegram-bot` | Nearly unaffected; it must show which chain a payment is on                                                                        |
| `/e2e`                  | Attack suite runs twice, once per chain, with chain-specific cases (`INT-5`)                                                       |
| CI                      | Keeps the Foundry job for `evm/` and adds a Solana test runner for `svm/`                                                          |

#### Reject codes need redesign per chain, not translation

`APPROVAL_DETECTED`, `PERMIT_DETECTED` and `DELEGATION_DETECTED` describe EVM attacks and stay for the
EVM adapter. Solana needs its own set for different mechanisms: an SPL `Approve` granting a delegate,
`SetAuthority`, `CloseAccount`, a change of account owner, a CPI into an unknown program, and address
lookup tables hiding which accounts a transaction touches. Solana's `simulateTransaction` returns
pre/post balances, which helps, but it is not a drop-in for the EVM checks. The shared core
(`PAUSED`, `PER_TX_EXCEEDED`, `DAILY_EXCEEDED`, `SIM_FAILED`, ...) is unchanged.

#### Sequencing — recommended

Build the chain-agnostic core and the **Solana adapter first**, prove it end to end including the
attack suite, then add the **Base adapter**. Both are in v0.1, but Base does not start until Solana is
green.

Two reasons. The users are on Solana, so that is the path that reaches them soonest. And the attack
suite is the whole product: proving it once, on one chain, teaches us what the second adapter has to
satisfy. Building both at once doubles the surface we must prove before we know what proving it even
takes.

#### Rejected: Robinhood Chain

Dropped by the owner on 2026-11-03. Recorded here because the finding is worth keeping: Robinhood Chain
is EVM (Arbitrum Orbit, Nitro, chain id 4663 mainnet / 46630 testnet, ETH for gas, public mainnet since
2026-07-01), so it would have shared the EVM adapter rather than needing its own stack. But two
prerequisites were unconfirmed and the architecture does not work without them: Safe and the Allowance
Module deployed there (a third-party source dated August 2026 said Safe had published no official
support — unverified and possibly stale), and Circle USDC deployed there (no evidence found either
way). If the chain is ever reconsidered, verify both against official sources first.

#### Recommendation

Approve all three changes and the sequencing. The type change (item 2) should be applied by the
integrator before any session writes code, since every package imports those types.

### CR-002 — Unmark the Solana CAIP-2 ids: confirmed against the chain

- **From:** manager
- **Date:** 2026-11-03
- **Status:** confirmed — no value changes; integrator removes the marker
- **What:** `packages/shared/src/constants.ts` marks `CHAINS.solanaDevnet` and `CHAINS.solanaMainnet` as
  UNVERIFIED. The owner ran `solana genesis-hash` against both clusters:

  | Cluster      | Genesis hash                                   | First 32 characters                | In the code |
  | ------------ | ---------------------------------------------- | ---------------------------------- | ----------- |
  | devnet       | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | match       |
  | mainnet-beta | `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d` | `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | match       |

  Both values in the code are correct. The change is to delete the UNVERIFIED comment block and replace
  it with one line naming this check as the source.

- **Why:** an unverified chain id is a standing doubt in code that every x402 network check depends on.
- **Blast radius:** a comment in `packages/shared`; no behaviour changes.
