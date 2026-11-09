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
- **Status:** proposed — Allowance Module verified on Base mainnet and Base Sepolia; USDC still open
- **What:**
  - **Safe Allowance Module, Base mainnet (`eip155:8453`):** `0xAA46724893dedD72658219405185Fb0Fc91e091C`,
    version 0.1.1. Source: the official `@safe-global/safe-modules-deployments` package (3.0.13),
    `src/assets/allowance-module/v0.1.1/allowance-module.json`, `networkAddresses["8453"]`, and the
    same file on the repository's `main` branch. All 57 networks listed there share this address
    (a deterministic deployment). v0.1.0 at `0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134` is the older
    release; we should use 0.1.1.
  - **Update 2026-11-04 (onchain):** CI's `eth_simulateV1 on Base Sepolia` job, run against
    `https://sepolia.base.org`, found the module deployed on Base Sepolia at the same address
    (`Allowance Module 0xAA46724893dedD72658219405185Fb0Fc91e091C: deployed`, 14,908 bytes of code).
    Safe deploys it deterministically, so the same address on another chain means the same init code.
    It is still absent from Safe's official list for 84532; whether that is enough to add it to
    `addresses.ts` is the owner's call.
  - **Update 2026-11-04 (onchain), code hashes:** the forge test
    `test_moduleOnSepoliaIsTheMainnetCode` (`packages/onchain/forge/AllowanceCap.t.sol`, PR #41) reads
    the runtime code hash at `0xAA46…091C` on a Base mainnet fork and a Base Sepolia fork and fails
    unless they are equal. CI on PR #41 (commit 5c192ec), job 126355459090, printed:
    - Base mainnet: `0x7aa63affdca06fe94576f00077ad61a02ccf203a5da31e1b4ed595df7b65cf3e`
    - Base Sepolia: `0x7aa63affdca06fe94576f00077ad61a02ccf203a5da31e1b4ed595df7b65cf3e`

    `pnpm check:simulate` against `https://sepolia.base.org` printed the same Sepolia hash (job
    126354320884). Equal code at the same address: **proposed value for Base Sepolia
    (`eip155:84532`) is `0xAA46724893dedD72658219405185Fb0Fc91e091C`**, verified on-chain against the
    mainnet copy rather than taken from Safe's list.

  - **Safe Allowance Module, Base Sepolia (`eip155:84532`):** not in the official list, in either
    release; deployed with the mainnet code, see the code-hash update above.
  - **USDC, Base and Base Sepolia:** not read yet. Circle's list
    (developers.circle.com/stablecoins/usdc-contract-addresses) cannot be reached from the cloud
    sessions, so no value is proposed.
- **Why:** INT-1 fills `addresses.ts` from verified sources only; EVM-1..EVM-6 need both values.
- **Blast radius:** `packages/shared/src/addresses.ts` (integrator), the `EVM-*` tasks (onchain).

### CR-006 — Let callers see which chains guard-core runs

- **From:** bot, covering mcp's request too (via the manager, 2026-11-04)
- **Date:** 2026-11-04
- **Status:** applied. The owner approved both items on 2026-11-04, in the bot session. They are in
  SPEC v0.4 (#55), guard-core (#56), mcp (#57) and the bot (#42). `BudgetView.chains` stays optional
  in shared, so mcp keeps working against an older guard-core.
- **What:** two additions to "guard-core HTTP API" in [`/SPEC.md`](./SPEC.md). Nothing existing is
  removed or renamed.

  1. **Admin route, for the bot:**

     ```
     GET /v1/admin/chains -> { chains: { chain: string, allowance: AllowanceState | null }[] }   (admin token)
     ```

     One entry per configured `ChainAdapter`, in the order guard-core holds them. `allowance` is that
     adapter's `getAllowanceState()`, or `null` when reading it failed (the same convention as the null
     kill `payload`). An empty list means no chain is configured, so every payment is refused.

  2. **The same list on the agent's budget, for mcp.** `GET /v1/agent/budget/:agentId` gains one field:

     ```
     BudgetView.chains: string[]   // CAIP-2 ids guard-core runs AND this agent's policy allows
     ```

     It is the intersection of the configured adapters and `Policy.chains`, so an agent learns only
     where it may actually pay, never the operator's full setup or the allowance figures. The admin
     budget route returns it too, since it shares `BudgetView`.

- **Why:**
  - The bot (BOT-10) must show both chains on `/status` once Base is configured, and name them in the
    `/kill` confirmation. Nothing guard-core exposes says which chains it runs: `/health` is
    `{ status: "ok" }`, and budget needs an agent id.
  - mcp wants to check its `DEFAULT_CHAIN` against what the guard will accept. Today a wrong
    `DEFAULT_CHAIN` only shows up as `CHAIN_NOT_ALLOWED` on the first payment. mcp holds an agent token,
    not the admin token, so it needs the list on the agent-scoped route.
- **Blast radius:**
  - guard-core: one read-only admin route over the adapters it already holds, plus one field computed
    on the existing budget route.
  - shared: `BudgetView.chains` and a `ChainStatus` type (integrator).
  - telegram-bot: already built against item 1. Until the route exists, `/status` says "Chains: not
    reported by this guard-core" and `/kill` keeps its generic text (#42).
  - mcp-server: can read item 2 at startup and warn, or refuse, when `DEFAULT_CHAIN` is not in it.
- **Note from mcp (2026-11-04):** item 2 is all mcp needs, since it holds only an agent token. mcp
  warns rather than refuses at startup, because guard-core may be down when the MCP server starts and
  refusing would take the agent's tools away. It reads `chains` as optional, so it keeps working
  against a guard-core without the field. It also lists the allowed chains in `get_budget`, so the
  model can pick a valid chain before it pays.

### CR-007 — Robinhood Chain as the next chain after Solana

- **From:** integrator, at the owner's request (2026-11-07). The owner made it top priority, ahead of
  Base (D6 changed).
- **Date:** 2026-11-07
- **Status:** approved by the owner on 2026-11-08 and applied in SPEC v0.5 and shared.
- **What:**
  1. **Chains.** `CHAINS.robinhood = 'eip155:4663'` and `CHAINS.robinhoodTestnet = 'eip155:46630'`
     in shared, added to SPEC's chain identifiers. The EVM adapter, signing gate, simulation and kill
     are reused, the same contracts as on Base.
  2. **The dollar is not USDC there.** Robinhood Chain has no Circle USDC. Its USD stablecoin is
     Paxos' USDG, 6 decimals, and a token named "USDC" there is reported to be a copy. Today
     `ChainAddresses.usdc`, the bot's dollar display and mcp's `usdcFor` all assume USDC. Proposal:
     a per-chain `usd: { address, symbol }`, with `symbol` "USDC" or "USDG", replacing `usdc`. Every
     amount stays 6-decimal base units, so the policy, the caps and the math do not change. The
     sessions may propose a narrower change if they find one.
  3. **Prerequisites, each verified from an official source or onchain, on testnet first:**
     - Safe 1.4.1 and the Allowance Module on 46630 and 4663. Third-party sources disagree on
       whether Safe has an official deployment. If it does not, we deploy them ourselves and prove
       the runtime code hash equals the official mainnet code, as CR-005 did for Base Sepolia;
     - USDG's address from Paxos, its decimals, and that it implements EIP-3009
       `transferWithAuthorization`, which the x402 `exact` scheme and our signing gate require;
     - that the chain's RPC serves `eth_simulateV1`, which guard-core's simulation needs;
     - that `@x402/evm` accepts `eip155:4663`. It may list its networks, and community facilitators
       report x402 on the chain in USDG.
  4. **USDG is not USDC, and the adapter must account for it** (RH-1 findings):
     - the EIP-712 domain is ("Global Dollar", "1") and the token has no `version()` getter. The
       signing gate checks both values against the chain's `usd` entry, never against
       `requirements.extra` alone;
     - it is a rewards token. `balanceOf` excludes unclaimed rewards, and rewards arrive only on an
       explicit claim, so `simulate()`'s exact balance deltas should hold. That is to be tested on
       testnet, including a claim landing between two reads;
     - Paxos can freeze an address. A transfer to or from a frozen one reverts with
       `AddressFrozen`. A frozen Safe or hot wallet stops payments, and the kill still lands
       because it is a Safe module call, not a token transfer. The adapter maps the revert to a
       clear `SIM_FAILED` reason, and the bot tells the owner it is a freeze, not an attack;
     - a reused authorization nonce does not revert: the token emits `AuthorizationAlreadyUsed`
       and returns. Our signer never reuses a nonce, but nothing may treat a successful
       `transferWithAuthorization` call as proof of payment without the `Transfer` event;
     - any token at an address other than Paxos's two is refused, whatever its symbol.
- **Research:** done in RH-1 (PR #91), `packages/onchain/docs/robinhood-research.md`. Safe 1.4.1
  and the Allowance Module 0.1.1 are canonical on both chains, with code hashes checked in CI. USDG
  has 6 decimals and EIP-3009. Both public RPCs serve `eth_simulateV1` (asserted by the probe since #93: a
  simulated 0.5 ETH transfer must read back exactly). `@x402/evm` 2.29.0 takes both ids. Open with the owner (HUMAN-18): confirm the two
  USDG addresses on Paxos's pages and list the "USDC" copies.
- **Why:** owner priority (D6 now: Solana, then Robinhood Chain, then Base).
- **Blast radius:** shared (`CHAINS`, `ChainAddresses`), onchain (EVM config for the two chain
  ids, the scripts), guard-core (`buildChains` for a second EVM chain), bot and mcp (the dollar
  symbol, chain names, explorer links). No change to the policy engine or to the amounts.

### CR-008 — An allowance that does not exist is a state, not a read failure

- **From:** integrator, from the first Fly.io run (HUMAN-17), with the shape proposed by the manager
- **Date:** 2026-11-07
- **Status:** approved by the owner on 2026-11-08 and applied in SPEC v0.5 and shared.
- **Found:** after a kill, the Squads `SpendingLimit` account no longer exists. The Solana adapter's
  `getAllowanceState()` then throws "Unable to find SpendingLimit account", so `GET /v1/admin/chains`
  reports `allowance: null` and the bot says "onchain allowance could not be read". That reads like an
  outage, but it is the state a kill is meant to leave. Base has the opposite problem:
  `getTokenAllowance` on a removed delegate returns zeros, which reads as an active limit of 0 and
  hides the kill.
- **What:**
  1. `AllowanceState` in SPEC and shared becomes a union:
     ```ts
     type AllowanceState =
       | { status: 'active'; cap: Amount; spent: Amount; resetsAt: string; delegate: Address }
       | { status: 'none'; delegate: Address }
     ```
  2. `getAllowanceState()` returns `{ status: 'none' }` only when the chain shows that no limit
     exists for the hot wallet:
     - Solana: the `SpendingLimit` account at the address derived from the hot wallet is absent;
     - EVM: the hot wallet is not among the Safe's delegates in the Allowance Module, or its
       allowance for the token was deleted with it.

     Any other failure, such as an RPC error or an account that will not decode, still throws.

  3. `GET /v1/admin/chains` keeps `allowance: null` for a thrown read, and passes `none` through.
  4. The bot shows "no onchain limit (killed)" for `none`, and "could not be read" only for `null`.
- **Never:** collapse `none` into an active limit with a zero cap. A zero cap looks like a working
  setup that has been spent. A missing limit means a kill happened, and the owner must see that.
- **Why:** the owner must be able to tell a kill from an outage from Telegram alone.
- **Blast radius:** shared (`AllowanceState`), SPEC (the type and the admin chains route), onchain
  (both adapters' `getAllowanceState`, the stub), guard-core (the stub chain), bot (the chains
  line). The policy engine, the amounts and the agent API do not change.

### CR-009 — An AgentGuard token on Robinhood Chain, for governance and holder benefits

- **From:** integrator, for the owner
- **Date:** 2026-11-09
- **Status:** proposed. The owner wants it. He has not yet approved the details below.
- **What:** a new, separate onchain layer beside the guard, which never touches the money path:
  1. **The token.** An ERC-20 on Robinhood Chain (4663):
     - OpenZeppelin `ERC20` + `ERC20Permit` + `ERC20Votes`;
     - the whole fixed supply minted once at deployment, with no mint afterwards;
     - no blacklist, pause or fee, and no owner role;
     - verified on the explorer.

     The owner deploys it from a **new wallet**, never the vault-owner Phantom account (D4).
     `ERC20Votes` lets holders vote with no token held in escrow.

  2. **Governance**, through an OpenZeppelin `Governor` with a `TimelockController`. Its scope is
     only what the network shares, never anyone's funds:
     - the public registry of trusted x402 APIs (item 3): its admission rules, the minimum stake,
       and delisting;
     - a grants treasury, funded from the token supply, for bug bounties and contributors;
     - recommended defaults: policy templates, which chains come next.

     Governance cannot reach a vault, a guard deployment or a key. Everyone self-hosts (D7), so
     there is nothing for it to control there.

  3. **A registry of x402 APIs, backed by stake.** A provider stakes the token to list a domain.
     Governance can delist and slash a provider that overcharges, fails to deliver or attacks
     agents, and part of the slash goes to whoever reported it. A self-hosted guard can opt in:
     "allow domains in the registry with a stake ≥ X", instead of a hand-written
     `allowedDomains`. That is the token's main use: it bonds the trust the network shares.
  4. **Holder benefits that are not financial:**
     - votes;
     - curating the registry;
     - bug bounties partly paid in the token;
     - later, a discount on or access to the hosted service, if one comes (D7).

     There is **no revenue share, no buyback promise and no yield**, because each of those makes a
     security more likely in law.
- **Why:** the owner wants the token to have a purpose in the network now that the code is public.
  Securing the domain allowlist is the hardest step for new users, and it is the one place a stake
  adds real security.
- **What stays as it is:**
  - every payment, cap and vault stays in USDC or USDG;
  - the daily loss bound does not depend on the token's price;
  - the guard runs the same with or without the registry;
  - the open-source code does not require the token.
- **Blast radius:**
  - onchain: a new `contracts/` area with the token, the Governor, the Timelock and the registry,
    plus Foundry tests and an audit before mainnet;
  - shared: registry and token addresses, once deployed;
  - guard-core: an optional allowlist source, which needs its own CR when the time comes;
  - docs: an ADR;
  - none of it is on the launch path.
- **Before deployment:**
  - the owner fixes the allocation (team, vesting, community, treasury, liquidity);
  - he gets legal advice: in Brazil, the CVM may treat a token bought with an expectation of profit
    as a security;
  - he chooses the governance parameters: quorum, voting period, timelock delay.

### CR-010 — Eight protections beyond the cap: pinning, task budgets, breaker, shadow mode, passkey approvals, proof of cap, receipts, reports

- **From:** integrator, for the owner
- **Date:** 2026-11-09
- **Status:** approved by the owner on 2026-11-09 ("faça todas": do all of them). Applied as SPEC
  v0.6. Built in three phases on the package branches, none merged before Solana's mainnet launch.
- **Why:** the cap bounds the worst day, but inside it the owner still trusts every API the agent
  pays and every approval tap. These close the remaining gaps one by one, each without a new
  contract and each backward compatible: a policy written before v0.6 keeps every limit it had. The
  defaults only add protection (the breaker, pinning), never let a refused payment through.
- **What** (all amounts atomic strings, all percentages and counts integers, no floats):

  1. **Recipient and price pinning (x402).** guard-core remembers, per agent and domain, the chain,
     token, `payTo` and amount of the last executed payment (table `x402_pins`). A later payment to
     that domain with another `payTo`, chain or token, or an amount above the pinned one by more than
     `Policy.priceIncreaseMaxPct` (default 100, so double), goes to the owner even below the
     threshold. The approval request carries `flags: ("RECIPIENT_CHANGED" | "PRICE_JUMP")[]`. The
     owner's approval re-pins; a rejection keeps the old pin.
  2. **Task budgets (mandates).** `Mandate { id, agentId, budget, spent, domains, recipients,
expiresAt, status: "active" | "exhausted" | "expired" | "revoked", reason, createdAt }`.
     - `POST /v1/agent/mandates { agentId, budget, domains, recipients?, ttlSeconds, reason }`: an
       agent opens one inside its policy. Above `approvalThreshold` the owner approves it on Telegram
       first, like a payment.
     - `POST /v1/admin/mandates` (owner opens one) and `POST /v1/admin/mandates/:id/revoke`.
     - The x402 fetch and transfer bodies take an optional `mandateId`. The payment must fit the
       mandate (remaining budget, domains, recipients, not expired) as well as the policy.
     - `Policy.requireMandate` (default false): when true, a payment without a mandate is refused.
     - New reject codes: `MANDATE_REQUIRED`, `MANDATE_EXCEEDED`, `MANDATE_EXPIRED`.
     - MCP: `start_task { budgetUsd, domains, minutes, reason }` returns a mandate id;
       `paid_fetch` and `transfer` take `mandateId`; `get_budget` lists open mandates.
  3. **Circuit breaker.** `Policy.maxPaymentsPerMinute` (default 10). The payment that would exceed
     it is refused with `BREAKER_TRIPPED`, and the agent is paused. The bot gets a new signed webhook
     `POST {BOT_URL}/hooks/alert { kind: "breaker_tripped", agentId, detail, sentAt }` and tells the
     owner. Resuming is the owner's `/resume`.
  4. **Shadow mode.** `Policy.mode: "live" | "shadow"` (default "live"). In shadow, every payment runs
     the policy, pinning and simulation, is recorded with the new status `"shadowed"` and is never
     signed. An x402 fetch returns the unpaid 402 response. The budget routes add
     `shadowSpentToday`, so the owner sees what the agent would have spent before giving it money.
  5. **Passkey approvals.** With `PASSKEY_ABOVE` set (guard-core config, an amount), approving an
     intent at or above it needs a WebAuthn assertion from a passkey the owner enrolled, not only a
     Telegram tap. A stolen Telegram account can then still reject, never approve.
     - guard-core serves a small page on its public listener, `/owner/approve/:intentId`, which runs
       WebAuthn for its own origin, and verifies the assertion at `POST /v1/owner/approve
{ intentId, assertion }`. The challenge is single-use and expires with the intent.
     - Enrolment: `POST /v1/admin/passkeys/options` and `POST /v1/admin/passkeys`, through the
       admin proxy only. No passkey enrolled means `PASSKEY_ABOVE` refuses to start.
     - The bot shows "Approve with passkey" as a URL button for those intents. `/v1/bot/decision`
       refuses `approve` for them.
  6. **Proof of cap.** The signing page gets a read-only action, `?action=proof&cluster=…&multisig=…`
     or `&safe=…`, needing no wallet. It reads the chain and shows anyone the vault's owner, the
     daily cap, its delegate, what is left today and when it resets: the most the agent can lose,
     verifiable without trusting guard-core.
  7. **Signed receipts.** Each executed intent gets a receipt: the intent, a SHA-256 of the policy in
     force, the simulation summary, `approvedBy: "policy" | "owner" | "passkey"`, the time, and an
     Ed25519 signature by `RECEIPT_SIGNING_KEY`, a key separate from the hot wallets.
     `GET /v1/agent/intents/:id/receipt` and `GET /v1/admin/receipts?from&to`. `GET /v1/receipts/key`
     publishes the public key. Anchoring a daily hash onchain is left for later.
  8. **Reports.** `GET /v1/admin/report?from&to` returns, per agent, the spend, payment and refusal
     counts by code, and the spend per domain. The bot answers `/report` and, with
     `REPORT_WEEKDAY` and `REPORT_HOUR_UTC` set, sends the last 7 days on that day.

  Not a SPEC change, also in scope: a one-command deploy. `scripts/deploy-fly.sh` creates both Fly
  apps, the volume and the secrets from local files and deploys them, and a `docker-compose.yml`
  runs the stack on any server.

- **Blast radius and order:**
  - phase 1: 1, 3, 4 and the deploy script (guard-core, bot, mcp, shared, integrator);
  - phase 2: 2, 6, 8 (guard-core, mcp, bot, onchain);
  - phase 3: 5, 7 (guard-core, bot, mcp).

  Each feature lands with its tests, and the e2e suite gains an attack case for 1, 2 and 3.
