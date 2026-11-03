# ADR 001 — Architecture of AgentGuard v0.1

- **Status:** accepted
- **Date:** 2026-11-03
- **Context:** [`/SPEC.md`](../../SPEC.md) v0.1

## Context

An AI agent that can spend money is a liability: a prompt injection, a malicious API response or a
plain bug can drain a wallet. AgentGuard sits between the agent and the money so that the agent can
_request_ a payment but never _authorize_ one.

The hard constraint is that we want to launch with **real money** without first waiting on a smart
contract audit.

## Decisions

### 1. No custom smart contract in v0.1

Funds live in the owner's **Safe**, and the onchain spend limit is enforced by the **Safe Allowance
Module** — both already audited and widely used. A custom contract would be the natural place to put
spend limits, but it would put an audit on the critical path before we can touch real funds.

Consequence: the worst-case daily loss is bounded onchain at `dailyCap + hot wallet balance`, even if
every line of our offchain code is wrong. That is the single property that makes a real-money launch
defensible.

### 2. The agent never holds a key

The Guard hot wallet key exists in exactly one place: `guard-core`'s environment (later a KMS). The
agent talks to an MCP server, which talks to guard-core over HTTP with a per-agent bearer token.
`mcp-server` deliberately holds no key and no policy logic, so compromising it buys an attacker only
the ability to _ask_.

### 3. Two layers of limits, onchain and offchain

The Allowance Module gives the daily ceiling. `guard-core` adds what a module cannot express:
per-transaction limit, recipient and domain allowlists, token and chain allowlists, an approval
threshold, and a pause switch. The offchain `dailyMax` must stay at or below the onchain `dailyCap`,
so the module is always the backstop and never the thing we rely on for ordinary policy.

### 4. Simulate before signing, and reject anything that is not a plain transfer

Every payment is simulated and its effects inspected. We sign only when the effect is a single USDC
transfer of the exact amount to the exact recipient. Anything that smells like granting standing
authority is rejected outright: `approve` / `increaseAllowance` / `setApprovalForAll`
(`APPROVAL_DETECTED`), Permit or Permit2 typed data (`PERMIT_DETECTED`), EIP-7702 authorizations
(`DELEGATION_DETECTED`). This is what stops a malicious x402 response from converting one small
payment into unlimited access.

### 5. Default deny, everywhere

Empty allowlist means deny. A 402 response we cannot fully decode is `INVALID_402`. A simulation we
cannot interpret is a rejection, not a warning. Any parsing doubt rejects.

### 6. The human is in the loop above a threshold

Payments at or above `approvalThreshold` go to the owner on Telegram with the amount, recipient,
domain, the agent's stated reason (clearly labelled as the agent's words and never used in the
decision) and the simulation summary. No answer within 10 minutes expires the intent
(`APPROVAL_TIMEOUT`). The webhook is HMAC-signed and only allowlisted Telegram user ids can act.

### 7. Agent text is data, never instructions

The `reason` field, URLs, request headers and the bodies of paid API responses are all attacker-
controlled in the threat model. They are shown to the owner and returned to the model as _content_,
and they never influence a policy decision.

### 8. Money is `bigint`, amounts cross boundaries as decimal strings

`Amount` is a decimal string of atomic units (USDC has 6 decimals). Internally everything is `bigint`.
No JS `number` ever touches an amount — floats silently lose money.

### 9. Pure domain, mocked I/O

Policy, amount math and parsing are pure functions with no I/O, so the attack cases can be tested
exhaustively and cheaply (coverage gate >= 90% on `domain/`). I/O lives in adapters behind interfaces,
which is also what lets four sessions build in parallel against mocks before the real pieces land.

### 10. SQLite for the MVP

Drizzle + SQLite is enough for one owner and a handful of agents, and it keeps the audit log local and
trivially inspectable. Revisit when there is more than one tenant.

## Consequences

- We can launch invite-only on mainnet with a low cap and a bounded worst case, with no contract audit.
- The Safe owner EOA becomes a critical key: it can change the allowance and is the kill switch.
- `guard-core` is the crown jewel. It is the only process with a key, so it gets the strictest review,
  the smallest attack surface and the complete attack test suite.
- Adding a second token or chain means revisiting the allowlists and the simulation checks; v0.1 is
  deliberately USDC-only.

## Alternatives considered

- **Custom spend-limit contract** — cleaner policy onchain, but an audit before any real money.
  Revisit after launch; if we build it, it ships audited.
- **Session keys / ERC-4337 paymasters** — more moving parts and a less mature security story than a
  Safe module for this use case.
- **Letting the agent hold a small key directly** — simplest to build, but it removes the one property
  worth having: that the agent cannot sign.
