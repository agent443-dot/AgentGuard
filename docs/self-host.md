# Run your own AgentGuard

AgentGuard is self-hosted. You run your own guard-core and Telegram bot, your funds sit in a vault
only you control, and nothing in the path belongs to us. This guide goes from an empty account to
an agent paying an x402 API under a daily cap, with a kill switch that works.

Each step links to the package README that holds the exact commands. Those READMEs are kept in step
with the code by its tests; this page gives the order.

## What you need

- Node 20+ and pnpm 10. On Windows, WSL2 with Ubuntu, and the repository cloned under `~`.
- A [Fly.io](https://fly.io) account with a card on it. Trial machines stop after 5 minutes.
- A [Vercel](https://vercel.com) account for your signing page. Any static host with custom
  headers works, but `vercel.json` is ready.
- Telegram, and a bot token from [@BotFather](https://t.me/BotFather).
- **A new Phantom wallet with its own recovery phrase, used for nothing but owning your vaults.**
  That wallet can move everything in them, so keep them small (below).
- On each chain you run: the chain's dollar for the vault, and a little of the native token for
  fees. USDC on Solana, USDG on Robinhood Chain.

## How the money is protected

```
Your vault (Squads multisig on Solana, Safe on EVM). Only your Phantom wallet controls it.
  └─ daily cap, enforced onchain by Squads or the Safe Allowance Module
       └─ guard-core's hot wallet, holding little or nothing
            └─ pays x402 APIs, after your agent's policy, a simulation and, above your
               threshold, your approval in Telegram
```

The most a day can cost is the cap plus what the hot wallet holds, even if guard-core is
compromised. Hold in the vault only what your agents need for the coming days. `/kill` in Telegram
stops guard-core, and one Phantom signature then removes the onchain cap.

## 1. Clone and check

```bash
git clone https://github.com/kikume/AgentGuard.git ~/AgentGuard
cd ~/AgentGuard && pnpm install && pnpm check
```

## 2. Keys

- **Owner:** your Phantom wallet. It never goes into a file, and you sign in Phantom only, through
  your signing page.
- **Hot wallet, one per chain:** generated on your machine into `~/.agentguard/`, mode 0600, never
  in the repository. The commands print only the address:
  - Solana: `solana-keygen new -o ~/.agentguard/sol-hot.json`;
  - EVM: the one-liner in [`packages/onchain/README.md`](../packages/onchain/README.md), Robinhood
    Chain section.
- **Service tokens:** `openssl rand -hex 32` for each of guard-core's `ADMIN_TOKEN`, `BOT_TOKEN` and
  `BOT_WEBHOOK_SECRET`. The bot gets the same three values.

Never reuse a devnet or testnet key on mainnet.

## 3. Your signing page

Phantom cannot run our scripts, so you sign the vault's setup and its kill on a static page that
you deploy yourself. Your hot wallet addresses are built into it, and a link cannot change them. The
page is a trust root: whoever can redeploy it can show you a harmless summary of a harmful
transaction.

1. In Vercel, create a project from this repository with root directory `packages/onchain/web`.
   `vercel.json` builds only `main`, skips every other branch and preview, and sets the security
   headers.
2. Environment variables, for Production only:
   - `SOLANA_HOT_WALLET_MAINNET` and/or `ROBINHOOD_HOT_WALLET_MAINNET`: your hot wallets' public
     addresses;
   - `SOLANA_MAINNET_RPC`: an RPC URL locked to your page's domain. Helius and QuickNode can do
     this. The key is public in the page, and the lock keeps others from spending its quota;
   - optionally `MAX_DAILY_CAP`, the most any cap may be, in base units (default 50).
3. Deploy, then check that the built page names your hot wallets:
   `curl -s https://<your page>/app.js | grep -o 'hot:"[^"]*"'`.

Details: "The owner in Phantom: the signing page" in
[`packages/onchain/README.md`](../packages/onchain/README.md), and
[ADR 003](./adr/003-phantom-owner.md).

## 4. Your vaults

Open each link in a browser with the Phantom extension, on your owner account. Before you approve,
check what the page and Phantom show.

**Solana**

1. `https://<your page>/?action=create&cluster=mainnet-beta` creates the Squads multisig, with your
   wallet as its config authority. Squads charges a creation fee, and the page shows it.
2. Send USDC to the vault address the page prints. The vault is not the multisig address.
3. `/?action=add-limit&cluster=mainnet-beta&multisig=<multisig>&amount=<cap in base units>` sets the
   daily cap, with your hot wallet as its only member and only destination.

**Robinhood Chain**

1. `/?action=create&cluster=robinhood` creates the Safe, with your wallet as its sole owner.
2. Send USDG to the Safe. Check that the token is
   `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`: other tokens on that chain share the name.
3. `/?action=enable&cluster=robinhood&safe=<Safe>&amount=<cap in base units>` turns on the
   Allowance Module and sets the cap for your hot wallet.

Read each one back before you go on:

- Robinhood Chain: `pnpm status:robinhood` in `packages/onchain`;
- Solana: `pnpm status`.

Each prints the owner, the cap and the balance.

Send each hot wallet a little of the chain's native token: on EVM, it pays the gas to draw from the
Safe.

## 5. guard-core and the bot on Fly

Fly app names are global, so pick your own. Then make three edits:

- `app` in `packages/guard-core/fly.toml`;
- `app` in `packages/telegram-bot/fly.toml`;
- the two private URLs that name each other: `BOT_URL` in guard-core's `fly.toml` and `GUARD_URL`
  in the bot's.

Then follow, in order:

1. "Deploy on Fly.io" in [`packages/guard-core/README.md`](../packages/guard-core/README.md):
   - create the app and its volume;
   - set the settings with `fly secrets import`;
   - pipe each hot key straight from its file;
   - deploy one machine.

   For mainnet, set `SOLANA_CHAIN` explicitly, since the default is devnet.

2. "Deploy on Fly.io" in [`packages/telegram-bot/README.md`](../packages/telegram-bot/README.md),
   with `SIGN_PAGE_URL` pointing at your page.
3. Check: `/status` in Telegram lists each chain with its cap.

Only guard-core's agent routes are public. The admin routes are on Fly's private network, and you
reach them with `fly proxy 18787:8787 --app <your guard-core app>`.

To deploy on every merge to your `main`, keep `.github/workflows/deploy.yml`:

1. Change the two app names in its matrix.
2. Add `FLY_API_TOKEN_GUARD` and `FLY_API_TOKEN_BOT` as **secrets**, never variables: either
   repository secrets, or secrets of an environment named `agent guard` limited to `main`.
   Make each one with `fly tokens create deploy -a <app>`.

## 6. Agents

1. Create an agent on the machine:
   `fly ssh console --app <guard-core app> -C "sh -c 'cd /srv/agentguard/packages/guard-core && node --import tsx src/scripts/create-agent.ts <agent-id>'"`.
   It prints the agent's token once.
2. Its policy starts by denying everything. Set one through the proxy with
   `PUT /v1/admin/policy/<agent-id>`. The fields are in [`SPEC.md`](../SPEC.md). A sensible start
   is 5 per payment, 20 a day, your approval above 1, and only the API domains you trust.
3. Connect the agent: "For agent builders" in
   [`packages/mcp-server/README.md`](../packages/mcp-server/README.md) covers Claude, other MCP
   clients, the tools and their errors.

`src/scripts/revoke-agent.ts <agent-id>`, run on the machine the same way, cuts an agent off at
its next request.

## 7. Before you rely on it

Run each of these once, on your own setup:

- **A small payment:** a few cents to an x402 API you control. `e2e/src/evm-paywall.ts` and
  `devnet-paywall.ts` are paid APIs you can run yourself.
- **The kill:**
  1. `/kill` → Confirm in Telegram;
  2. the Phantom button for each chain;
  3. then `/status` shows no onchain limit.

  If a button is missing, build the link by hand: [`LAUNCH.md`](../LAUNCH.md), "Kill, in order".

- **A restore:**
  1. `db:backup` on the machine;
  2. copy the file off with `fly ssh sftp get`;
  3. `pnpm --filter @agentguard/e2e restore-drill <file>` shows that your policies and today's spend
     come back.

  Fly also snapshots the volume daily. `fly volumes update <id> --snapshot-retention 14` keeps two
  weeks.

The full incident runbook, including key rotation, is §4 of [`LAUNCH.md`](../LAUNCH.md).
