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

- guard-core: 120 requests per minute per IP, across all routes.
- The bot hooks and mcp-server HTTP have no rate limit. Both bind to `127.0.0.1` by default, and both
  authenticate before doing any work. **Before deploying (HUMAN-7)**, decide what sits in front of
  each: guard-core also listens only on `127.0.0.1` today.

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

## Left for INT-7

- Re-run this review on the devnet stack (HUMAN-11), and again once the Base adapter lands (INT-6).
- A deployment review once HUMAN-7 picks a host: TLS, what fronts each service, and secrets in a
  manager rather than files.
