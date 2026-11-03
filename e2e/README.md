# @agentguard/e2e

End-to-end and attack tests across guard-core, telegram-bot and mcp-server, run once per chain:
Solana devnet first, then Base Sepolia (SPEC v0.3).

- **Owner:** integrator (Session 5).
- **Tasks:** INT-3 to INT-6 in [`/coordination/BOARD.md`](../coordination/BOARD.md).
- **`pnpm dev:all` preflight:** `src/env-check.ts` cross-checks the three services' `.env` files
  (INT-3). See the root README for the full setup.

## End-to-end runs (INT-4)

1. agent calls `paid_fetch` on a test x402 API under the threshold -> paid -> response returned
2. over the threshold -> Telegram approval -> approve -> paid
3. same, rejected by the owner
4. same, left to time out (`APPROVAL_TIMEOUT`)
5. kill switch: after `/kill`, every payment fails and the onchain allowance is 0

## Attack runs (INT-5) — all must be blocked with the right reject code

- 402 asking for the whole wallet balance; wrong token; wrong network; `payTo` changing between the 402 and the retry
- approval / Permit / Permit2 / EIP-7702 delegation disguised as a payment
- a prompt-injected API response telling the agent to transfer funds to a new address
- domain not in the allowlist; recipient not in the allowlist; per-tx and daily limits; a replayed intent
- a spoofed Telegram webhook (bad HMAC); a non-owner pressing Approve
- hot wallet drained by a bug -> loss is capped by the Allowance Module daily cap

```bash
cp .env.example .env
pnpm --filter @agentguard/e2e test
```
