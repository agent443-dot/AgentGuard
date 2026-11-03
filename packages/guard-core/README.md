# @agentguard/guard-core

The guard service, and the only component that holds the hot wallet key. It checks every payment
against the policy, simulates it, asks the owner when needed, and only then signs.

- **Owner:** Session 2 (guard-core). This session edits only this package.
- **Tasks:** GC-1 .. GC-11 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md): HTTP API, reject codes and the webhook contract.

## Run it

```bash
cp .env.example .env                 # fill it in; never commit .env
pnpm --filter @agentguard/guard-core create-agent my-agent   # prints the agent token once
pnpm --filter @agentguard/guard-core dev                     # API on 127.0.0.1:8787
```

A new agent's policy is empty, so it can pay nothing until the owner sets one with
`PUT /v1/admin/policy/:agentId`.

Until the Solana `ChainAdapter` lands (SVM-3), set `GUARD_STUB_CHAINS=true` to run against an
offline stub chain. Nothing is signed and no money moves. Without it, and with no adapter, every
payment is refused.

## Pipeline

Both payment routes run the same steps, in `src/service/payments.ts`:

```
build PayIntent -> policy -> simulation -> [owner on Telegram] -> top up hot wallet -> sign/send
```

Every step writes to `audit_log`. Default deny throughout: an intent starts as `rejected` and only
the pipeline moves it on.

- **Policy** (`domain/policy.ts`) reports every broken rule, not just the first. A chain with no
  adapter counts as `CHAIN_NOT_ALLOWED`.
- **Simulation** (GC-2) calls `ChainAdapter.simulate`. Any reject code from the adapter refuses the
  payment, a simulation that throws is `SIM_FAILED`, and a simulation in which the wallet loses more
  of the token than the intent pays is `SIM_UNEXPECTED_EFFECT` on every chain.
- **Owner approval**: at or above `approvalThreshold`, the intent is saved as `pending_approval`
  before the webhook goes out. Approval answers the threshold only: policy and simulation run again
  right before anything is sent, so a pause or a spent budget in the meantime still refuses it.
- **Top-up** (GC-5): if the hot wallet holds less than the payment, the shortfall is pulled with
  `ChainAdapter.topUpHotWallet`, under the onchain cap.
- **Spend** is counted once a signed transaction leaves our hands, whether or not we hear that it
  landed. Overcounting only shrinks the day's budget; undercounting would let the agent past it.

Payments for one agent run one at a time, so two concurrent requests cannot both pass the daily
max against the same total.

### `POST /v1/agent/transfer`

Sent at once when cleared. Over the threshold it returns `pending_approval`; the owner's approval
sends it from `POST /v1/bot/decision`, which returns the final intent.

### `POST /v1/agent/x402/fetch`

1. The URL's host must be in `allowedDomains` before the guard contacts it at all, so the guard
   cannot be pointed at internal hosts. Redirects are not followed. Payment headers the agent
   supplies are dropped.
2. A response other than 402 is passed through with no intent.
3. The `PAYMENT-REQUIRED` header is decoded with `@x402/core` and validated with zod. Only x402
   version 2 and scheme `exact` are accepted. `chooseAccept` picks the first offer within the policy
   and the agent's `maxAmount`.
4. Policy, simulation, approval and top-up as above. Over the threshold it returns
   `pending_approval` at once. Once the owner approves, the agent repeats the same request and the
   approval is redeemed, once, for exactly those terms. Unused approvals expire with the sweep.
5. The payment is built by the SDK and signed by a signer bound to the intent
   (`adapters/svm-x402.ts`): it runs onchain's `inspectTransfer` over the exact message first and
   refuses anything but that one transfer. The SDK's own spend control is set to the intent's
   amount as a second lock.
6. The request is retried with `PAYMENT-SIGNATURE`. A second 402 with different terms is
   `INVALID_402`. The paid response is returned as untrusted content.

The reason shown to the owner is the method and URL without the query string, which often carries
the API's own credentials.

### Admin

`POST /v1/admin/kill` pauses every agent first, then returns each chain's `buildKillTx()` for the
owner to sign. A chain that cannot build its transaction is reported as `build_failed`; the pause
holds regardless.

## Known gaps

- **Solana x402 is blocked on onchain.** The SDK always appends a Memo instruction, and
  `inspectTransfer` refuses the Memo program, so every real payment is refused. A test pins this
  (`test/svm-x402.test.ts`) and will fail once the Memo is allowed.
- **No real `ChainAdapter` yet** (SVM-3). Tests and `GUARD_STUB_CHAINS` use `adapters/stub.ts`.
- `adapters/svm-x402.ts` imports the Solana SDKs inside guard-core, because `ChainAdapter` has no
  x402 signing method. Proposed as CR-003 in [`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md).

## Layout

| Path            | Contents                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `src/domain/`   | Pure logic: policy, amount math, x402 offer choice, simulation check, auth |
| `src/service/`  | The pipeline, transfers, x402, approvals, the per-agent lock               |
| `src/adapters/` | I/O: bot webhook, the paid API, x402 signing per chain, the stub chain     |
| `src/http/`     | Fastify routes per role, zod schemas, bearer auth, rate limits             |
| `src/db/`       | Drizzle + SQLite schema, migrations, queries                               |
| `src/main.ts`   | Startup: config, migrations, adapters, the expiry sweep timer              |

## Security

- The hot wallet key is read from `SOLANA_HOT_WALLET_KEYPAIR` and lives only in this process (later:
  KMS). Never logged, never returned by any endpoint. Logs redact `authorization` and
  `x-guard-signature`.
- Agent tokens are stored only as SHA-256 hashes and compared in constant time.
- Amounts are `bigint` internally. No floats for money.
- Agent-provided text (`reason`, URLs, headers, API responses) is untrusted and never affects a
  decision.

Env vars are documented in [`.env.example`](./.env.example).
