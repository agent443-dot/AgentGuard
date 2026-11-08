# @agentguard/telegram-bot

The owner's control surface: approve or reject payments above the threshold, watch for attacks, and
stop everything. Built on [grammY](https://grammy.dev) (long polling) and Fastify (the hooks
guard-core calls).

- **Owner:** Session 4 (bot). Tasks BOT-1 .. BOT-7 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Contract:** [`/SPEC.md`](../../SPEC.md) — webhook and `/v1/bot/decision`. The parts not in the
  SPEC yet are proposed in CR-004 in [`/CHANGES_REQUESTED.md`](../../CHANGES_REQUESTED.md).

## Run

```bash
cp .env.example .env    # fill it in, see below
pnpm --filter @agentguard/telegram-bot dev
pnpm --filter @agentguard/telegram-bot test
```

1. Create the bot with [@BotFather](https://t.me/BotFather) and put the token in `TELEGRAM_BOT_TOKEN`.
2. Get your Telegram user id (e.g. from [@userinfobot](https://t.me/userinfobot)) and put it in
   `OWNER_TELEGRAM_IDS`. Several owners: comma-separated. Spaces around an id are ignored, but an empty
   entry, anything that is not a positive whole number, or an id too large to hold exactly stops the
   bot at startup. Each owner must send `/start` to the bot once, or Telegram will not let it
   message them.
3. `BOT_WEBHOOK_SECRET` must equal guard-core's. `GUARD_BOT_TOKEN` and `GUARD_ADMIN_TOKEN` are
   guard-core's `BOT_TOKEN` and `ADMIN_TOKEN`.

## Hooks guard-core calls

Both are signed: `X-Guard-Signature` is the hex HMAC-SHA256 of the exact request bytes with
`BOT_WEBHOOK_SECRET`. The body is verified as raw bytes, in constant time, before anything parses it.

| Route                          | Body                                    | Answers                                                                                       |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /hooks/approval-request` | `{ intent, simulation, approveBefore }` | 200 posted, 401 bad signature, 400 bad body, 409 duplicate, 410 stale, 502 no owner reachable |
| `POST /hooks/intent-event`     | `{ intent, sentAt }` (CR-004)           | same                                                                                          |

**Before the body is read.** A request to `/hooks/*` whose `X-Guard-Signature` is missing or is not
64 hex characters is answered 401 in Fastify's `onRequest` hook, so its body is never read. A
well-formed signature needs the bytes to be checked, but they reach no parser until it holds.

**Rate limit.** `HOOK_RATE_LIMIT_PER_MINUTE` (default 300) requests per minute per client address, then 429. Only guard-core calls the hooks, and each payment costs it at most two calls (an approval
request and an intent event). The hooks still bind to `127.0.0.1` by default.

**Replay.** A valid signature proves guard-core wrote a body, not that it is sending it now. An
approval request is refused once `approveBefore` has passed, or if it claims a window longer than
guard-core's 10 minutes (plus 1 minute of clock skew); while it is open, a second copy of the same
intent id is a duplicate. Intent events are refused when `sentAt` is more than 5 minutes old, and
deduplicated on intent id plus status. Both memories are in-process: a replay right after a restart
can post a message again, but its buttons cannot decide anything twice because guard-core answers 409.

## Approval message

Sent to every owner: agent, amount in USD, chain, recipient (shortened; **Show full recipient**
shows all of it), domain (or "direct transfer"), the simulation summary, the expiry in UTC, and the
agent's reason labelled `agent says:`. Everything that came from the agent is HTML-escaped, so it
cannot pose as the bot's own text.

**Chains.** The chain is named (Solana, Solana devnet, Base, Base Sepolia). The recipient, and the
transaction of an executed payment, link to that chain's explorer: Solscan with `?cluster=devnet` on
devnet, basescan.org on Base, sepolia.basescan.org on Base Sepolia. The explorer is looked up by the
exact CAIP-2 id, so a chain the bot does not know gets no link at all, never one on another network.

**Amounts** read as dollars only when the intent's token is the USDC listed for that chain in
`packages/shared/src/addresses.ts`. Any other token is shown in base units with its address, marked
"not a known USDC for this chain": a token with 6 decimals could otherwise pass for dollars. Base and
Base Sepolia USDC are not listed there yet (CR-005), so Base amounts show as base units until they are.

**Approve** / **Reject** call `POST /v1/bot/decision` with the presser's Telegram id. Then every
owner's copy is edited to the outcome, with the full recipient, and the buttons are gone. guard-core's
409 (`already_decided` or `expired`) and 404 are shown as such. If guard-core does not answer, the
buttons stay and the owner is told to try again. Unanswered requests are edited to **Expired** by a
sweep every 15 seconds.

Only ids in `OWNER_TELEGRAM_IDS` reach any handler. Everyone else gets no reply at all.

## Commands

| Command             | Does                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`           | Whether guard-core is reachable, the approvals waiting, and each chain guard-core runs with its onchain spend against the cap (needs `GET /v1/admin/chains`, CR-006; until then "not reported")                                                                  |
| `/budget <agentId>` | Spent today, daily and per-payment max, hot wallet per chain, paused. Needs `GET /v1/admin/budget/:agentId` (CR-004)                                                                                                                                             |
| `/pause <agentId>`  | `POST /v1/admin/pause`                                                                                                                                                                                                                                           |
| `/resume <agentId>` | `POST /v1/admin/resume`                                                                                                                                                                                                                                          |
| `/kill`             | Asks to confirm, naming the chains when guard-core reports them (CR-006), then `POST /v1/admin/kill`: says how many agents were paused and sends one message per chain with the owner transaction to sign. If there are none, says the allowances are still live |

## Onchain kill in Phantom

The owner's Solana key is in Phantom (ADR 003), so the bot cannot remove the onchain spending limit
itself: only the owner can sign `removeSpendingLimit`. When `SIGN_PAGE_URL` is set, the result of a
`/kill` → **Kill everything** carries an **Open kill in Phantom** button, labelled differently when
guard-core did not confirm (below). Pressing it opens the signing page from `packages/onchain/web`
inside Phantom:

```
https://phantom.app/ul/browse/<encodeURIComponent(link)>?ref=<encodeURIComponent(origin)>
link = <SIGN_PAGE_URL>/?action=kill&cluster=<devnet|mainnet-beta>&multisig=<SQUADS_MULTISIG>&hot=<SOLANA_HOT_WALLET_PUBKEY>
```

- **The onchain half is never offered as if it were the kill.** The button never appears before
  **Kill everything**. On a kill guard-core confirmed, it reads **Open kill in Phantom**. If guard-core
  did not confirm, the message says "guard-core did **NOT** confirm a pause", and the button reads
  **Remove onchain limit anyway (Phantom)**. With guard-core down, the onchain limit is the only brake
  left, so the button stays, but the message says it stops refills only: guard-core can still spend
  what the hot wallet holds.
- **Only the newest button is live.** When a newer kill result is posted, in any owner's chat, every
  older one is edited: its button is removed and it says "This Phantom button has expired. Use /kill
  for a fresh one." A button nobody pressed expires the same way after 15 minutes, on the bot's
  15-second sweep. Each link also carries `issued` (unix seconds, set when the result is posted),
  and the signing page refuses a link older than 15 minutes. So a button the bot forgot about on a
  restart still stops working on time, even though its message is not edited.
- **Kill everything** itself is unchanged: guard-core pauses every agent and signs nothing more.
- Every value in the link is public, and all of them come from the bot's config. The cluster is
  derived from `SOLANA_CHAIN`, never from anything a user sends.
- `SIGN_PAGE_URL` must be https with no query or fragment. With it set, the bot refuses to start
  unless `SQUADS_MULTISIG` and `SOLANA_HOT_WALLET_PUBKEY` are set too. Without it, there is no button.

## Notifications

From `POST /hooks/intent-event`:

- an executed payment at or above `NOTIFY_ABOVE_AMOUNT` (USDC atomic units)
- any intent carrying an attack code, at any amount — EVM: `APPROVAL_DETECTED`, `PERMIT_DETECTED`,
  `DELEGATION_DETECTED`; Solana: `DELEGATE_DETECTED`, `AUTHORITY_CHANGE_DETECTED`,
  `ACCOUNT_CLOSE_DETECTED`, `UNKNOWN_PROGRAM_DETECTED`, `HIDDEN_ACCOUNTS_DETECTED`. The alert says in
  plain words what the payment tried to do and suggests `/pause`.

An intent guard-core refused before any valid x402 offer existed may carry whatever the 402 server
sent: an empty chain or recipient, an amount that is not atomic units, a `payTo` that is not even a
string. For `rejected`, `failed` and `expired` intents those four fields are taken as bounded display
text (non-strings become empty, shown as "(not given)"), so the refusal still reaches the owner.
Every other status keeps the strict shape, and the signature and replay checks are the same for all.

Attack alerts are throttled, because an attacker can drive an agent to send malicious payments in a
loop and each rejection would otherwise be a message. The first alert for an agent and code goes out
at once; repeats in the next 5 minutes are counted, and one "Attack alerts held back" message with
the count is sent when that window closes. Large-payment alerts are never throttled.

## Deploy on Fly.io

The bot runs as one Fly machine, `agentguard-bot`, in the same org and region as guard-core
(`agentguard-guard-core`). The two talk only over Fly's private network:

- The bot's hooks listen on `fly-local-6pn:8788`, and guard-core calls them at
  `http://agentguard-bot.internal:8788` (its `BOT_URL`). The app has no `[http_service]`, so nothing
  is public. Telegram is reached by long polling, outbound only.
- The bot calls guard-core at `http://agentguard-guard-core.internal:8787` (`GUARD_URL` in
  `fly.toml`).
- **Exactly one machine.** Two bots polling the same token make Telegram refuse both, and pending
  approvals live in memory. Hence `--ha=false`. Stop any local `pnpm dev` of the bot, for the same
  reason.

The image (`Dockerfile`) is multi-stage on `node:22-slim`. It runs `pnpm deploy --prod` of this
package only, runs as the `node` user, and starts with `node --import tsx src/main.ts`, because
`packages/shared` ships TypeScript sources. It holds `src`, the production dependencies and nothing
else: no `.env`, no tests.

Owner commands, run on your own machine from `~/AgentGuard`. Steps 1 and 2 are once only.

```bash
# 1. Install flyctl and log in (opens the browser).
curl -L https://fly.io/install.sh | sh && fly auth login

# 2. Create the app, in the same org as guard-core.
fly apps create agentguard-bot --org <your-fly-org>

# 3. Secrets: read from the bot's .env and piped straight in, never typed or printed.
#    Fill packages/telegram-bot/.env first (see Run above). HOST, PORT and GUARD_URL come from fly.toml.
cd ~/AgentGuard && grep -E '^(TELEGRAM_BOT_TOKEN|OWNER_TELEGRAM_IDS|GUARD_BOT_TOKEN|GUARD_ADMIN_TOKEN|BOT_WEBHOOK_SECRET|NOTIFY_ABOVE_AMOUNT|SOLANA_CHAIN|SIGN_PAGE_URL|SQUADS_MULTISIG|SOLANA_HOT_WALLET_PUBKEY)=.' packages/telegram-bot/.env | fly secrets import --app agentguard-bot --stage

# 4. Deploy one machine. The first test refuses to run if a .env would reach Fly's builder.
cd ~/AgentGuard && if grep -qx '\*\*/.env' .dockerignore; then fly deploy . --config packages/telegram-bot/fly.toml --dockerfile packages/telegram-bot/Dockerfile --ha=false; else echo 'STOP: the root .dockerignore must exclude **/.env'; fi

# 5. Check: one machine started, and the log shows the hooks listening with no config error.
fly status --app agentguard-bot && fly logs --app agentguard-bot --no-tail
```

To change a secret later, edit the `.env` and repeat step 3 without `--stage`: Fly restarts the
machine with the new values.

## Layout

```
src/domain/     pure: signature check, USD formatting, replay book, alert rules, every message text
src/adapters/   guard.ts — guard-core HTTP client, responses validated with zod
src/bot/        grammY: owner gate, buttons, commands, the Desk that posts and edits messages
src/http/       Fastify hooks and their zod schemas
src/main.ts     wiring
```

Tests run against a mocked Telegram API (a grammY transformer that records every call) and a fake
guard-core. `test/contract.test.ts` drives the hook with guard-core's own `httpBotNotifier`, so a
change in how guard-core signs or what it sends fails here first.
