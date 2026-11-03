# LAUNCH.md: what has to happen before real money

Draft (INT-8) as of 2026-11-03, written against `main` at `571db23`. **AgentGuard is not ready for
mainnet.** This document lists exactly what is missing. It describes the code as it is, not as
planned. Anything proven only on a stub chain is marked as such.

## 1. Owner decisions (open)

None of these can be made by a session. Each blocks launch until the owner writes the answer down.

| #   | Decision                                                                                 | Why it matters                                                                                                                                                                     | Status |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| D1  | **Mainnet daily cap** (`DAILY_CAP`, USDC atomic units)                                   | The most the owner can lose per day, together with whatever the hot wallet holds (SPEC: max daily loss = cap + hot wallet balance). Devnet uses 100 USDC. A beta wants it low.     | open   |
| D2  | **Per-agent policy for launch**: `perTxMax`, `dailyMax`, `approvalThreshold`, allowlists | guard-core enforces these offchain, beneath the onchain cap. A new agent starts deny-all.                                                                                          | open   |
| D3  | **Deploy host**: Fly.io or Railway (HUMAN-7)                                             | Decides how secrets reach the process, and what fronts each service (§3).                                                                                                          | open   |
| D4  | **Owner key custody**: a hardware wallet                                                 | The owner key is the multisig's only member and config authority (threshold 1). Whoever holds it can move the whole vault.                                                         | open   |
| D5  | **Hot wallet key storage**: which secrets manager                                        | guard-core reads the hot wallet from a keypair file (`SOLANA_HOT_WALLET_KEYPAIR`). Whatever is chosen must deliver it as a file, or guard-core has to change (SPEC: "later: KMS"). | open   |
| D6  | **Solana only, or wait for Base**                                                        | SPEC v0.3 ships both chains in v0.1, but Base has not started: EVM-\* is gated behind INT-5. A Solana-only beta is possible, but it is the owner's call.                           | open   |

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

### Open

- [ ] **HUMAN-11**: the full stack on devnet. That covers a transfer approved on Telegram (real Solana
      signing, inspection and simulation) and an x402 payment through `pnpm --filter @agentguard/e2e paywall`, settled on devnet. Closes INT-3 and the devnet half of INT-4.
- [ ] **SVM-8**: the fourth cap property, the refill after the period, plus all four as automated
      LiteSVM tests. Needs the Squads binary (HUMAN-10).
- [ ] **INT-5 done**: needs the two items above. It is also the gate for the Base work.
- [ ] **Kill with a hardware wallet** (§4): today `pnpm kill` needs the owner key as a file.
- [ ] **Mainnet keys** generated fresh (key rule above). The owner key goes on the hardware wallet
      (D4), and the hot wallet key into the secrets manager (D5).
- [ ] **Mainnet setup**, with the new keys:
  - `create-multisig` and `add-spending-limit` run with `SOLANA_CLUSTER=mainnet-beta`;
  - `USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle; also in
    `packages/shared/src/addresses.ts`);
  - `DAILY_CAP` set from D1;
  - `pnpm status` read back: the cap, the hot wallet as the only member, and the hot wallet as the
    only destination.
- [ ] **guard-core on mainnet**: `SOLANA_CHAIN=solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`, set
      explicitly, because the default is devnet. Also `GUARD_STUB_CHAINS=false`, a mainnet
      `SOLANA_RPC_URL`, and the new `SQUADS_MULTISIG`. The mcp-server `DEFAULT_CHAIN` must match.
- [ ] **guard-core binds a deployable interface.** It listens on a hard-coded `127.0.0.1`
      (`packages/guard-core/src/main.ts`). It needs a `HOST` setting like the bot's, chosen with D3.
- [ ] **Persistent database.** `DATABASE_URL` defaults to `file:./data/guard.db`. The host needs a
      persistent volume, or intents, the audit log and daily spend are lost on redeploy.
- [ ] **Security review repeated**: on the devnet stack, and on the deployed configuration (TLS, what
      fronts each service, secrets in the manager).
- [ ] **Rate limits in front of the bot hooks and the MCP HTTP endpoint**, or both kept private. Today
      they have none and rely on loopback (`docs/security-review.md`).
- [ ] **Bug bounty, landing page, MCP setup docs for agent builders** (INT-8 scope). Not started.
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
   must be signed by the config authority (the owner key). With the owner key as a file, as on
   devnet today:

   ```bash
   pnpm --filter @agentguard/onchain kill          # shows the limit, changes nothing
   pnpm --filter @agentguard/onchain kill --yes    # removes it
   ```

   **Open, before mainnet (§2):** with the owner key on a hardware wallet, this needs a signing path
   that is written down and tested. Either `kill.ts` learns to sign through the hardware wallet, or
   the owner removes the limit in the Squads app with the hardware wallet. Decide and test it on
   devnet before mainnet.

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
preflight (or its equivalent at deploy) confirm they agree. An agent token can't be rotated in place
yet: `create-agent` issues a new agent. Revoking a single token (`agents.revoked_at`) has no command
yet. **Open:** add one before launch.
