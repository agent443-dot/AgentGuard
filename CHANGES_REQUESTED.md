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
- **Status:** applied to SPEC v0.3 on 2026-11-03. Values unchanged; the UNVERIFIED marker is gone from
  `packages/shared/src/constants.ts` and the ids are written into the SPEC
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

### CR-003 — x402 signing in `ChainAdapter`; x402 fetch responses without a payment

- **From:** guard-core
- **Date:** 2026-11-03
- **Status:** approved (owner, 2026-11-03); applied to SPEC v0.3 on 2026-11-03

#### What

1. **`ChainAdapter` gains one method** so guard-core can stop importing Solana SDKs:

   ```ts
   /** A scheme client for @x402/core that signs this intent and nothing else. */
   x402Scheme(intent: PayIntent, requirements: PaymentRequirements): SchemeNetworkClient
   ```

   Today `packages/guard-core/src/adapters/svm-x402.ts` does this with `@x402/svm`, `@solana/kit`,
   `@solana/web3.js` and onchain's `inspectTransfer`, behind a guard-core interface of the same
   shape (`PaymentScheme.forIntent`). The code would move to `packages/onchain/src/svm/` unchanged.

2. **`POST /v1/agent/x402/fetch` response.** Current text:
   `-> 200 { intentId, status, response?: { status, headers, body } , rejectReasons }`.
   Proposed: `intentId` and `status` are optional. They are absent when the resource did not ask for
   a payment (the response passes through, `rejectReasons: []`), and `intentId` is absent when the
   host is refused before any request (`status: "rejected"`, `DOMAIN_NOT_ALLOWED`).

3. **Approved x402 payments.** Add under the x402 route: "After the owner approves, the agent repeats
   the same request; the approval is redeemed once, for exactly the approved chain, token, amount,
   recipient and domain. An approval not redeemed before `expiresAt` expires with `APPROVAL_TIMEOUT`."

#### Why

1. SPEC says guard-core never imports a chain SDK, but `ChainAdapter` has no way to sign an x402
   payment, and the SDK has to see a signer to build one. Without this, either guard-core imports
   Solana SDKs (today) or x402 cannot be paid.
2. The SPEC shape has no answer for a free resource or a host refused before an intent exists.
3. Only the agent's request can receive the paid response, so the guard cannot complete an x402
   payment by itself when the owner approves. Implemented this way in guard-core today.

#### Blast radius

- `packages/onchain`: one method per adapter (SVM-3, EVM-3); the Solana one is already written.
- `packages/guard-core`: deletes `adapters/svm-x402.ts`, calls the adapter instead.
- `packages/mcp-server`: `paid_fetch` must accept a response without `intentId`, and should tell the
  agent to repeat the call once `check_intent` reports `approved`.

### CR-004 — Bot needs an intent-event webhook, an admin budget read, and a pinned kill response

- **From:** bot
- **Date:** 2026-11-03
- **Status:** approved (owner, 2026-11-03). Owner's addition: attack-code alerts are throttled per
  agent and code so a loop of malicious payments cannot flood the owner's Telegram; large-payment
  alerts are not throttled. Done in the bot. Applied to SPEC v0.3 on 2026-11-03, with the owner's
  throttling rule and the null `payload` for an unbuilt kill transaction written in.
- **What:** three additions to [`/SPEC.md`](./SPEC.md). None changes an existing interface.

  1. **New webhook guard-core -> telegram-bot**, under "Webhook guard-core -> telegram-bot":

     ```
     POST {BOT_URL}/hooks/intent-event   (same X-Guard-Signature scheme as approval-request)
     { intent: PayIntent, sentAt: string }   // sentAt: ISO time guard-core sent it
     Sent when an intent reaches executed, rejected, failed or expired.
     ```

     The bot decides what to show (executed at or above `NOTIFY_ABOVE_AMOUNT`, any attack code), so
     guard-core needs no notification policy of its own. `sentAt` is there for replay protection: the
     bot refuses events older than 5 minutes and deduplicates on intent id plus status.

  2. **New admin route**, under "guard-core HTTP API":

     ```
     GET /v1/admin/budget/:agentId -> BudgetView   (admin token; 404 { error: "not_found" })
     ```

     Same body as `GET /v1/agent/budget/:agentId`, which needs that agent's own token.

  3. **Pin the `/v1/admin/kill` response**, which the SPEC leaves as `{} -> ...`:

     ```
     -> { pausedAgents: number,
          ownerTransactions: { chain: string, description: string, payload: unknown }[] }
     ```

     `pausedAgents` is what guard-core already returns. Each `ownerTransactions` entry is one
     chain's `ChainAdapter.buildKillTx()` result with its CAIP-2 chain added.

- **Why:** BOT-5 (notify on large executed payments and every attack code) has no way to hear about
  them: the only webhook today is the approval request. `/budget` (BOT-4) cannot be answered: the bot
  holds the bot and admin tokens, never an agent token. `/kill` must show each chain's owner
  transaction and the SPEC leaves the shape open.
- **Blast radius:** guard-core (send the event on every final state; add the route; return the kill
  shape, which it already half does), telegram-bot (already built against all three, see
  `packages/telegram-bot`), shared (optional: an `IntentEvent` type), e2e (INT-3 can assert alerts).

### CR-005 — Base addresses for `shared/addresses.ts` (EVM-7), partial

- **From:** onchain
- **Date:** 2026-11-04
- **Status:** proposed — Allowance Module on Base mainnet verified; Base Sepolia and USDC still open
- **What:**
  - **Safe Allowance Module, Base mainnet (`eip155:8453`):** `0xAA46724893dedD72658219405185Fb0Fc91e091C`,
    version 0.1.1. Source: the official `@safe-global/safe-modules-deployments` package (3.0.13),
    `src/assets/allowance-module/v0.1.1/allowance-module.json`, `networkAddresses["8453"]`, and the
    same file on the repository's `main` branch. All 57 networks listed there share this address
    (a deterministic deployment). v0.1.0 at `0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134` is the older
    release; we should use 0.1.1.
  - **Safe Allowance Module, Base Sepolia (`eip155:84532`):** **not in the official list**, in either
    release. The deterministic address may still hold the same code there, but that has to be
    checked against the chain (`cast code 0xAA46…091C --rpc-url https://sepolia.base.org`), and an
    empty result means the module is not deployed on Base Sepolia. Until then, no value.
  - **USDC, Base and Base Sepolia:** not read yet. Circle's list
    (developers.circle.com/stablecoins/usdc-contract-addresses) cannot be reached from the cloud
    sessions, so no value is proposed.
- **Why:** INT-1 fills `addresses.ts` from verified sources only; EVM-1..EVM-6 need both values.
- **Blast radius:** `packages/shared/src/addresses.ts` (integrator), the `EVM-*` tasks (onchain).
