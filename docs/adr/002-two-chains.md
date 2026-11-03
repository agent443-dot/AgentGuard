# ADR 002 — Solana and Base, Solana first

- **Status:** accepted
- **Date:** 2026-11-03
- **Supersedes:** the single-chain decision in [ADR 001](./001-architecture.md)
- **Source:** CR-001 in [`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md)

## Context

ADR 001 built everything on Base, because the Safe Allowance Module gave us an audited onchain spend
cap with no contract of our own. The owner then established that the users are on Solana, and asked
for Base as well. Robinhood Chain was considered and dropped.

The question was whether the architecture survives a second chain, and what it costs.

## Decision

Support both, and ship Solana first.

### The security argument holds on both chains

The property that justifies a real-money launch is that the daily loss ceiling is enforced onchain by
audited code we did not write. Solana has an equivalent of the Allowance Module: a **Squads v4 Spending
Limit** grants a designated member a per-period withdrawable amount on one token, refilled each period,
optionally restricted to whitelisted destinations. Squads is the dominant Solana multisig and is
audited. x402 also has official Solana support (`@x402/svm`, scheme `exact` over SPL transfers), so the
payment rail exists too.

Had either piece been missing, the answer would have been to stay on Base. The destination whitelist is
a small bonus: part of what we enforce offchain on EVM is enforceable onchain on Solana.

### Chain-agnostic types, decided before any code was written

The v0.1 types assumed EVM everywhere: `chainId: number`, `` `0x${string}` `` for tokens, recipients
and transaction hashes. Solana has no numeric chain id and uses base58. Chain ids are now CAIP-2
strings and addresses, tokens and transaction ids are opaque strings that only a chain adapter may
interpret.

This was worth doing immediately. Changing it after four packages had built on it would have touched
every package at once; changing it now touched one file nobody imports yet.

### One interface, two implementations

`packages/onchain` exposes a `ChainAdapter` and keeps the chain SDKs behind it. `guard-core` imports
the interface and never viem or `@solana/kit` directly, so the policy engine, the HTTP API and the
approval flow stay chain-agnostic and the second adapter lands without touching them.

### Reject codes are per-chain below a shared core

`APPROVAL_DETECTED`, `PERMIT_DETECTED` and `DELEGATION_DETECTED` describe EVM mechanisms for granting
standing authority. Solana grants it differently: SPL `Approve` to a delegate, `SetAuthority`,
`CloseAccount`, a change of account owner, a CPI into an unknown program, or address lookup tables
hiding which accounts a transaction touches. These are not renames, so Solana gets its own codes and
its own simulation checks. The shared core — limits, allowlists, pause, timeouts — is identical.

### Solana first, Base second, both in v0.1

Sequential, not parallel. The users are on Solana, so that is the shortest path to them. More
importantly, the attack suite _is_ the product: proving it once on one chain tells us what the second
adapter has to satisfy. Building both before we know what proving it takes would double the surface we
must be confident about, at the moment we are least equipped to judge it.

## Consequences

- `packages/onchain` is restructured and its Safe work becomes `evm/`. Tasks ON-1..ON-8 are rewritten.
- `guard-core`'s domain logic, HTTP API, DB schema and approval flow are unaffected. Its chain client,
  signer, simulation and top-up become per-chain adapters.
- `mcp-server` and `telegram-bot` are nearly untouched. The bot must show which chain a payment is on.
- The attack suite runs once per chain, with chain-specific cases.
- CI keeps the Foundry job for `evm/` and gains a Solana test runner for `svm/`.
- Two hot wallets now exist, one per chain, and each is a separate key in guard-core's environment.

## Open items

- The Solana CAIP-2 references in `packages/shared/src/constants.ts` are the commonly published values
  but are marked unverified: they must be confirmed against a cluster's `getGenesisHash`. A wrong value
  breaks every x402 network check.
- The Squads program id and the Solana USDC mint must come from official sources, like every other
  address.
