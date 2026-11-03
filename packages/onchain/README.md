# @agentguard/onchain

Safe + Safe Allowance Module setup for AgentGuard. **No custom contracts** — the onchain spend limit is
enforced by the audited Allowance Module, so we can launch with real money without waiting on a contract
audit.

- **Owner:** Session 1 (onchain). This session edits only this package.
- **Tasks:** ON-1 .. ON-8 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## What this package will contain

| Script                            | Purpose                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/scripts/create-safe.ts`      | Deploy a Safe for the owner on Base Sepolia (owner EOA from env, threshold 1 for the MVP)                                      |
| `src/scripts/enable-allowance.ts` | Enable the Allowance Module, add the guard hot wallet as delegate, set USDC allowance = `DAILY_CAP` with `resetTimeMin = 1440` |
| `src/scripts/kill.ts`             | Build (and optionally execute) a Safe tx that sets the allowance to 0 and removes the delegate                                 |
| `src/scripts/status.ts`           | Print Safe balance, delegate, allowance, spent, next reset                                                                     |

`src/index.ts` exports the reusable functions guard-core imports:

- `topUpHotWallet(amount)` — the delegate calls `executeAllowanceTransfer` to move USDC from the Safe to itself
- `getAllowanceState()` — current cap, spent and next reset

## Foundry fork tests (ON-6)

Fork Base Sepolia and prove the onchain guarantee:

1. the delegate can pull up to the cap within one period
2. pulling `cap + 1` reverts
3. after the reset period the allowance refills
4. after `kill`, the delegate cannot pull anything

```bash
forge test -vvv          # needs BASE_SEPOLIA_RPC_URL
```

## Addresses

Do **not** hardcode a guessed address. Read the Allowance Module address from the official Safe
deployment list and USDC from Circle's official list, then report both in
[`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md) so the integrator can add them to
`packages/shared/src/addresses.ts`.

## Setup

```bash
cp .env.example .env     # then fill it in; never commit .env
pnpm --filter @agentguard/onchain test
```

Env vars are documented in [`.env.example`](./.env.example).
