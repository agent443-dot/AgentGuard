# create-agentguard

The setup wizard of CR-011. It takes you from nothing to your own AgentGuard running on Fly.io, with
your signing page on Vercel and your vaults onchain, and replaces the manual steps of
[`docs/self-host.md`](../../docs/self-host.md). It asks one question at a time, in plain English,
with a default for almost every answer.

## Run it

From an AgentGuard checkout, after `pnpm install`:

```bash
pnpm --filter create-agentguard start             # the setup, or continue one
pnpm --filter create-agentguard start --dry-run   # print every command, run none, write nothing
pnpm --filter create-agentguard start doctor      # check a running setup
```

The package's bin is `create-agentguard`, so `npx create-agentguard` runs the same once it is
published. Run outside a checkout, it offers to clone this repository into `~/AgentGuard` and
continues there.

You need Node 20+, `git`, [flyctl](https://fly.io/docs/flyctl/install/), and accounts on Fly.io
(with a card on it) and Vercel. It checks `fly auth whoami` and `npx vercel whoami` and offers to
log you in. You also need a Telegram bot token from @BotFather, your Telegram user id, and Phantom
with a new owner account used for nothing else.

## What it does, in order

1. **Checks** Node, `git --version`, `fly version`, `fly auth whoami`, `npx --yes vercel whoami`,
   and the checkout (`git clone https://github.com/agent443-dot/AgentGuard.git ~/AgentGuard` if
   you agree).
2. **Asks** a name prefix for the Fly apps (`<prefix>-guard-core`, `<prefix>-bot`), the Fly org
   and region (`gru`), the chains (Solana, Robinhood Chain, or both; test networks as an advanced
   choice), each chain's daily cap (default 20, at most 50), the policy preset, your Telegram ids,
   the agent's name, then the bot token (hidden as you type) and the RPC URLs.

   | Preset   | Per payment | Per day | Your approval from |
   | -------- | ----------- | ------- | ------------------ |
   | careful  | 1           | 5       | 0.50               |
   | standard | 5           | 20      | 1                  |

   The day is lowered to the smallest onchain cap if that is below it.

3. **Makes the keys** in its own process: a Solana keypair with `@solana/web3.js`, written as the
   64-byte JSON array, and an EVM key with viem's `generatePrivateKey()`. It prints the addresses
   only. `ADMIN_TOKEN`, `BOT_TOKEN` and `BOT_WEBHOOK_SECRET` are 32 random bytes each, saved and
   never printed.
4. **Fly:** writes each app's `fly.toml` into `~/.agentguard/fly/`, from the package's own with only
   `app`, `primary_region` and `BOT_URL`/`GUARD_URL` changed, then runs
   `fly apps create` (both apps), `fly volumes create guard_data --size 1 --region … --app … --yes`,
   and `fly secrets import --app … --stage` for each app. Nothing is deployed yet.
5. **Your signing page:** `npx --yes vercel link`, `vercel env add <name> production --force` for
   each hot wallet and the page's RPC, `vercel pull`, `vercel build --prod` and
   `vercel deploy --prebuilt --prod`, all with `--cwd packages/onchain/web`. The page is built on
   your machine because its `vercel.json` installs from the repository root, which a CLI upload of
   that folder alone does not contain. It then fetches `/app.js` and checks that the page names
   each hot wallet.
6. **Your vaults**, signed by you in Phantom: it prints the create link, takes the multisig or Safe
   address you paste back, prints the add-limit or enable link with the cap in base units, and reads
   the chain (onchain's `findSpendingLimit`, or `readAllowance` and `hasAllowance`) every 5 s until
   the cap is there, for up to 10 minutes.
7. **Funding:** how much SOL or ETH each hot wallet needs for fees, and where the dollars go.
8. **Deploy and the first agent:** stages `SQUADS_MULTISIG`, `ROBINHOOD_SAFE_ADDRESS` and
   `SIGN_PAGE_URL`, checks `grep -qx '\*\*/.env' .dockerignore` as the deploy workflow does, and
   runs `fly deploy . --config ~/.agentguard/fly/<app>.toml --dockerfile packages/<pkg>/Dockerfile
--ha=false` for guard-core, then the bot. Each app is deployed once, here: guard-core refuses to
   start with a hot key but no vault, so a deploy before step 6 would crash-loop. Then, through
   `fly proxy 18787:8787`, it calls `POST /v1/admin/agents` (or, on a guard-core without that
   route, `create-agent.ts` over `fly ssh console`), `PUT /v1/admin/policy/<agent>` with the preset
   in shadow mode, and the doctor. It ends with the one line for your agent:
   `pnpm --filter @agentguard/mcp-server run setup claude-code`.

Each step records its progress in `~/.agentguard/<prefix>.state.json`, so after a failure or a
Ctrl-C you run it again and it continues where it stopped. The state holds public values only.

## Doctor

`create-agentguard doctor [--prefix <name>]` starts `fly proxy`, calls `GET /v1/admin/doctor` with
the admin token from `~/.agentguard/<prefix>.env`, and prints each check with ✅, ⚠️ or ❌ and its
fix. On a guard-core without that route it shows what `/health` and `/v1/admin/chains` tell. It
exits 1 when a check fails.

## What it never does with your keys

- **It never sees your owner key.** You sign the vault and the cap in Phantom, on your own page.
- **It never sends a key anywhere but your own Fly secrets.** Each hot key goes from its file to
  `fly secrets import` on the child's stdin, read at that moment.
- **It never puts a secret in a command line.** Every command is an argv array run without a shell;
  secrets reach a child only on its stdin. A dry run shows them as `<from ~/.agentguard/…>`.
- **It never prints a secret,** and its error messages never quote one.
- **It never overwrites a key file.** An existing one is kept and reused.
- **It writes secrets only under `~/.agentguard/`**, the directory 0700 and each file 0600:

  | File                           | Holds                                                 |
  | ------------------------------ | ----------------------------------------------------- |
  | `<prefix>.env`                 | the three service tokens, the bot token, the RPC URLs |
  | `<prefix>-<network>-hot.json`  | the Solana hot key                                    |
  | `<prefix>-<network>-hot.key`   | the Robinhood Chain hot key                           |
  | `<prefix>-agent-<agent>.token` | the first agent's token                               |
  | `<prefix>.state.json`          | progress, public values only                          |
  | `fly/<app>.toml`               | each app's Fly config                                 |

`vercel pull` writes `packages/onchain/web/.vercel/`, with the page's Production variables: your
hot wallets and the page's RPC URL, which the page shows anyway.

## Layout

- `src/domain/`: pure. The plan of commands from the answers, validation, amounts as bigint,
  `fly.toml` rewriting, the env lines, the signing page links, the doctor's printer.
- `src/adapters/`: the process runner (`spawn` with `shell: false`), the prompts
  (`node:readline/promises`, muted for hidden input), files with their modes, HTTP, key
  generation, and the chain readers.
- `src/steps/`: one file per step, run in order by `wizard.ts`.
- `src/index.ts`: the bin.

`pnpm test` runs the whole wizard against fakes: no real Fly, Vercel or chain is touched.
