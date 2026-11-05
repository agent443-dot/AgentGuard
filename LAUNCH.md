# LAUNCH.md: what has to happen before real money

Draft (INT-8) as of 2026-11-03, written against `main` at `571db23`. **AgentGuard is not ready for
mainnet.** This document lists exactly what is missing. It describes the code as it is, not as
planned. Anything proven only on a stub chain is marked as such.

## 1. Owner decisions

Made by the owner on 2026-11-05, in the integrator session. None of these can be made by a session.

| #   | Decision                                                                                 | Answer                                                                                                                                                                                                                                                                                                              | Status                     |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| D1  | **Mainnet daily cap** (`DAILY_CAP`, USDC atomic units)                                   | **50 USDC a day** (`DAILY_CAP=50000000`), with the hot wallet holding at most 20 USDC. Max daily loss: about 70 USDC. Raised only after some weeks without incidents.                                                                                                                                               | **decided**                |
| D2  | **Per-agent policy for launch**: `perTxMax`, `dailyMax`, `approvalThreshold`, allowlists | Each new agent: **5 USDC per payment, 25 a day, Telegram approval above 1 USDC**, deny-all to start, and only domains the owner adds.                                                                                                                                                                               | **decided**                |
| D3  | **Deploy host** (HUMAN-7)                                                                | **Fly.io**, one region, a persistent volume for the database, guard-core on the private network only. Only the bot's webhook is public, behind TLS.                                                                                                                                                                 | **decided**                |
| D4  | **Owner key custody**                                                                    | **Phantom**, a software wallet: the owner's choice, against the recommendation of a hardware wallet. The owner key can move the whole vault, so it stays in Phantom and is **never exported to a file**. The owner signs its operations through Phantom, not through this repo's scripts. See the D4 blocker in §2. | **decided, risk accepted** |
| D5  | **Hot wallet key storage**                                                               | **Fly.io secrets**, written to an in-memory file at startup, delivered as `SOLANA_HOT_WALLET_KEYPAIR`. KMS later, when the cap rises.                                                                                                                                                                               | **decided**                |
| D6  | **Solana only, or wait for Base**                                                        | **Solana only first.** Base follows once Solana has run for some weeks without incidents and the Base owner path is settled. Base ran live on Sepolia on 2026-11-05 (HUMAN-13); its any-recipient allowance (below) is the reason to wait.                                                                          | **decided**                |

**Base differs from Solana in where the daily allowance can go.** On Solana, the spending limit's
only destination is the hot wallet: a stolen hot-wallet key can only draw the day's cap into the hot
wallet and spend from there. On Base, the Safe Allowance Module lets the delegate send its allowance
to **any** address, so a stolen hot-wallet key can pull the day's cap straight to an attacker. The
daily loss bound is the same on both chains (cap + hot wallet balance), but on Base the guard's
checks never see that draw. The Safe owner signs on a Ledger since EVM-9 (#41): `OWNER_SIGNER=ledger` for `create-safe`,
`enable-allowance` and `kill:base`, and the scripts refuse Base mainnet with a raw key. It is proven
against a fake device only; the real-hardware run is below.

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
      in a temp directory, and `pnpm db:backup` takes a consistent copy while it runs. **Left:** the
      volume itself, and a backup schedule, once HUMAN-7 picks a host.
- [ ] **Security review repeated**: on the devnet stack, and on the deployed configuration (TLS, what
      fronts each service, secrets in the manager).
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
- [ ] **Final report** (INT-9), and the owner's written go-ahead (HUMAN-8).

## 3. Deployment shape

Fill this in once D3 and D5 are answered.

- **guard-core**: the only process holding the hot wallet key. Reachable by the bot and by MCP
  clients. It never needs to be public to the internet unless remote agents call it, which decides
  TLS and what fronts it.
- **telegram-bot**: uses long polling, so it needs no public URL. Only guard-core calls its hooks, so
  they stay private. It keeps pending approval messages in memory. On restart they are forgotten, and
  guard-core's expiry sweep closes the intents with `APPROVAL_TIMEOUT`. Fail-safe, but the owner sees
  no buttons for anything pending at the time.
- **mcp-server**: usually started by the agent's client over stdio, next to the agent. HTTP mode needs
  `MCP_HTTP_TOKEN`.
- **Secrets**, each in the secrets manager, never in the repo or an image:
  - guard-core: `ADMIN_TOKEN`, `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, the hot wallet keypair;
  - bot: `TELEGRAM_BOT_TOKEN`, `GUARD_BOT_TOKEN`, `GUARD_ADMIN_TOKEN`, `BOT_WEBHOOK_SECRET`;
  - mcp-server: `AGENT_TOKEN`, `MCP_HTTP_TOKEN`.

## 4. Incident runbook

**Who presses kill:** the owner, anyone in `OWNER_TELEGRAM_IDS`. Only the owner key can remove the
onchain limit. **When:** an attack alert they do not recognise, payments they did not expect, a
leaked token or key, or any doubt at all. A kill is cheap to undo; a drain is not.

### Kill, in order

1. **Stop new payments.** In Telegram send `/kill`, then press **Kill everything**. guard-core
   pauses every agent first (`POST /v1/admin/kill`). From then on every payment is refused with
   `PAUSED`. The bot then shows the owner transaction for each chain. If Telegram is unavailable, use
   the same call directly (from the guard-core checkout; use the deployed URL once hosted):

   ```bash
   t=$(grep '^ADMIN_TOKEN=' packages/guard-core/.env | cut -d= -f2-) && curl -sS -X POST http://localhost:8787/v1/admin/kill -H "Authorization: Bearer $t" -H 'content-type: application/json' -d '{}'
   ```

2. **Remove the onchain limit.** This is what actually stops the hot wallet drawing from the vault;
   step 1 only stops the guard. The bot's message gives the `removeSpendingLimit` instruction, which
   must be signed by the config authority, the owner key.

   With the owner key in Phantom (D4): sign `removeSpendingLimit` from the Phantom owner account by
   the path the D4 blocker proved on devnet, then check `pnpm status` prints
   `spending limit:   none at <address>`. Write the exact steps here once that run passes.

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
