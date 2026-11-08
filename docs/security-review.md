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

## Deployment review (INT-7, run 2026-11-07/08 on the devnet stack, HUMAN-17)

Run against the deployed Fly apps (`agentguard-guard-core` and `agentguard-bot`, region gru, Solana
devnet only), not only the config. The owner ran each check from his machine; the commands are in
the session record. Both images were built from `main` as pulled at 19:00 UTC on 2026-11-07.

**Network shape**

- ✅ From the internet, `/v1/admin/chains` and `POST /v1/bot/decision` return 404 on the public
  hostname: the private listener is not exposed.
- ✅ The bot has no public service. It answers Telegram by long polling, and guard-core reaches its
  hooks only over 6PN. `/status` in Telegram reached guard-core at
  `agentguard-guard-core.internal:8787`.
- Open: `fly ips list` for the bot app was not checked. It has no `[http_service]`, so no
  traffic is routed to it even if Fly allocated an address.

**The public agent surface (GC-22)**

- ✅ TLS: `https://agentguard-guard-core.fly.dev/health` returns 200 with a valid certificate. Plain
  `http://` returns 301 to the same path over https.
- ✅ Without a token and with a wrong token, the agent routes return 401.
- ✅ With fly-agent's token, its own budget returns 200, and agent-1's budget returns 403.
- ✅ Rate limit behind Fly's proxy: 130 requests in about a minute, each with a different forged
  `Fly-Client-IP` and `X-Forwarded-For`, still drew 429s. Had the forged header been trusted, every
  key would have seen one request and none would have been limited. Fly replaces the header with the
  real client address.
- ✅ Error bodies are Fastify's 404 and the API's `{"error":"unauthorized"}`. No stack, file path or
  config value was seen.
- Open: a revoked token was not tested live. It is covered by the tests.

**Secrets (D5)**

- ✅ Inside the machine, node runs as `node`, not root. The Solana hot key is at
  `/run/agentguard/hot.json` on tmpfs, mode `0600`, owner `node`. That is owner-only like the
  planned `0400`, from the entrypoint's `umask 077`.
- ✅ `SOLANA_HOT_WALLET_KEYPAIR_JSON` is not in node's environment, only the file path
  `SOLANA_HOT_WALLET_KEYPAIR`. The env names that remain are `ADMIN_TOKEN`, `BOT_TOKEN` and
  `BOT_WEBHOOK_SECRET`, which guard-core needs to check its callers.
- ✅ No `.env`, keypair or `id.json` in the image filesystem (only the source file `keypair.ts`).
  The build context was 473 KB for guard-core and 2.49 MB for the bot. The root `.dockerignore`
  keeps keys out, and CI's decoy check covers it.
- ✅ The three shared tokens are Fly secrets, identical between the two apps (same digests), and
  not in `fly.toml`.
- Open: a full grep of `fly logs` for secrets across a payment, an approval and a kill. The log
  lines read during the run showed none, but no systematic grep was done.

**Data**

- ✅ The database is on the encrypted `guard_data` volume, at `/data/guard.db`, mode `0600`, owner
  `node`, with daily Fly snapshots kept for 5 days.
- ✅ After a 0.5 USDC payment, `spentToday` was `500000` before and after `fly machine restart`.
  The machine came back healthy, which also shows the entrypoint rewrites the key on each boot.
- Open: `pnpm db:backup` against the volume, and one restore rehearsal.

**Operations**

- ✅ A live x402 payment through the hosted guard-core: intent `24bb9338`, 0.5 USDC, auto-approved
  under the threshold. The flow was simulated, topped up from the vault, signed and executed, and
  the onchain limit then read $0.50 of $50.00.
- ✅ The kill works on the hosted stack: `/kill` → Confirm paused 1 agent and built the Solana
  owner transaction (audit `killed`, `built: true`). The signing page then reported the limit
  removed.
- **Finding, runbook:** an "Open kill in Phantom" button from an older message removes the onchain
  limit without pausing guard-core. The page is idempotent and the onchain part is the stronger
  stop, but the agent stayed unpaused until `/kill` → Confirm was run. The runbook must start
  every kill from `/kill` → Confirm. A bot change could also refuse or label stale kill
  buttons.
- **Finding, CR-008:** after a kill, `/status` says "onchain allowance could not be read", because
  the Squads account is gone and the adapter throws. Proposed fix in CR-008.
- ✅ The Fly trial stops machines after 5 minutes without a card. With a card on the account,
  they have stayed up.

## Left for INT-7

- Re-run this review on the devnet stack (HUMAN-11), and on the live Base run (HUMAN-12).
- The Base hot key finding above: D5 is now decided (a Fly secret written to a file), so the Base
  key must be read from a file like Solana's before Base launches. D6 puts Base after Solana.
- The open items in the deployment review above: the bot's IPs, a revoked token live, a log grep
  for secrets, and a backup restore rehearsal.
