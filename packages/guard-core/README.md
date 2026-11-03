# @agentguard/guard-core

The guard service: the only component that holds the hot wallet key. It evaluates every payment against
the policy, simulates it, asks the owner when needed, and only then signs.

- **Owner:** Session 2 (guard-core). This session edits only this package.
- **Tasks:** GC-1 .. GC-11 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md) — HTTP API, reject codes and the webhook contract.

## Pipeline

```
request -> parse/validate (zod) -> build PayIntent -> policy engine -> simulation
        -> [needs_approval? -> Telegram webhook -> owner decision or 10 min timeout]
        -> top up hot wallet if short -> sign -> send -> audit log
```

Default deny at every step. Any parsing doubt rejects.

## Layout

| Path            | Contents                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| `src/domain/`   | Pure logic, no I/O: policy engine, amount math, 402 parsing. Coverage gate >= 90%    |
| `src/adapters/` | I/O behind interfaces: chain client, simulator, signer, x402 client, DB, bot webhook |
| `src/http/`     | Fastify routes exactly as in SPEC, zod validation, per-role bearer auth, rate limits |

The policy engine is `evaluate(intent, policy, spentToday) -> { decision, reasons }` and is a pure
function so it can be exhaustively unit tested.

## Simulation must reject

- an effect that is not a single USDC transfer of the exact amount to the exact recipient (`SIM_UNEXPECTED_EFFECT`)
- `approve` / `increaseAllowance` / `setApprovalForAll` (`APPROVAL_DETECTED`)
- Permit / Permit2 typed data (`PERMIT_DETECTED`)
- an EIP-7702 authorization or delegation (`DELEGATION_DETECTED`)

## Security

- `HOT_WALLET_PRIVATE_KEY` lives only in this package's env (later: KMS). Never logged, never returned
  by any endpoint.
- Amounts are `bigint` internally. No floats for money.
- Agent-provided text (`reason`, URLs, headers, API responses) is untrusted and never affects a decision.
- Every decision is written to `audit_log` with its reject reasons.
- Only the x402 TS SDK `>= 2.28.0` with spend controls on. Never sign anything the SDK cannot decode
  into a plain USDC payment.

## Setup

```bash
cp .env.example .env     # then fill it in; never commit .env
pnpm --filter @agentguard/guard-core test
pnpm --filter @agentguard/guard-core dev
```

Env vars are documented in [`.env.example`](./.env.example).
