# Security review (INT-7)

First pass on 2026-11-03, against `main` at `d8ed5ba` (SPEC v0.3, Solana only). The live devnet run
and the Base adapter are not covered yet. Each finding records what was checked, the result, and what
is left.

## Secrets

- **Nothing committed.** No `.env`, keypair file, 64-byte key array, base58 secret key or Telegram
  bot token appears in any tracked file or anywhere in git history. Every `.env` is gitignored, and
  only `.env.example` files are tracked.
- **Keys live in files, not env values.** guard-core takes the hot wallet as a keypair path, validated
  by zod. On error it reports the path, never the contents. The devnet paywall does the same for its
  fee payer.
- **Agent tokens are stored hashed.** `create-agent` prints the token once to stdout and keeps only its
  hash.
- **Config errors name fields, not values,** in guard-core, the bot, mcp-server and the `dev:all`
  preflight. The preflight has a test asserting no secret reaches a message.

## Logs

- guard-core and the bot redact `authorization` and `x-guard-signature`, and Fastify's request
  serializer logs no other headers.
- No log statement in any package's `src/` carries a key, token or payment payload. The scripts print
  transaction signatures and public keys, which are public.

## Auth on every endpoint

| Surface          | Check                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `/v1/agent/*`    | Agent token checked against the stored hashes, revoked tokens refused. An agent acts only as itself (403); another agent's intent is a 404 |
| `/v1/admin/*`    | Admin token, constant-time compare, on a `preHandler` for the whole prefix                                                                 |
| `/v1/bot/*`      | Bot token, the same way. The preflight refuses an admin token equal to the bot token                                                       |
| bot `/hooks/*`   | HMAC-SHA256 over the raw bytes, checked before any parsing. Stale and duplicate requests are refused                                       |
| Telegram updates | Ignored unless the sender is in `OWNER_TELEGRAM_IDS`                                                                                       |
| mcp-server HTTP  | Bearer token of at least 32 chars, constant-time compare. Host header checked against DNS rebinding on loopback                            |

Low, resolved in #16: `findAgentByToken`'s comment said every row was compared, but `Array.find`
stopped at the first match. It now compares every row. With 256-bit random tokens the early exit never
revealed anything usable.

The e2e suite exercises the bad HMAC, the replayed webhook, the stranger pressing Approve, and the
cross-agent checks.

## Rate limits

- guard-core: `RATE_LIMIT_PER_IP` (default 120) requests per minute on every route. The agent routes
  also have `RATE_LIMIT_PER_AGENT` (default 60) per token, keyed by the token's hash and checked
  before the token is looked up (#35).
- Bot hooks: `HOOK_RATE_LIMIT_PER_MINUTE` (default 300) per address. A request without a
  well-formed `X-Guard-Signature` is refused in `onRequest`, before its body is read (#38).
- mcp-server HTTP: `MCP_HTTP_RATE_LIMIT` (default 60) per socket address, checked before the Host
  and token checks. It refuses a non-loopback `MCP_HTTP_HOST` unless `MCP_HTTP_ALLOW_REMOTE=true`
  (#45).
- All three count per socket address, never `X-Forwarded-For`. Behind a proxy every client shares
  the proxy's address, so **the proxy chosen in HUMAN-7 needs its own per-client limit**.

## x402 SDK versions in the lockfile

`@x402/core`, `@x402/svm` and `@x402/evm` are all `2.29.0`, above the `>= 2.28.0` floor in SPEC.

## Dependency audit (`pnpm audit`)

First pass: 2 critical, 1 high, 12 moderate. After the vitest 4.1.12 upgrade: 0 critical, 1 high,
7 moderate. None of either set is reachable from the guard's runtime paths.

| Advisory                                           | Path                                      | Reachable?                                                                                                   |
| -------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| tinypool prototype pollution to RCE (×2, critical) | vitest                                    | Dev only: test runner worker options, set by our own config                                                  |
| @vitest/mocker path traversal, code injection      | vitest                                    | Dev only                                                                                                     |
| minimatch, glob                                    | @vitest/coverage-v8                       | Dev only                                                                                                     |
| esbuild dev-server CORS                            | drizzle-kit                               | Dev only, no dev server is run                                                                               |
| bigint-buffer overflow (high, no patch)            | `@solana/spl-token` > buffer-layout-utils | No: only fixed-width u64 layout decoding reaches it, and the native binding does not load (pure-JS fallback) |
| uuid buffer bounds                                 | `@solana/web3.js` > jayson                | No: jayson calls only `v4`; the advisory is v3/v5/v6                                                         |
| stream-json DoS, prototype pollution (×3)          | `@solana/web3.js` > jayson                | No: only jayson's server-side request parser uses it, and web3.js uses its client                            |

**Done:** vitest and `@vitest/coverage-v8` are on 4.1.12, which clears both criticals and the vitest
moderates. The configs needed no change, and coverage still meets guard-core's 90% threshold on
`domain/`. minimatch is still reported, now through eslint: dev only. Do not force stream-json to 3.x
through an override: jayson asks for `^1.9` and nothing reaches the vulnerable code.

## Base (pass on 2026-11-04, `main` at `5b377a2`)

Read: `packages/onchain/src/evm/` (adapter, gate, safe, config), the Base scripts, guard-core's
chain wiring and startup checks (#35), the bot's chain-aware text (#37), mcp-server's Base support
(#39), and the e2e Base suite and paywall (#40).

- **Signing gate.** The hot wallet signs only `TransferWithAuthorization`, and only after the
  gate checks every field: domain chain id and verifying contract, from, to, value, and a validity
  window of at most an hour that has already started. Anything else is refused, with Permit as
  `PERMIT_DETECTED`. What gets signed is rebuilt from the checked values, not passed through. The
  domain `name` and `version` come from the request unchecked. A wrong value only yields a signature
  USDC rejects, so nothing is lost. The x402 scheme gets no transaction signer and no EIP-7702 path.
- **Before signing**, `x402Scheme` requires the 402's network, asset, payTo and amount to equal the
  intent guard-core approved. The e2e suite shows a payTo moved on the retry is refused.
- **Simulation** runs the exact transfer in one `eth_simulateV1` block and requires both balances
  to move by exactly the amount. CI probes that the public Base Sepolia RPC supports the method.
- **Kill** is `removeDelegate(hot, true)`, proven on the fork. Once it runs, no allowance is left
  to draw.
- **Addresses from `.env`** are checked against the chain by guard-core (#35) and by the scripts:
  each must hold code, and the USDC must report 6 decimals. The values in `shared/addresses.ts` win.
  Base Sepolia's Allowance Module is now listed there, because its code hash equals the official
  mainnet deployment's (CR-005). Base Sepolia USDC followed, confirmed by the owner against Circle's list. Every Base mainnet entry stays empty until the owner decides the launch.
- **Display.** The bot shows dollars only for the USDC listed for that chain. Any other token is
  shown in base units, marked as not a known USDC. Until CR-005 lands, Base amounts show in base
  units. Explorer links are chosen by exact chain id, and the id is URL-encoded.
- **The delegate can send its allowance to any address.** This is unlike Solana. The daily loss
  bound is the same, but a stolen hot key can move the day's cap directly. Recorded for D6 in
  `LAUNCH.md`.
- **Owner key.** The onchain scripts refuse Base mainnet while the Safe owner signs with a raw
  key (#31). EVM-9 (#41) adds a Ledger signer for the Safe owner. The scripts print both hashes the way the device shows them, and refuse if they differ from the one protocol-kit submits. It is proven against a fake device only.
- **Logs.** No script prints a key. Config errors in the scripts, guard-core and the e2e paywall name
  fields, not values.

**Open, medium: the Base hot wallet key is read raw from `HOT_WALLET_PRIVATE_KEY`.** Solana's comes
from a keypair file. In env, the key is visible to anything that can read the process environment
(`/proc/<pid>/environ`, crash reporters, a `printenv` in a debug shell). It should come from a file,
as on Solana and as D5 assumes. guard-core holds it until the owner decides D5, at the owner's request.

## Deployment review (planned, D3 Fly.io and D5 Fly secrets)

To run once GC-16/20/21/22 and BOT-12 are merged, against the deployed apps, not only the config.
Each line records what was checked and how.

**Network shape**

- guard-core's private listener (`/v1/admin/*`, `/v1/bot/*`) is reachable only over 6PN
  (`.internal`). From outside, it is checked with `curl` against the public hostname and the
  app's IPs, and must refuse or 404.
- The public listener serves only `/v1/agent/*` (GC-22). Admin and bot paths must 404 there, and
  agent paths must 404 on the private listener. This is checked live as well as by the tests.
- The bot's only public route is the Telegram webhook, behind TLS. `/hooks/*` (guard-core → bot)
  is private.
- No service binds a public port it does not need: check `fly.toml` `[[services]]` and
  `fly ips list` for every app.

**The public agent surface (GC-22)**

- TLS only. Plain HTTP is redirected or refused, and the certificate is valid for the hostname.
- Every request without a valid agent token gets a 401, before any work.
- Rate limits hold per IP and per token, behind Fly's proxy. Requests are keyed on `Fly-Client-IP`
  on this listener only, and a client-sent `Fly-Client-IP` or `X-Forwarded-For` cannot change the
  key: send a flood with forged headers and confirm a 429.
- No admin or bot capability is reachable with an agent token, and one agent cannot read another
  agent's intents (the e2e checks, rerun against the deployment).
- Error bodies leak no stack, path or config.
- A revoked token is refused on its next request.

**Secrets (D5)**

- The hot wallet key comes from a Fly secret, written by the entrypoint to a tmpfs file (GC-20),
  never to the volume. Check `mount`, file mode 0400, owner, and that the file is not in any image
  layer (`docker history`, and the image filesystem).
- No secret appears in `fly logs` across a full payment, approval and kill; and none in the image's
  environment (`fly ssh console` → `env` shows only names expected from `fly secrets list`).
- ADMIN, BOT and webhook tokens are distinct, at least 32 chars, and set as secrets, not in
  `fly.toml`.

**Data**

- The database is on the volume, and guard-core refuses an unsafe location (#35). A redeploy keeps
  the day's spend: make a payment, redeploy, and check `spentToday`.
- `pnpm db:backup` works against the deployed volume, and a restore is rehearsed once.

**Operations**

- The kill runbook works against the deployed stack: `/kill` → "Open kill in Phantom" → `status`
  shows no limit, and the agent is paused in guard-core.
- Deploys come only from protected `main` for both the Fly apps and the signing page.

## Left for INT-7

- Re-run this review on the devnet stack (HUMAN-11), and on the live Base run (HUMAN-12).
- The Base hot key finding above: D5 is now decided (a Fly secret written to a file), so the Base
  key must be read from a file like Solana's before Base launches. D6 puts Base after Solana.
- Run the deployment review above once the deploy PRs are merged.
