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

`pnpm --filter @agentguard/guard-core revoke-agent my-agent` revokes an agent's token. It stops
working on its next request, on every agent route. The agent's intents and audit history stay.

The API listens on `127.0.0.1` unless `HOST` is set (for example `0.0.0.0` in a deployment).

For Solana, set `SOLANA_HOT_WALLET_KEYPAIR`, `SOLANA_RPC_URL` and `SQUADS_MULTISIG`; guard-core
builds onchain's adapter from them. For Base, set `BASE_CHAIN` (`eip155:84532` or `eip155:8453`) with
`BASE_RPC_URL`, `SAFE_ADDRESS`, `HOT_WALLET_PRIVATE_KEY` and, until `shared/addresses.ts` has
verified values, `BASE_USDC` and `BASE_ALLOWANCE_MODULE`. A chain switched on with a value missing
stops the start, naming the missing variables and never their values. Before trusting `SAFE_ADDRESS`
and any address that came from the env rather than `shared/addresses.ts`, guard-core asks the chain:
each must hold a contract, and the USDC must report 6 decimals. If any check fails, or the RPC cannot
be reached, it refuses to start. Both chains can run at once. To run offline instead, set `GUARD_STUB_CHAINS=true`: nothing
is signed and no money moves. With neither, there is no adapter and every payment is refused.

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

The agent routes carry two rate limits, checked before the token is looked up: per IP
(`RATE_LIMIT_PER_IP`, 120 a minute) and per agent token (`RATE_LIMIT_PER_AGENT`, 60 a minute), so
neither many tokens from one address nor one token from many addresses gets past. Admin and bot
routes keep the per-IP limit. A limited request gets 429 with `retry-after`.

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
5. The payment is built by the SDK through `ChainAdapter.x402Scheme` (CR-003), whose signer is
   bound to the intent: onchain inspects and simulates the exact message first and throws
   `SigningRefused` for anything but that one transfer, which guard-core records as `rejected`.
   The SDK's own spend control is set to the intent's amount as a second lock.
6. The request is retried with `PAYMENT-SIGNATURE`. A second 402 with different terms is
   `INVALID_402`. The paid response is returned as untrusted content.

A 402 that is refused before an offer qualifies is still recorded, with any field the server sent
missing or unreadably as `unknown` (an unreadable amount as `0`), so the bot can show it.

The reason shown to the owner is the method and URL without the query string, which often carries
the API's own credentials.

### Admin

`POST /v1/admin/kill` pauses every agent first, then returns
`{ pausedAgents, ownerTransactions: { chain, description, payload }[] }`, one entry per chain's
`buildKillTx()` (CR-004). A chain that cannot build its transaction stays in the list with
`payload: null` and a description telling the owner to remove its spend limit by hand; the pause
holds regardless.

`GET /v1/admin/budget/:agentId` returns the same view as the agent's own budget route, for the bot,
which holds no agent token.

### Events to the bot

Every intent that reaches `executed`, `rejected`, `failed` or `expired` is posted to
`{BOT_URL}/hooks/intent-event` as `{ intent, sentAt }`, signed like the approval request (CR-004).
The bot decides what the owner sees. The post is never awaited: a bot that is down does not hold up
or fail a payment. A failed post is retried after 1, 4 and 16 seconds with a fresh `sentAt` each
time (the bot deduplicates on intent id and status); an event still undelivered after that is logged,
without its payload.

## Known gaps

- Nothing here has paid on devnet yet: the routes are tested end to end against
  `adapters/stub.ts`, and onchain's adapter has its own tests. INT-3 runs them together.
- Base's hot wallet balance is left out of the budget view until `shared/addresses.ts` has its USDC.

## Layout

| Path            | Contents                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `src/domain/`   | Pure logic: policy, amount math, x402 offer choice, simulation check, auth |
| `src/service/`  | The pipeline, transfers, x402, approvals, the per-agent lock               |
| `src/adapters/` | I/O: bot webhook, the paid API, the keypair file, the stub chain           |
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
