# @agentguard/shared

Types, zod schemas, verified onchain addresses and constants used by every other package.

- Every other package imports from here. Changes are proposed in
  [`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md) first.
- **Source of truth:** [`/SPEC.md`](../../SPEC.md).

## Contents

| File               | Status                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/types.ts`     | Transcribed from SPEC: `Amount`, `Policy`, `PayIntent`, `IntentStatus`, `RejectCode`, webhook and budget shapes                            |
| `src/constants.ts` | Chain ids, USDC decimals, guard port, approval TTL, allowance reset period                                                                 |
| `src/addresses.ts` | Verified addresses per chain, each read from an official source and never guessed. `requireAddress()` throws for one that is not filled in |
| `src/schemas.ts`   | Not written yet                                                                                                                            |

## Rules

- `Amount` is a decimal string of **atomic units** (USDC has 6 decimals). Parse to `bigint` before any
  arithmetic. No JS numbers, no floats, ever.
- Addresses go in `src/addresses.ts` with a comment naming the official source, after they are
  proposed in `/CHANGES_REQUESTED.md`.

```bash
pnpm --filter @agentguard/shared typecheck
pnpm --filter @agentguard/shared test
```
