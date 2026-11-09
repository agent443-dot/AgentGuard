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
- ✅ `fly ips list --app agentguard-bot` is empty (2026-11-09): the bot has no IP at all, public or
  private, beyond its 6PN address.

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
- ✅ A revoked token, live (2026-11-09): a new agent `drill-revoke` was created on the machine. Its
  token read its budget with 200, and after `revoke-agent` the same token got 401.

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
- ✅ Log grep (2026-11-09) over both apps' `fly logs` buffer (152 lines):
  - every secret, compared by value, was found 0 times. The secrets checked were the three shared
    tokens, the agent token, the Telegram bot token, the Robinhood hot key and the paywall key;
  - no `Bearer` or `Authorization`, and no 32-byte hex.

  The buffer only reached back a few hours, so this grep is repeated after the launch test
  payment and kill.

**Data**

- ✅ The database is on the encrypted `guard_data` volume, at `/data/guard.db`, mode `0600`, owner
  `node`, with daily Fly snapshots kept for 5 days.
- ✅ After a 0.5 USDC payment, `spentToday` was `500000` before and after `fly machine restart`.
  The machine came back healthy, which also shows the entrypoint rewrites the key on each boot.
- ✅ Restore drill (2026-11-09, launch blocker):
  - `db:backup` ran on the Fly machine, and `fly ssh sftp get` copied the 72 KB file to the
    owner's machine (mode 0600);
  - `restore-drill` opened a copy with the current code and migrations;
  - fly-agent's policy came back (Robinhood, USDG, 1/5, paused), as did today's spend (500000),
    both executed intents, both days' spend and all 15 audit events up to the two kills. All of it
    matched the live guard.

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

## Robinhood Chain mainnet pilot (HUMAN-21, run 2026-11-08/09, real money)

The owner's decision and its limits are in LAUNCH.md. The owner ran every step from his machine and
Phantom. Each result below was read back from chain 4663 with `robinhood-status.ts` or a balance
read, not taken from a page's word.

- ✅ Before any signature, forge ran the signing page's exact create, enable, kill and re-enable bytes
  on a mainnet fork (#114, `SigningPageMainnetTest`, 3/3). Its `setUp` requires chain id 4663.
- ✅ The built page carries `robinhood: {chainId: 4663, module 0xAA46…091C, usd 0x5fc5…d168, USDG,
hot 0x46F5…2204}`, read from the deployed `app.js`.
- ✅ Create: Safe `0xB460E05685c613EF726Fd74b91B24f4B4e989d8a` has owner `0x2cfB…F48Ba` alone (a new
  Phantom wallet with its own phrase) and threshold 1.
- ✅ Funding: the owner's USDG was checked to be `0x5fc5…d168` before it was sent. The Safe got
  4.914759 USDG.
- ✅ Enable: the module is on, and the delegate is the new mainnet hot wallet, with cap 5000000 per
  1440 min and 0 spent.
- ✅ guard-core on Fly took the Robinhood settings and the key from a piped file. `/status` showed
  "Robinhood Chain: $0.00 of $5.00 onchain today".
- ✅ Policy: chains `[eip155:4663]`, tokens `[USDG]`, 1 USDG per payment, 5 USDG a day, and one
  allowed domain.
- ✅ A live x402 payment: intent `9a594294-8b3c-469a-b963-c5eba00d3ff4` executed, 0.50 USDG, tx
  `0xa9c7abffb5676651193e866e4f02d9925a72c100ba20972226075dad78083d86`. The paywall verified the
  EIP-3009 authorization and settled it itself, paying the gas from its own key. Afterwards the Safe
  held 4.414759 USDG, the allowance showed 500000 spent, the owner held 0.5 USDG, and the hot wallet
  held 0 USDG.
- ✅ Kill: `/kill` → Confirm paused the agent (`"paused": true` on the budget route). The owner
  transaction built for Robinhood was `removeDelegate(hot, true)` on the module, value 0. Signed in
  Phantom through the page, it removed the delegate. The page read back "no longer a delegate".
- ✅ A stale browser tab of the enable link, reloaded after the allowance was set, refused to ask
  for a second signature ("already has an allowance … kill it first").
- **Finding, deploy:** the bot on Fly was built before #111, so `/kill` offered no Robinhood button.
  The manual kill link in the runbook worked. Rule: redeploy every app whose package changed in
  `main` before a live run, and check `fly status` for the new image.
- **Finding, bot (low):** after `/kill`, the bot said the Solana limit was "still live" and offered
  a Solana button, although that limit had been removed the day before and `/status` said so.
  Solana's `buildKillTx` does not check that the limit exists, and the kill text trusts it. The page
  is idempotent, so nothing breaks, but the owner is sent to a dead button. The bot session is asked
  to read the allowance state and offer buttons only for chains that still have one.

## Pre-release code review (2026-11-09, before the repository went public)

Three read-only passes over every package: guard-core; onchain and the signing page; the bot,
mcp-server, shared and e2e. No critical finding: nothing signs without the policy and the
simulation, no key or token reaches a log or an error, and the shared addresses are exact. The
most severe findings were each checked against the code, then fixed with a test:

| Finding                                                                                                                                                                      | Severity | Fix                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| The Solana kill page took the hot wallet from the link. A wrong one found no limit and showed "Already killed" while the real limit stayed live                              | high     | The kill acts only for the hot wallet the page was built for, as add-limit and the EVM kill do                    |
| A pause or kill did not reach a payment already waiting on the agent's lock: the policy was read when the request arrived                                                    | high     | `clear()` reads the policy under the lock                                                                         |
| `pnpm status` printed "spending limit: none" for any read error, which is what confirms a kill                                                                               | medium   | Only a missing account reads as none. It also exits non-zero on a member or destination other than the hot wallet |
| If Telegram refused to edit the kill prompt, the owner got neither the result nor the owner transactions                                                                     | medium   | The result arrives as a new message, and the transactions follow                                                  |
| x402 over plain http to an allowlisted host: anyone on the path could rewrite the 402 and its `payTo`                                                                        | medium   | https only, plain http only to loopback                                                                           |
| The paid server's settlement id and refused terms were stored and shown as given: a long id hid the owner's payment alert, and text reached the agent through `check_intent` | medium   | Only a base58 or hex id is kept; refused terms keep address characters only                                       |
| viem quotes the RPC URL in its errors, so a key in the URL path reached the logs                                                                                             | medium   | guard-core's error serializer removes every URL                                                                   |

Open, low, none of which moves money past the policy:

- the x402 allowlist matches the host name, not the port;
- a repeated x402 request before the owner answers opens a second approval;
- a paid response over 1 MB is marked failed after the payment;
- the bot's replay memory is lost on a restart (the hooks are private on Fly);
- `/status` with 25 or more pending approvals exceeds Telegram's message size;
- the Solana kill page trusts the multisig from the link, so a decoy multisig the owner controls
  reads "Already killed". The owner compares the address with `pnpm status`;
- a malformed keypair file can quote part of itself in the JSON parse error;
- the Solana token-account creation in a payment does not check who pays the rent (about 0.002 SOL).

- Re-run this review on the devnet stack (HUMAN-11), and on the live Base run (HUMAN-12).
- The Base hot key finding above: D5 is now decided (a Fly secret written to a file), so the Base
  key must be read from a file like Solana's before Base launches. D6 puts Base after Solana.
- The open items in the deployment review above: the bot's IPs, a revoked token live, a log grep
  for secrets, and a backup restore rehearsal.
