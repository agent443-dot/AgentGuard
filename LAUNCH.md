# LAUNCH.md: what has to happen before real money

Draft (INT-8) as of 2026-11-03, written against `main` at `571db23`. **AgentGuard is not ready for
mainnet.** This document lists exactly what is missing. It describes the code as it is, not as
planned. Anything proven only on a stub chain is marked as such.

## 1. Owner decisions

Made by the owner on 2026-11-05, in the integrator session. None of these can be made by a session.

| #   | Decision                                                                                 | Answer                                                                                                                                                                                                                                                                                                                                                                                                           | Status                     |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| D1  | **Mainnet daily cap**, per chain                                                         | **20 a day on each launch chain** (20 USDC on Solana, `DAILY_CAP=20000000`; 20 USDG on Robinhood Chain, allowance `amount=20000000`), with each hot wallet holding at most 10. Max daily loss across both chains: about 60. Raised to 50 a day per chain only after 2 to 3 weeks without incidents. Changed by the owner on 2026-11-09, from 50 USDC on one chain, when he chose two launch chains.              | **decided**                |
| D2  | **Per-agent policy for launch**: `perTxMax`, `dailyMax`, `approvalThreshold`, allowlists | Each new agent: **5 per payment, 20 a day, Telegram approval above 1**, deny-all to start, and only domains the owner adds. The daily max went from 25 to 20 on 2026-11-09, to match the onchain cap (D1).                                                                                                                                                                                                       | **decided**                |
| D3  | **Deploy host** (HUMAN-7)                                                                | **Fly.io**, region `gru`, a persistent volume for the database. guard-core's agent routes are public behind TLS at `https://agentguard-guard-core.fly.dev`, and its admin and bot routes stay on Fly's private network. The bot has no public URL (long polling).                                                                                                                                                | **decided**                |
| D4  | **Owner key custody**                                                                    | **Phantom**, a software wallet: the owner's choice, against the recommendation of a hardware wallet. The owner key can move the whole vault, so it stays in Phantom and is **never exported to a file**. The owner signs its operations through Phantom, not through this repo's scripts. See the D4 blocker in §2.                                                                                              | **decided, risk accepted** |
| D5  | **Hot wallet key storage**                                                               | **Fly.io secrets**, written to an in-memory file at startup, delivered as `SOLANA_HOT_WALLET_KEYPAIR`. KMS later, when the cap rises.                                                                                                                                                                                                                                                                            | **decided**                |
| D6  | **Chain order**                                                                          | **Solana and Robinhood Chain together at launch, then Base.** Changed by the owner on 2026-11-09 after the Robinhood Chain mainnet pilot (HUMAN-21) proved its path with real money: Safe, allowance, x402 payment, kill. Before that: Solana first, then Robinhood Chain (2026-11-07, CR-007), then Base. Robinhood Chain's dollar is USDG. Its Allowance Module lets the delegate send to any address (below). | **decided**                |
| D7  | **Launch model**                                                                         | **Open source, self-hosted.** Anyone runs their own AgentGuard, with their own vault, Phantom wallet, bot and signing page ([`docs/self-host.md`](docs/self-host.md)). The owner's deployment serves only the owner. A hosted service with one vault per customer is a later product: it needs a CR (SPEC is single-owner) and a legal review. Decided by the owner on 2026-11-09.                               | **decided**                |
| D8  | **License**                                                                              | **Apache-2.0**, in `LICENSE` and every `package.json`. Decided by the owner on 2026-11-09.                                                                                                                                                                                                                                                                                                                       | **decided**                |

**Base differs from Solana in where the daily allowance can go.** On Solana, the spending limit's
only destination is the hot wallet: a stolen hot-wallet key can only draw the day's cap into the hot
wallet and spend from there. On Base, the Safe Allowance Module lets the delegate send its allowance
to **any** address, so a stolen hot-wallet key can pull the day's cap straight to an attacker. The
daily loss bound is the same on both chains (cap + hot wallet balance), but on Base the guard's
checks never see that draw. The Safe owner signs on a Ledger since EVM-9 (#41): `OWNER_SIGNER=ledger` for `create-safe`,
`enable-allowance` and `kill:base`, and the scripts refuse Base mainnet with a raw key. It is proven
against a fake device only; the real-hardware run is below.

**Robinhood Chain mainnet pilot (owner decision, 2026-11-08).** The testnet faucets blocked the
HUMAN-20 run: no USDG faucet was confirmed on 46630, and the hot wallet could not be funded. So the
owner chose to skip the testnet and run Robinhood Chain on mainnet (4663) with real money. These are
the limits he chose when the risk was put to him:

- a daily cap of **5 USDG**, with the Safe holding about 10 USDG and about $5 of ETH for gas;
- a **new Phantom wallet with its own recovery phrase** as the only owner of the Safe;
- a new hot wallet key, generated for mainnet.

**Risk accepted by the owner:** the EVM signing pages (create, enable, kill) and the USDG x402 path
have run only against forks and fakes, never live. A bug costs at most the day's cap plus what the
hot wallet holds. The Allowance Module's any-recipient risk (Base, above) applies here too. This is
a pilot at a pilot's cap. It does not lift D1, and it does not clear the launch blockers in §2.

**Pilot result (2026-11-09):** the full path worked live on 4663, and each step was read back from
the chain:

- the owner created Safe `0xB460…9d8a` in Phantom;
- he funded it with 4.91 USDG and set the 5 USDG/day allowance;
- the agent paid 0.50 USDG over x402 (tx `0xa9c7…3d86`);
- `/kill` paused guard-core;
- the owner's kill removed the delegate.

Details and two findings are in docs/security-review.md. The pilot found that the bot on Fly was
older than `main`. **Before any live run, redeploy every app whose package changed and check the
image in `fly status`.** Since then, `.github/workflows/deploy.yml` deploys guard-core and the bot
after CI passes on `main`, once the owner has added their deploy tokens (HUMAN-22). If a chain's Phantom kill button is missing, use the manual kill link:
`https://agentguard-onchain.vercel.app/?action=kill&cluster=robinhood&safe=<Safe>&issued=$(date +%s)`,
opened within 15 minutes, from `/kill` → Confirm first.

**One owner wallet for both chains (owner decision, 2026-11-09).** The same new Phantom wallet, with
one recovery phrase, owns the Robinhood Chain Safe and will own the Solana multisig. That phrase
therefore reaches both vaults. This is accepted on the D4 conditions: the wallet is used for nothing
else, and each vault holds only what its agents need for the coming days.

**Key rule, not a decision:** mainnet uses **new keys only**, owner and hot wallet both, generated for
mainnet and never used on devnet. A devnet seed phrase has been exposed, so no devnet key, and nothing
derived from its seed, may control mainnet funds.

## 2. Pre-launch checklist

Each line can be checked by someone other than its author.

### Proven

- [x] SPEC v0.3 is implemented in every package and the packages agree with each other (integration
      review, PRs #1–#17).
- [x] CI is green on `main`: lint, typecheck, 530 tests.
- [x] `pnpm dev:all` starts all three services, and its preflight refuses mismatched `.env` files.
      **Stub chains only**; see the open items.
- [x] E2E flows (INT-4): all five pass in CI. **Stub chain and recorded Telegram only.**
- [x] Attack suite (INT-5): 24 cases pass in CI. **Stub chain only.** The Solana detection codes come
      from a stub; real detection is unit-tested in `packages/onchain`.
- [x] Onchain cap live on devnet, 3 of 4 properties (SVM-8, run by the onchain session on the owner's
      machine): a draw inside the cap succeeds, `cap + 1` is refused by the Squads program, and after
      `kill` a draw fails because the limit no longer exists.
- [x] Security review, first pass (`docs/security-review.md`): no secrets in git history, no keys in
      logs, auth checked on every endpoint, no reachable critical advisory.

- [x] **GC-12: guard-core binds a deployable interface** (#19). `HOST` defaults to `127.0.0.1`. A
      deployment sets it, `0.0.0.0` behind its own TLS and firewall, once D3 is decided.
- [x] **GC-13: `pnpm revoke-agent <agentId>`** (#19). The token gets a 401 on every agent route from
      its next request on. The agent's intents and audit history are kept.

- [x] **SVM-9: owner signing on a Ledger** (#20). Every owner script (`create-multisig`,
      `add-spending-limit`, `fund-vault`, `kill`) takes `SOLANA_OWNER_KEYPAIR=usb://ledger?key=0`.
      Before each signature it prints the Message Hash the device must show. `kill` refuses before
      asking the device if the key is not the config authority. **Proven against a fake device
      only**: the real-hardware run is open, below.

- [x] **HUMAN-11: the full stack on Solana devnet** (2026-11-04, run by the owner). It used the real
      Solana adapter, Telegram and the devnet paywall, with every payment from hot wallet
      `H5fcEu5KppqfZH83H34YXVwjwCamjfHDjGx1d8eykHjw`:
  - a 1.5 USDC transfer approved on Telegram;
  - a 0.5 USDC x402 payment paid without asking;
  - a 1.5 USDC x402 payment approved on Telegram and redeemed once.

  The tx ids are in `coordination/HUMAN_TODO.md`. This closes INT-3 and INT-4.

- [x] **HUMAN-12 and HUMAN-13: the full stack on Base Sepolia** (2026-11-05, run by the owner). Safe
      `0x1df91C7e227370F138Ae546f3D2fa2Fde8a48C2D`, owned by the owner key alone, with the hot wallet
      as Allowance Module delegate and a 100 USDC daily cap. The payments, all x402 through guard-core
      to the self-settling Base paywall:
  - 0.5 USDC paid without asking, and 1.5 USDC approved on Telegram and redeemed once;
  - the official run, **from an empty hot wallet**: 0.5 USDC drawn from the Safe through the
    module, then paid (`0x1f40b2d0…4493`). The Safe fell by exactly 0.5 USDC.

  The first attempt from an empty hot wallet was refused with `SIM_FAILED`. The simulation ran before
  the top-up and saw a hot wallet with nothing in it. Solana had the same gap, plus a hot wallet
  without a token account could not receive the draw. Both are fixed in #63, with the reason now
  logged (#62). **Re-checked live on Solana devnet** from a hot wallet with no USDC token account at
  all: 0.5 USDC drawn from the vault and paid (`23kwrFor…ccDh`). This closes INT-6.

- [x] **SVM-8: all four cap properties as automated tests** (#22), against the real Squads v4
      program (dumped from mainnet) under LiteSVM 1.6.1. A draw up to the cap succeeds, `cap + 1` is
      refused with `SpendingLimitExceeded`, the limit refills after a warped day, and nothing can be
      drawn after the kill.
- [x] **INT-5: the Solana attack suite**, done 2026-11-04. All 24 cases pass, real devnet payments
      go through the same inspection and simulation, and the onchain cap is proven. The gate for
      the Base work is open.

### Open

- [ ] **Launch conditions for a Phantom owner (D4)**, all three mandatory:
  - a **fresh recovery phrase** dedicated to the owner account, created for it. Not a new account
    added to an existing Phantom, which would share that wallet's phrase;
  - that account is **used for nothing else**: no dapps, no other tokens, no signing anything but
    AgentGuard's owner operations;
  - the **vault is kept low**: it holds only what the agents need for the coming days, since a
    stolen owner key reaches all of it, not just the daily cap.
- [ ] **Launch blocker, tied to D4: the owner's operations from Phantom, without exporting the key.**
      The repo's scripts sign with a key file or a Ledger, and neither fits D4. On devnet, with a
      **new** Phantom account used for nothing else, prove the owner can create the multisig and
      the spending limit, and, above all, remove the spending limit (the kill) by signing in Phantom,
      for example through the Squads app. Pass criteria: the kill lands on devnet signed from
      Phantom, `pnpm status` then prints `spending limit:   none at <address>`, and no Phantom key
      ever sits in a file. Until this passes, the kill switch's last step has no tested path.
- [ ] **The Phantom signing page is a trust root (D4, [ADR 003](docs/adr/003-phantom-owner.md)).**
      Whoever can change the deployed page can ask the owner to sign a harmful config change behind
      a harmless summary. Before launch: it is its own project on its own subdomain, separate from
      the landing site; it is deployed only from protected `main`, with preview deployments off, since a
      PR branch's preview would be an unreviewed signing page on a public URL; it has a strict
      Content-Security-Policy, no third-party scripts at runtime, and pinned dependencies; and
      `status` fails on any limit or member other than the expected ones.
- [x] **ADR 003's devnet checks, run with a fresh Phantom account (HUMAN-15, 2026-11-07).** Results in
      the ADR: 3 and 4 passed, 5 passed on iOS, and 1 and 2 were skipped as optional. **Left:** check 5
      on Android, if the owner will ever kill from an Android phone. The checks were:
  1. whether the Squads app can set a config authority at creation;
  2. whether it can add a limit for a hot wallet that is not a voting member. Checks 1 and 2 only
     decide whether the app can be a setup fallback;
  3. whether Phantom signs and sends a transaction the page has already partly signed (`createKey`);
  4. what Phantom shows for `multisigRemoveSpendingLimit`: the origin, the simulation, any decoding;
  5. whether the universal link opens the page inside Phantom on iOS and Android, from Telegram.
- [ ] **Only if D4 moves to a Ledger later: the Ledger path on real hardware, on devnet.** Follow
      "The owner on a Ledger" in `packages/onchain/README.md` with a real device. Pass criteria:
  - for `create-multisig`, `add-spending-limit` and `kill`, the **Message Hash shown on the device
    equals the one the script printed**, character for character. The tests only show that the
    script and the fake device agree with each other, not that the formula matches the real Solana
    app. If it does not match, the owner would see a mismatch every time and, in an emergency,
    reject his own kill;
  - each of the three lands on devnet, signed by the Ledger;
  - after the kill, `pnpm status` prints `spending limit:   none at <address>`;
  - blind signing is off again at the end.
- [ ] **Launch blocker for Base, tied to D4: the Safe owner on a real Ledger, on Base Sepolia.**
      Follow "The Safe owner on a Ledger" in `packages/onchain/README.md`. Pass criteria:
  - for `create-safe`, `enable-allowance` and `kill:base`, the **Domain hash and Message hash on
    the device equal the printed ones**, character for character (`0x` and uppercase, as the app
    shows them);
  - with Blind signing off, the script stops and says to turn it on;
  - each of the three lands on Base Sepolia, signed by the Ledger, gas paid by the executor;
  - after the kill, `pnpm status:base` shows no allowance for the hot wallet;
  - Blind signing is off again at the end.
- [ ] **Mainnet keys** generated fresh (key rule above). The owner key is a new Phantom account,
      used for nothing else (D4). The hot wallet key goes into Fly.io secrets (D5).
- [ ] **Mainnet setup**, with the new keys:
  - the multisig and the spending limit are created **signed from the Phantom owner account**, by the
    path the D4 blocker proves on devnet. The creating key becomes the config authority, the only key
    that can remove the limit, and no script here moves it afterwards. The repo's
    `create-multisig` and `add-spending-limit` would need the key as a file, so they are not used on
    mainnet;
  - `USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle; also in
    `packages/shared/src/addresses.ts`);
  - `DAILY_CAP` set from D1;
  - `pnpm status` read back: the cap, the hot wallet as the only member, and the hot wallet as the
    only destination.
- [ ] **guard-core on mainnet**: `SOLANA_CHAIN=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, set
      explicitly, because the default is devnet. Also `GUARD_STUB_CHAINS=false`, a mainnet
      `SOLANA_RPC_URL`, and the new `SQUADS_MULTISIG`. The mcp-server `DEFAULT_CHAIN` must match.
- [ ] **Persistent database.** `DATABASE_URL` defaults to `file:./data/guard.db`. The host needs a
      persistent volume, or intents, the audit log and daily spend are lost on redeploy. Since #35,
      guard-core refuses to start on mainnet with the database in memory, inside the repository or
      in a temp directory, and `pnpm db:backup` takes a consistent copy while it runs. Done on Fly:
      the encrypted `guard_data` volume with daily snapshots, and `spentToday` survived a restart
      (INT-7). **Left:** a backup schedule.
- [x] **Launch blocker: one backup restore rehearsed** (passed 2026-11-09, results in
      docs/security-review.md). The drill:
  1. `db:backup` on the Fly machine, into `/data/backups/`;
  2. `fly ssh sftp get` the file to the owner's machine. That copy is the one that survives a lost
     volume;
  3. `pnpm --filter @agentguard/e2e restore-drill <file>` opens a copy of it with this repo's code
     and migrations, then prints each agent's policy and today's spend as the admin routes serve
     them, plus the audit trail.

  Pass when what it prints matches `/status` and the budget route on the live guard. Until then, a
  lost volume means a guard with no history and a reset daily spend.

- [ ] **Security review repeated**: on the devnet stack, and on the deployed configuration (TLS, what
      fronts each service, secrets in the manager). Done live on Fly for devnet (INT-7,
      `docs/security-review.md`). **Left:** the bot app's `fly ips list`, a revoked token tested
      live, a grep of `fly logs` for secrets across a payment, an approval and a kill, and the
      restore rehearsal above.
- [x] **Rate limits on the bot hooks and the MCP HTTP endpoint.**
  - Bot hooks (#38): `HOOK_RATE_LIMIT_PER_MINUTE`, default 300. A request without a well-formed
    signature is refused before its body is read.
  - MCP HTTP (#45): `MCP_HTTP_RATE_LIMIT`, default 60. It stays on loopback unless
    `MCP_HTTP_ALLOW_REMOTE=true`.
  - guard-core (#35): limits per IP, and per agent token on the agent routes.

  All three count per socket address. A proxy in front (HUMAN-7) needs its own per-client limit.

- [ ] **Bug bounty, landing page, MCP setup docs for agent builders** (INT-8 scope).
  - MCP setup guide: done (#46, "For agent builders" in `packages/mcp-server/README.md`).
  - Landing page: a draft in `site/` (#34, #36). Its repo links say "coming soon" until the repo is
    public.
  - Bug bounty: not started.
- [ ] **Open-source release (D7, D8).** Done in the repository: `LICENSE`, `SECURITY.md`,
      `docs/self-host.md`, and the README rewritten for outside readers. A scan of all 494 commits
      found no key, token or keypair (2026-11-09). Left for the owner, in GitHub settings, in this
      order:
  1. make `main` the default branch;
  2. protect `main`: PRs only, green CI, no force-push;
  3. turn on private vulnerability reporting, secret scanning and push protection;
  4. flip the repository to **public**, last.

  Commit author emails become public with the history.

- [ ] **Final report** (INT-9), and the owner's written go-ahead (HUMAN-8).

## 3. Deployment shape

From `packages/guard-core/fly.toml` and `packages/telegram-bot/fly.toml` (#83, #86). Two Fly apps in
one org, region `gru`, built from the repo root with the root `.dockerignore`. CI checks that no
secret pattern reaches either build context.

| App                     | Listens on                                                  | Reached by                                                      | Public?                               |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `agentguard-guard-core` | `0.0.0.0:8080`: `/v1/agent/*`, `/health`                    | agents' MCP servers, at `https://agentguard-guard-core.fly.dev` | **yes**, Fly TLS, `force_https`       |
|                         | `fly-local-6pn:8787`: `/v1/admin/*`, `/v1/bot/*`, `/health` | the bot, at `http://agentguard-guard-core.internal:8787`        | no, 6PN only                          |
| `agentguard-bot`        | `fly-local-6pn:8788`: `/hooks/*`                            | guard-core, at `http://agentguard-bot.internal:8788`            | no; talks to Telegram by long polling |

- **guard-core** is the only process holding the hot wallet key. It runs one machine, never
  auto-stopped: the expiry sweep, the approvals and the day's spend need it up. The database is
  `/data/guard.db` on the `guard_data` volume. The entrypoint mounts tmpfs at `/run/agentguard`,
  writes the hot keys there at mode 0600 from Fly secrets, unsets the secrets, and runs node as
  `node` (GC-20). The public listener trusts `Fly-Client-IP` for rate limits. The private one
  ignores it.
- **telegram-bot** needs no public URL. It keeps pending approval messages in memory. On restart they
  are forgotten, and guard-core's expiry sweep closes the intents with `APPROVAL_TIMEOUT`. That is
  fail-safe, but the owner sees no buttons for anything pending at the time.
- **mcp-server** is not deployed by us. It runs next to each agent, on stdio, with
  `GUARD_URL=https://agentguard-guard-core.fly.dev` (https is required for a remote guard-core,
  MCP-12), and the agent token only in its environment.
- **The signing page** is its own Vercel project, `agentguard-onchain`, deployed from `main` only
  (ADR 003).
- **Secrets**, as Fly secrets, never in the repo, `fly.toml` or an image:
  - guard-core: `ADMIN_TOKEN`, `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `SOLANA_RPC_URL`,
    `SOLANA_HOT_WALLET_KEYPAIR_JSON` (and `BASE_HOT_WALLET_KEY` once Base launches);
  - bot: `TELEGRAM_BOT_TOKEN`, `GUARD_BOT_TOKEN`, `GUARD_ADMIN_TOKEN`, `BOT_WEBHOOK_SECRET`,
    `OWNER_TELEGRAM_IDS`;
  - each agent's host: `AGENT_TOKEN`.

## 4. Incident runbook

**Who presses kill:** the owner, anyone in `OWNER_TELEGRAM_IDS`. Only the owner key can remove the
onchain limit. **When:** an attack alert they do not recognise, payments they did not expect, a
leaked token or key, or any doubt at all. A kill is cheap to undo; a drain is not.

### Kill, in order

**Always start from `/kill` in Telegram.** A Phantom kill button from an older message removes the
onchain limit but does not pause guard-core. That happened on the first hosted run (INT-7), and the
agent stayed unpaused until `/kill` was confirmed. BOT-13 makes old buttons expire.

1. **Stop new payments.** In Telegram send `/kill`, then press **Kill everything**. guard-core
   pauses every agent first (`POST /v1/admin/kill`). From then on every payment is refused with
   `PAUSED`. The bot then shows the owner transaction for each chain. If Telegram is unavailable, use
   the same call directly. On Fly the admin route is private, so open it on your machine first with
   `fly proxy 18787:8787 --app agentguard-guard-core` in another terminal, then:

   ```bash
   t=$(grep '^ADMIN_TOKEN=' packages/guard-core/.env | cut -d= -f2-) && curl -sS -X POST http://127.0.0.1:18787/v1/admin/kill -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{}'
   ```

2. **Remove the onchain limit.** This is what actually stops the hot wallet drawing from the vault;
   step 1 only stops the guard. The bot's message gives the `removeSpendingLimit` instruction, which
   must be signed by the config authority, the owner key.

   With the owner key in Phantom (D4): press **Open kill in Phantom** under the message that
   confirmed the pause, check that the page names your multisig and hot wallet, and approve in
   Phantom. The page waits until the limit is gone. "Already killed" means there was nothing left
   to remove. Then `/status` shows the chain without a limit. Until CR-008 lands, it reads
   "onchain allowance could not be read".

   The button expires 15 minutes after the kill result is posted, and the page refuses an older
   link (BOT-13). If the bot itself is down, build the link by hand. Every value in it is public,
   and it is good for 15 minutes:

   ```bash
   issued=$(date +%s) && m=$(grep '^SQUADS_MULTISIG=' packages/guard-core/.env | cut -d= -f2-) && h=$(grep '^SOLANA_HOT_WALLET_PUBKEY=' packages/telegram-bot/.env | cut -d= -f2-) && echo "https://agentguard-onchain.vercel.app/?action=kill&cluster=mainnet-beta&multisig=$m&hot=$h&issued=$issued"
   ```

   Open it in a browser with Phantom, or on a phone inside Phantom through
   `https://phantom.app/ul/browse/<the link, URL-encoded>`. Use `cluster=devnet` on devnet.

   With the owner key on a Ledger, if D4 changes:
   1. Plug the Ledger in, unlock it, and open the Solana app.
   2. Turn **Blind signing** on (Solana app, Settings). The app cannot display Squads instructions.
   3. Run:

      ```bash
      SOLANA_OWNER_KEYPAIR='usb://ledger?key=0' pnpm --filter @agentguard/onchain kill --yes
      ```

   4. Compare the **Message Hash** on the device with the one the script printed, character by
      character. Approve only on an exact match. On any difference, reject, and treat the computer as
      compromised: run the kill from another machine. Do it within a minute, before the blockhash
      expires.
   5. Turn **Blind signing** off again.

   With the owner key as a file (devnet today): `pnpm --filter @agentguard/onchain kill` shows the
   limit and changes nothing; `kill --yes` removes it.

3. **Confirm it is gone.** `pnpm --filter @agentguard/onchain status` must print
   `spending limit:   none at <address>`. On explorer.solana.com, on the right cluster, that
   address must show no account. The vault balance is unchanged: the funds never left.
4. **Deal with what the hot wallet still holds.** The limit is gone, but the hot wallet keeps its
   current balance. If its key may be compromised, treat that balance as lost; it is the bounded part
   of the daily loss. If not, leave it, or move it back to the vault with the hot wallet key.

### Rotate the hot wallet key

Do this after any suspected exposure, and after any kill caused by one.

1. Run steps 1–3 of the kill above for the old hot wallet.
2. Generate a new keypair outside the repo (`solana-keygen new -o <path>`), and store it in the
   secrets manager (D5).
3. In `packages/onchain/.env`, set `SOLANA_HOT_WALLET_PUBKEY` to the new **public** key. Then run
   `pnpm --filter @agentguard/onchain add-spending-limit`. The limit's address is derived from the hot
   wallet, so the new limit is a new account, and the old one stays removed.
4. Run `pnpm --filter @agentguard/onchain status`. It must show the cap, the new hot wallet as the
   only member, and the new hot wallet as the only destination.
5. Point guard-core's `SOLANA_HOT_WALLET_KEYPAIR` at the new key and restart it. Fund the new hot
   wallet with a little SOL for fees. Then `POST /v1/admin/resume` each agent the owner trusts.
   Agents stay paused until resumed one by one.

### Rotate the service tokens

`ADMIN_TOKEN`, `BOT_TOKEN` and `BOT_WEBHOOK_SECRET` are generated with `openssl rand -hex 32` and must
match between guard-core and the bot. Change them in both, restart both, and let the `pnpm dev:all`
preflight (or its equivalent at deploy) confirm they agree. A leaked agent token is revoked with
`pnpm --filter @agentguard/guard-core revoke-agent <agentId>`, which takes effect on the token's next
request. A token can't be rotated in place: `create-agent` issues a new agent with its own token and a
deny-all policy, which the owner then sets.
