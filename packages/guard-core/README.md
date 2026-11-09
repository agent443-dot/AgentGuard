# @agentguard/guard-core

The guard service, and the only component that holds the hot wallet key. It checks every payment
against the policy, simulates it, asks the owner when needed, and only then signs.

- **Source of truth:** [`/SPEC.md`](../../SPEC.md): HTTP API, reject codes and the webhook contract.

## Run it

```bash
cp .env.example .env                 # fill it in; never commit .env
pnpm --filter @agentguard/guard-core create-agent my-agent   # prints the agent token once
pnpm --filter @agentguard/guard-core dev                     # API on 127.0.0.1:8787
```

A new agent's policy is empty and in shadow mode, so it pays nothing until the owner sets a policy
with `PUT /v1/admin/policy/:agentId` and switches it to `mode: "live"`. Without a terminal, the
owner does the same through the admin API (the bot's commands use it):

- `POST /v1/admin/agents { agentId }` returns `{ agentId, token }`. The token is shown once; only its
  hash is kept. 409 `{ error: "exists" }` for a taken id.
- `GET /v1/admin/agents` lists the agents with a working token, with `paused` and `mode`.
- `POST /v1/admin/agents/:id/revoke` cuts one off at its next request.
- `GET /v1/admin/doctor` checks, in plain English and never quoting a URL, key or token: the
  database accepts a write (undone at once), each chain's onchain limit is readable and in place,
  each hot wallet's gas is above its minimum and its token balance, the bot answers, and the newest
  backup is under two days old. Each warning or failure says what to do.

The budget routes add `shadow: { since, total, count }` for an agent that ran in shadow mode: what
it would have spent since its first shadowed payment, and how many payments that was.

`pnpm --filter @agentguard/guard-core revoke-agent my-agent` revokes an agent's token. It stops
working on its next request, on every agent route. The agent's intents and audit history stay.

The API listens on `127.0.0.1` unless `HOST` is set. `PUBLIC_PORT` splits it into a public listener
for the agent routes and a private one for the admin and bot routes (see Deploy on Fly.io).

For Solana, set `SOLANA_HOT_WALLET_KEYPAIR`, `SOLANA_RPC_URL` and `SQUADS_MULTISIG`; guard-core
builds onchain's adapter from them. For Base, set `BASE_CHAIN` (`eip155:84532` or `eip155:8453`) with
`BASE_RPC_URL`, `SAFE_ADDRESS`, `BASE_HOT_WALLET_KEY_FILE` and, until `shared/addresses.ts` has
verified values, `BASE_USDC` and `BASE_ALLOWANCE_MODULE`. A chain switched on with a value missing
stops the start, naming the missing variables and never their values. For Robinhood Chain (CR-007),
set `ROBINHOOD_CHAIN` (`eip155:46630` or `eip155:4663`) with `ROBINHOOD_RPC_URL`,
`ROBINHOOD_SAFE_ADDRESS` and `ROBINHOOD_HOT_WALLET_KEY_FILE`. Its dollar is Paxos's USDG, taken from
`shared/addresses.ts` only, so no env value can name another token there.

On every EVM chain, guard-core asks the chain before building the adapter: the Safe, the token and
the module must each hold a contract, and the token must report 6 decimals. Verified addresses are
asked too, so an RPC URL for the wrong chain fails at startup. If any check fails, or the RPC cannot
be reached, it refuses to start. Every configured chain runs at once.

To run offline instead, set `GUARD_STUB_CHAINS=true`: nothing
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
- **Simulation** calls `ChainAdapter.simulate`. Any reject code from the adapter refuses the
  payment, a simulation that throws is `SIM_FAILED`, and a simulation in which the wallet loses more
  of the token than the intent pays is `SIM_UNEXPECTED_EFFECT` on every chain.
- **Policy fields with defaults**: `mode` (`live`), `priceIncreaseMaxPct` (100),
  `maxPaymentsPerMinute` (10) and `requireMandate` (false). A `PUT` that leaves one out keeps the
  stored value, and a policy that never set one has the default. So a client that predates a field
  cannot reset it, and cannot switch a shadow agent live by omission. The `PUT` answers with the
  policy as stored.
- **Shadow mode** (`mode: "shadow"`): policy, pinning and simulation run as usual, then the intent
  is recorded as `shadowed` and stops there. Nothing is funded or signed, the owner is not asked,
  and an x402 fetch gets the unpaid 402 back. The daily max is held against what shadow mode would
  have spent, and both budget routes report it as `shadowSpentToday`, so the owner can watch an
  agent's habits before giving it money.
- **Breaker**: the payment that would make more than `maxPaymentsPerMinute` in a rolling minute is
  refused with `BREAKER_TRIPPED`, the agent is paused, and `POST {BOT_URL}/hooks/alert` tells the
  owner. It stays paused until the owner resumes it. Only payments about to be signed count, each
  once, and the window is kept in the database so a restart does not reset it. Resuming the agent
  clears its window. Shadow mode does not
  trip it: nothing it counts ever happened.
- **Owner approval**: at or above `approvalThreshold`, the intent is saved as `pending_approval`
  before the webhook goes out. Approval answers the threshold only: policy and simulation run again
  right before anything is sent, so a pause or a spent budget in the meantime still refuses it.
- **Top-up**: if the hot wallet holds less than the payment, the shortfall is pulled with
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
4. Policy, pinning, simulation, approval and top-up as above. Over the threshold it returns
   `pending_approval` at once. Once the owner approves, the agent repeats the same request and the
   approval is redeemed, once, for exactly those terms. Unused approvals expire with the sweep.
5. The payment is built by the SDK through `ChainAdapter.x402Scheme` (CR-003), whose signer is
   bound to the intent: onchain inspects and simulates the exact message first and throws
   `SigningRefused` for anything but that one transfer, which guard-core records as `rejected`.
   The SDK's own spend control is set to the intent's amount as a second lock.
6. The request is retried with `PAYMENT-SIGNATURE`. A second 402 with different terms is
   `INVALID_402`. The paid response is returned as untrusted content.

**Pinning.** Each executed payment pins (and, on upgrade, a migration pins each domain from the
latest payment already made), per agent and domain, the chain, token, payee and amount
(table `x402_pins`). A later 402 from that domain that names another payee, chain or token
(`RECIPIENT_CHANGED`), or asks more than `priceIncreaseMaxPct` above the pinned amount
(`PRICE_JUMP`, default 100, so up to double passes), goes to the owner even below the threshold, with
`flags` on the approval request. That is what a compromised or swapped API looks like from here. The
owner's approval re-pins; a rejection keeps the old pin, so the same request is asked again. The
first payment to a domain has no pin to compare with and is judged by the policy alone.

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

`GET /v1/admin/chains` lists every chain guard-core runs, each with its onchain allowance (CR-006).
The allowance is `{ status: 'none' }` when the chain shows no limit at all, as after a kill
(CR-008), and `null` only when reading it failed. An empty list means every payment is refused.

Both budget routes carry `chains`: the chains guard-core runs that this agent's policy also allows,
so an agent learns where it can pay and nothing more of the setup.

`GET /v1/admin/budget/:agentId` returns the same view as the agent's own budget route, for the bot,
which holds no agent token.

### Mandates

A mandate is a budget for one task, inside the policy: its domains and recipients must already be
allowed, its budget is at most the daily max, and it lives 60 seconds to a day (`ttlSeconds`).

- `POST /v1/agent/mandates`: below `approvalThreshold` it starts `active`. At or above it, it is
  `pending_approval` and goes to the owner on the approval-request hook as `{ mandate, simulation,
approveBefore }`, with no intent. The bot answers at `POST /v1/bot/mandates/:id/decision`: 409
  once decided, 410 after the same ten minutes as a payment. Its time starts at the approval.
- `POST /v1/admin/mandates` opens one that starts active; `POST /v1/admin/mandates/:id/revoke`
  ends one. Both admin routes are the owner's.
- A transfer or x402 fetch with `mandateId` must fit the mandate as well as the policy:
  `MANDATE_EXCEEDED` above what is left (or once it is used up), `MANDATE_EXPIRED` when it is not
  active or its time is over, and the recipient or domain must be the mandate's. With
  `requireMandate`, a payment without one is `MANDATE_REQUIRED`, as is an unknown id or another
  agent's.
- Spend is added to the mandate at the same moment as to the day's total, under the agent's lock.
  At its budget it becomes `exhausted`. The sweep expires mandates, and the budget routes list the
  active ones.

A mandate wider than the policy is refused with 422 `{ error: "outside_policy", rejectReasons }`.

### Report

`GET /v1/admin/report?from&to` (ISO times; the last seven days by default, a year at most) returns
every agent, a quiet one included, with what its executed payments spent (the sum in base units of
each chain's dollar, USDC or USDG, all with 6 decimals), how many there were,
every refusal counted by code, and the spend per x402 domain, biggest first.

### Receipts

With `RECEIPT_SIGNING_KEY_FILE` set, an Ed25519 private key in PEM that is separate from every hot
wallet key, each executed payment gets a signed receipt: the intent, the SHA-256 of the canonical
JSON of the policy it cleared under, the simulation summary, who approved it (`policy`, `owner` or
`passkey`) and the time. The signature covers the canonical JSON of all of that: keys sorted at
every depth, no whitespace. The policy, simulation and approver are recorded when the payment
clears, because the policy may change before it executes.

- `GET /v1/agent/intents/:id/receipt`: 404 until the intent has executed, and for another agent's.
- `GET /v1/admin/receipts?from&to`: the same period rules as the report.
- `GET /v1/receipts/key` on both listeners, without a token: `{ publicKey }`, the raw 32-byte key in
  hex, so anyone holding a receipt can check it without trusting this server.

Without the key, receipts are off and nothing else changes. Generate one with
`openssl genpkey -algorithm ed25519 -out receipt.pem`. On Fly it is the `RECEIPT_SIGNING_KEY`
secret, which the entrypoint moves to tmpfs like the hot keys.

### Passkey approvals

With `PASSKEY_ABOVE` set (an amount), an intent at or above it can be approved only with a passkey
the owner enrolled, never by a Telegram tap alone. A stolen Telegram account can still reject it,
never approve it. `PASSKEY_RP_ID` and `PASSKEY_ORIGIN` name guard-core's public address, which the
passkey is bound to, so a look-alike site cannot use it.

- Enrolment, through the admin routes only: `POST /v1/admin/passkeys/options` returns the WebAuthn
  registration options, and `POST /v1/admin/passkeys { response }` verifies and stores the
  passkey's public key. It requires user verification, and the challenge is single-use and lasts
  five minutes.
- The approval request for such an intent carries `passkey: true`, and `/v1/bot/decision` answers
  `approve` with 403 `passkey_required` (a rejection still works).
- `GET /owner/approve/:intentId`, on the public listener, is a small page that runs WebAuthn for
  this origin. Its challenge is bound to that one intent, single-use, and expires with it.
  `POST /v1/owner/approve { intentId, assertion }` verifies the assertion and approves; a transfer
  is then sent, and an x402 payment waits for the agent's repeat, as after a Telegram approval. The
  receipt says `approvedBy: "passkey"`.
- The page's CSP allows only its own script (no inline code) and its own API, and the agent's text
  is shown as text. The public listener's rate limit applies.

Enrol a passkey before setting `PASSKEY_ABOVE`: with it set and none enrolled, guard-core refuses to
start, because nothing above the amount could ever be approved.

### Events to the bot

A flagged approval request also carries `pinned: { recipient, amount }`, the domain's last executed
payment, so the bot can show the old payee and how many times the last price this is.

`POST {BOT_URL}/hooks/alert { kind, agentId, detail, sentAt }`, signed the same way, carries what
the owner must act on now: today, a tripped breaker. It is retried like an intent event.

Every intent that reaches `executed`, `rejected`, `failed` or `expired` is posted to
`{BOT_URL}/hooks/intent-event` as `{ intent, sentAt }`, signed like the approval request (CR-004).
The bot decides what the owner sees. The post is never awaited: a bot that is down does not hold up
or fail a payment. A failed post is retried after 1, 4 and 16 seconds with a fresh `sentAt` each
time (the bot deduplicates on intent id and status); an event still undelivered after that is logged,
without its payload.

## Known gaps

- The routes are tested end to end against `adapters/stub.ts`, and onchain's adapters have their
  own tests. Live payments ran on Solana devnet, Base Sepolia and Robinhood Chain mainnet; the
  open items are in [`docs/security-review.md`](../../docs/security-review.md).

## Layout

| Path            | Contents                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `src/domain/`   | Pure logic: policy, amount math, x402 offer choice, simulation check, auth |
| `src/service/`  | The pipeline, transfers, x402, approvals, the per-agent lock               |
| `src/adapters/` | I/O: bot webhook, the paid API, the keypair file, the stub chain           |
| `src/http/`     | Fastify routes per role, zod schemas, bearer auth, rate limits             |
| `src/db/`       | Drizzle + SQLite schema, migrations, queries                               |
| `src/main.ts`   | Startup: config, migrations, adapters, the expiry sweep timer              |
| `deploy/`       | The container entrypoint that moves Fly secrets to tmpfs                   |

## Security

- The hot wallet keys are read from files, `SOLANA_HOT_WALLET_KEYPAIR` (a Solana CLI keypair) and
  `BASE_HOT_WALLET_KEY_FILE` (0x and 64 hex digits), and live only in this process (later: KMS).
  Never logged, never returned by any endpoint. Logs redact `authorization` and
  `x-guard-signature`. The old raw `HOT_WALLET_PRIVATE_KEY` is refused at startup: move the key to
  a file, `chmod 600`, outside the repository.
- In a deployment the keys arrive as Fly secrets, `SOLANA_HOT_WALLET_KEYPAIR_JSON` (the keypair
  file's contents) and `BASE_HOT_WALLET_KEY`. `deploy/entrypoint.sh` runs as root, mounts tmpfs at
  `/run/agentguard`, writes each key there with mode 600 for the `node` user, points the two path
  variables at the files, unsets the secrets and only then starts guard-core as `node`. It refuses
  to start if tmpfs cannot be mounted, so a key never lands on disk.
- Agent tokens are stored only as SHA-256 hashes and compared in constant time.
- Amounts are `bigint` internally. No floats for money.
- Agent-provided text (`reason`, URLs, headers, API responses) is untrusted and never affects a
  decision.

## Database

SQLite, at `DATABASE_URL`. It holds the day's spend per agent, pending approvals and the audit log,
so losing it resets the daily max to zero. **In production it must live on a persistent volume**,
outside the repository and outside any temp directory. On Solana or Base mainnet, guard-core refuses
to start otherwise. Devnet and local runs may keep the default `./data/guard.db`.

`pnpm --filter @agentguard/guard-core db:backup [destination]` copies the live database with SQLite's
online backup API. It is safe while guard-core is running and never overwrites an existing file.
With no destination, the copy goes to `backups/guard-<time>.db` next to the database.

Env vars are documented in [`.env.example`](./.env.example).

## Deploy on Fly.io

`Dockerfile` and `fly.toml` run guard-core as one machine, `agentguard-guard-core`, in the same org
and region (`gru`) as the bot (`agentguard-bot`, see its README):

- **Two listeners**, each with only its own routes registered:
  - **public**, `0.0.0.0:8080` behind Fly's TLS (`force_https`): `/v1/agent/*` and `/health`,
    nothing else. Agents call `https://agentguard-guard-core.fly.dev/v1/agent/...`. The per-IP
    limit keys on `Fly-Client-IP`, the real client, believed on this listener only.
  - **private**, `fly-local-6pn:8787`: `/v1/admin/*`, `/v1/bot/*` and `/health`. No Fly service
    exposes it. The bot reaches it at `http://agentguard-guard-core.internal:8787`, and guard-core
    calls the bot at `http://agentguard-bot.internal:8788` (`BOT_URL` in `fly.toml`).

  Both listeners share one set of deps, so the per-agent lock covers an agent's request and the
  owner's approval alike. Without `PUBLIC_PORT`, as in a local run, one listener on `HOST:PORT`
  serves every route.

- **One machine.** The database is SQLite on the `guard_data` volume at `/data`, and a volume
  belongs to one machine. Hence `--ha=false`.
- **The image holds no secret.** The build copies only `package.json` and `src` of shared, onchain
  and guard-core, then runs `pnpm deploy --prod`. The root `.dockerignore` keeps every `.env`, key
  and database out of the build context. The container starts as root only so
  `deploy/entrypoint.sh` can mount tmpfs for the hot keys, then runs node as `node`.

Owner commands, run in bash on your own machine from `~/AgentGuard`, after the bot's steps 1 and 2
(flyctl installed and logged in). No secret is typed or printed: each one is piped from a file.

```bash
# 1. Create the app and its database volume, in the bot's org and region. Once only.
fly apps create agentguard-guard-core --org <your-fly-org>
fly volumes create guard_data --app agentguard-guard-core --region gru --size 1

# 2. Settings, read from guard-core's .env. The three tokens must equal the bot's GUARD_ADMIN_TOKEN,
#    GUARD_BOT_TOKEN and BOT_WEBHOOK_SECRET, as they already do for the local runs. SOLANA_CHAIN
#    must be in the .env for mainnet: without it guard-core runs on devnet.
cd ~/AgentGuard && grep -E '^(ADMIN_TOKEN|BOT_TOKEN|BOT_WEBHOOK_SECRET|SOLANA_CHAIN|SOLANA_RPC_URL|SQUADS_MULTISIG|ROBINHOOD_CHAIN|ROBINHOOD_RPC_URL|ROBINHOOD_SAFE_ADDRESS)=.' packages/guard-core/.env | fly secrets import --app agentguard-guard-core --stage

# 3. The hot wallet key, piped from the keypair file that SOLANA_HOT_WALLET_KEYPAIR names (a full
#    path, no ~). On mainnet it must be a new key, never used on devnet.
cd ~/AgentGuard && key="$(grep '^SOLANA_HOT_WALLET_KEYPAIR=' packages/guard-core/.env | cut -d= -f2-)" && { printf 'SOLANA_HOT_WALLET_KEYPAIR_JSON='; tr -d ' \n' < "$key"; echo; } | fly secrets import --app agentguard-guard-core --stage

# 4. Deploy one machine. The first test refuses to run if a .env would reach Fly's builder.
cd ~/AgentGuard && if grep -qx '\*\*/.env' .dockerignore; then fly deploy . --config packages/guard-core/fly.toml --dockerfile packages/guard-core/Dockerfile --ha=false; else echo 'STOP: the root .dockerignore must exclude **/.env'; fi

# 5. Check: one machine, its health check passing, and no config error in the log. Then the public
#    side: /health answers, and an admin route is not there at all (404).
fly status --app agentguard-guard-core && fly checks list --app agentguard-guard-core && fly logs --app agentguard-guard-core --no-tail
curl -s https://agentguard-guard-core.fly.dev/health && curl -s -o /dev/null -w '%{http_code}\n' https://agentguard-guard-core.fly.dev/v1/admin/chains
```

For Robinhood Chain, pipe its key the same way as step 3, from the file that
`ROBINHOOD_HOT_WALLET_KEY_FILE` names:

```bash
cd ~/AgentGuard && key="$(grep '^ROBINHOOD_HOT_WALLET_KEY_FILE=' packages/guard-core/.env | cut -d= -f2-)" && { printf 'ROBINHOOD_HOT_WALLET_KEY='; tr -d ' \n' < "$key"; echo; } | fly secrets import --app agentguard-guard-core --stage
```

To change a setting or a key later, repeat step 2 or 3 without `--stage`: Fly restarts the machine,
and the entrypoint writes the new key on the way up. Base, once D6 allows it, follows step 3 with
`BASE_HOT_WALLET_KEY` and the key file's contents, and step 2 with its `BASE_*` and `SAFE_ADDRESS`
settings.
