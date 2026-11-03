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

### CR-001 — Target Solana in v0.1, and stop assuming EVM in the shared types

- **From:** manager
- **Date:** 2026-11-03
- **Status:** proposed — awaiting owner approval

#### What

Three changes to [`/SPEC.md`](./SPEC.md), which currently targets Base only.

**1. v0.1 ships on Solana instead of Base.**

| SPEC today                                           | Proposed                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Base Sepolia (84532) dev, Base mainnet (8453) launch | Solana devnet for dev, Solana mainnet-beta for launch            |
| Safe + Safe Allowance Module                         | Squads v4 multisig + Spending Limits                             |
| viem, `@safe-global/protocol-kit`                    | `@solana/kit`, `@sqds/multisig`                                  |
| Foundry fork tests                                   | LiteSVM or `solana-test-validator`                               |
| x402 TS SDK (EVM)                                    | `@x402/svm` with `@x402/core`, scheme `exact` over SPL transfers |

The money flow is unchanged in shape. A Squads Spending Limit gives a designated member a per-period
withdrawable amount on one token, refilled at the start of each period, optionally restricted to
whitelisted destinations. That is the same guarantee the Safe Allowance Module gave us: a hard onchain
ceiling on daily loss, from an audited program we do not write.

**2. The shared types stop assuming EVM.** This is the part that must land before any package writes
code against the current types.

| Field                 | Today                 | Proposed                                                       |
| --------------------- | --------------------- | -------------------------------------------------------------- |
| `Policy.chainIds`     | `number[]`            | `chains: string[]`, CAIP-2 (`solana:5eykt4...`, `eip155:8453`) |
| `Policy.tokens`       | `` `0x${string}`[] `` | `string[]` — Solana mints are base58                           |
| `PayIntent.chainId`   | `number`              | `chain: string`, CAIP-2                                        |
| `PayIntent.token`     | `` `0x${string}` ``   | `string`                                                       |
| `PayIntent.recipient` | `` `0x${string}` ``   | `string`                                                       |
| `PayIntent.txHash`    | `` `0x${string}` ``   | `txId?: string` — Solana signatures are base58                 |

`Amount` is unchanged: USDC has 6 decimals on both chains.

**3. Base and Robinhood Chain become post-v0.1 adapters, not v0.1 targets.**

#### Why

- The owner states the users are on Solana.
- Both pieces the architecture depends on exist and are mature there: Squads v4 Spending Limits, and
  official x402 SVM support (`@x402/svm`, documented by Solana itself).
- Nothing is lost by moving now and a lot is lost by moving later: no product code exists yet.
- Shipping one chain in v0.1 keeps the attack surface we must actually prove small. The SPEC already
  restricts v0.1 to one token for the same reason.

#### Blast radius

| Package                 | Effect                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/onchain`      | Rewritten. `ON-1`..`ON-8` are rewritten; the Safe and Allowance Module work does not carry over                                    |
| `packages/guard-core`   | Domain logic and HTTP API survive. The chain client, signer, simulation and top-up adapters are rewritten (`GC-2`, `GC-3`, `GC-5`) |
| `packages/shared`       | Types edited per the table above (`INT-1`)                                                                                         |
| `packages/mcp-server`   | Nearly unaffected; address fields become opaque strings                                                                            |
| `packages/telegram-bot` | Nearly unaffected; address display only                                                                                            |
| `/e2e`                  | Attack suite rewritten for the Solana threat model (`INT-5`)                                                                       |
| CI                      | The `forge test` job is replaced by the Solana test runner                                                                         |

#### Reject codes need redesign, not translation

`APPROVAL_DETECTED`, `PERMIT_DETECTED` and `DELEGATION_DETECTED` describe EVM attacks. The Solana
equivalents are different mechanisms: an SPL `Approve` granting a delegate, `SetAuthority`,
`CloseAccount`, a change of account owner, a CPI into an unknown program, and address lookup tables
hiding which accounts a transaction touches. The simulation checks must be designed against that
threat model. Solana's `simulateTransaction` returning pre/post balances helps, but it is not a
drop-in for the EVM checks.

#### Robinhood Chain — blocked on facts we do not control

Robinhood Chain is EVM (Arbitrum Orbit, Nitro, chain id 4663 mainnet / 46630 testnet, ETH for gas,
public mainnet since 2026-07-01), so it would share the EVM adapter with Base rather than needing its
own stack. But two prerequisites are unconfirmed, and the architecture does not work without them:

1. **Safe and the Allowance Module deployed there.** A third-party source dated August 2026 states Safe
   has not published official Robinhood Chain support. Unverified and possibly stale — it must be
   checked against Safe's official deployment list. Without it, the options are self-deploying the
   audited contracts, which weakens the "no contract we deploy ourselves" argument that justifies a
   real-money launch, or not supporting the chain.
2. **Circle USDC deployed there.** No evidence found either way. v0.1 is USDC-only.

Proposed: add a task to verify both against official sources before Robinhood Chain is scheduled at
all. It is not a v0.1 target.

#### Recommendation

Approve the Solana switch and the type change. Keep Base as the first post-v0.1 adapter, since the EVM
work is well understood and the adapter then covers every EVM chain. Schedule Robinhood Chain only
after the two prerequisites above are confirmed.
