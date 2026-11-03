# @agentguard/shared

Types, zod schemas, verified onchain addresses and constants used by every other package.

- **Owner:** integrator (Session 5). Everyone else imports from here and must **not** edit this package.
  Propose changes in [`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## Contents

| File               | Status                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`     | Transcribed from SPEC: `Amount`, `Policy`, `PayIntent`, `IntentStatus`, `RejectCode`, webhook and budget shapes                                            |
| `src/constants.ts` | Chain ids, USDC decimals, guard port, approval TTL, allowance reset period                                                                                 |
| `src/addresses.ts` | **Empty on purpose.** Addresses must be read from official Safe / Circle deployment lists, never guessed. `requireAddress()` throws until one is filled in |
| `src/schemas.ts`   | Not written yet — task INT-1                                                                                                                               |

## Rules

- `Amount` is a decimal string of **atomic units** (USDC has 6 decimals). Parse to `bigint` before any
  arithmetic. No JS numbers, no floats, ever.
- Addresses go in `src/addresses.ts` with a comment naming the official source. Session 1 reports the
  Base Sepolia and Base mainnet USDC and Allowance Module addresses via `/CHANGES_REQUESTED.md`.

```bash
pnpm --filter @agentguard/shared typecheck
pnpm --filter @agentguard/shared test
```
