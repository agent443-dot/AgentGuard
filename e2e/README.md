# @agentguard/e2e

End-to-end and attack tests across guard-core, telegram-bot and mcp-server, run once per chain:
Solana devnet first, then Base Sepolia (SPEC v0.3).

- **Owner:** integrator (Session 5).
- **Tasks:** INT-3 to INT-6 in [`/coordination/BOARD.md`](../coordination/BOARD.md).
- **`pnpm dev:all` preflight:** `src/env-check.ts` cross-checks the three services' `.env` files
  (INT-3). See the root README for the full setup.

## How it runs

`test/support/stack.ts` wires guard-core, telegram-bot and mcp-server together over real HTTP, as
`pnpm dev:all` does. The webhooks are signed, the tokens are checked, and the agent calls MCP tools.
Two things are fake. The chain is guard-core's `StubChain`, which signs nothing. Telegram is
recorded rather than sent, while the real bot still handles every update. One clock drives all
three services, so expiry is tested without waiting. Runs in CI, with no network and no keys:

```bash
pnpm --filter @agentguard/e2e test
```

## End-to-end flows (INT-4), `test/solana-flows.test.ts`

1. Under the threshold: paid without asking the owner, and the body comes back fenced as untrusted.
2. Over the threshold: the owner approves on Telegram, the agent repeats the request, and the
   approval is redeemed once.
3. The owner rejects: nothing is paid, and the buttons are removed.
4. Left unanswered: `APPROVAL_TIMEOUT`, and a late press is told it is too late.
5. `/kill`: the agent is paused, and the owner receives the chain's kill transaction.

## Attacks (INT-5), `test/solana-attacks.test.ts`

Each one must end with nothing paid and the right reject code.

| Attack                                                                  | Code                                                                   | Where proven                                 |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| 402 for the whole balance, or above the agent's `maxAmountUsd`          | `PER_TX_EXCEEDED`                                                      | here                                         |
| 402 in another token, on another network, in another scheme             | `TOKEN_NOT_ALLOWED`, `CHAIN_NOT_ALLOWED`, `INVALID_402`                | here                                         |
| `payTo` moved between the quote and the retry                           | `INVALID_402`                                                          | here                                         |
| host not on the allowlist (refused before any request)                  | `DOMAIN_NOT_ALLOWED`                                                   | here                                         |
| payment header forged by the agent                                      | dropped, never reaches the API                                         | here                                         |
| transfer to a recipient off the allowlist; per-tx; daily; paused        | `RECIPIENT_NOT_ALLOWED`, `PER_TX_EXCEEDED`, `DAILY_EXCEEDED`, `PAUSED` | here                                         |
| SPL Approve, SetAuthority, CloseAccount, unknown program, lookup tables | the five Solana codes, plus an owner alert                             | wiring here; detection in `packages/onchain` |
| simulation showing a larger loss, or a failing simulation               | `SIM_UNEXPECTED_EFFECT`, `SIM_FAILED`                                  | here                                         |
| non-owner pressing Approve; webhook with a bad HMAC; replayed webhook   | ignored, 401, 409                                                      | here                                         |
| one approval redeemed twice                                             | the second asks the owner again                                        | here                                         |
| prompt-injected response telling the agent to pay someone               | body fenced by a nonce, allowlist still refuses                        | here                                         |
| hot wallet drained by a bug: loss capped by the onchain daily cap       | Squads Spending Limit                                                  | devnet and SVM-8 (LiteSVM)                   |
| approve / Permit / Permit2 / EIP-7702 disguised as a payment            | the EVM codes                                                          | Base, INT-6                                  |

The devnet run on the owner's machine covers the two the stub cannot: the real Solana adapter signing
and inspecting real transactions, and the onchain cap.
