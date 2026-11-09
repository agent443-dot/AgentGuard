# @agentguard/telegram-bot

The owner's control surface: approve or reject payments above the threshold, watch for attacks, and
stop everything. Built on [grammY](https://grammy.dev) (long polling) and Fastify (the hooks
guard-core calls).

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
| `POST /hooks/alert`            | `{ kind, agentId, detail, sentAt }`     | same                                                                                          |

**Before the body is read.** A request to `/hooks/*` whose `X-Guard-Signature` is missing or is not
64 hex characters is answered 401 in Fastify's `onRequest` hook, so its body is never read. A
well-formed signature needs the bytes to be checked, but they reach no parser until it holds.

**Rate limit.** `HOOK_RATE_LIMIT_PER_MINUTE` (default 300) requests per minute per client address, then 429. Only guard-core calls the hooks, and each payment costs it at most two calls (an approval
request and an intent event). The hooks still bind to `127.0.0.1` by default.

**Replay.** A valid signature proves guard-core wrote a body, not that it is sending it now. An
approval request is refused once `approveBefore` has passed, or if it claims a window longer than
guard-core's 10 minutes (plus 1 minute of clock skew); while it is open, a second copy of the same
intent id is a duplicate. Intent events and alerts are refused when `sentAt` is more than 5 minutes
old. Intent events are deduplicated on intent id plus status, alerts on kind, agent and `sentAt`. Both memories are in-process: a replay right after a restart
can post a message again, but its buttons cannot decide anything twice because guard-core answers 409.

## Task budget approval

An approval request with `mandate` and no `intent` is an agent asking for a task budget (CR-010).
Every owner gets "Task budget requested": the agent, the budget in dollars, its length in minutes
(`ttlSeconds`, counted from approval; left out when guard-core does not send it, never taken from the
pending mandate's `expiresAt`, which is only the approval deadline), the domains and any recipients it
may pay (in full, at most ten of each with "and N more"), the expiry, and the agent's reason labelled
`agent says:`.
**Approve** and **Reject** call `POST /v1/bot/mandates/:id/decision`; the messages settle and expire
exactly like a payment's, with the same replay window from `approveBefore`.

## Circuit breaker alert

`kind: "breaker_tripped"` means guard-core has already paused the agent (CR-010). Every owner gets
"Circuit breaker tripped for `<agent>`: paused. /resume `<agent>` when you have looked.", followed by
guard-core's detail, escaped. Nothing is throttled: a tripped breaker stays tripped until someone
resumes the agent.

## Shadow mode

An intent event with status `shadowed` is a payment shadow mode evaluated and would have sent. It is
accepted and deduplicated like any other event, but it is never a chat message: nothing moved.
`/budget` shows the day's total as "Would have spent today (shadow mode)" when guard-core reports
`shadowSpentToday` above zero.

## Approval message

Sent to every owner: agent, amount in USD, chain, recipient (shortened; **Show full recipient**
shows all of it), domain (or "direct transfer"), the simulation summary, the expiry in UTC, and the
agent's reason labelled `agent says:`. Everything that came from the agent is HTML-escaped, so it
cannot pose as the bot's own text.

**Flags.** When guard-core sends a payment to the owner because of a flag (CR-010), the flag comes
first, above **Approval needed**. `RECIPIENT_CHANGED` reads "This API asks to pay a different
recipient, chain or token than last time."; with `pinned` (the last executed payment to that domain)
and a new recipient, both recipients follow in full, since a shortened address is what address
poisoning imitates. `PRICE_JUMP` reads "Price jump: 2.5× the last payment." from `pinned` (bigint, one
decimal, "more than" when not exact), and the plain "much more than its last payment" without
`pinned` or next to a recipient change, where the two prices compare nothing alike. A request
without `flags` reads as having none; a flag the bot does not know is shown as "guard-core flagged
this payment".

**Passkey.** A request with `passkey: true` can only be approved on guard-core's passkey page
(CR-010), so it has no **Approve** button. With `GUARD_PUBLIC_URL` set, an **Approve with passkey**
button opens `<GUARD_PUBLIC_URL>/owner/approve/<intentId>`; without it, there is no way to approve
from the chat, the message says so, and the bot warns at startup. **Reject** stays a normal button: a
stolen Telegram account can still stop a payment, never send one. An old or forged **Approve** for such
a payment is answered in the bot without asking guard-core. When the payment is then approved on the
passkey page (or guard-core settles it any other way), the intent event closes the request and every
owner's message shows the real outcome instead of later reading "Expired".

**Chains.** The chain is named (Solana, Solana devnet, Base, Base Sepolia). The recipient, and the
transaction of an executed payment, link to that chain's explorer: Solscan with `?cluster=devnet` on
devnet, basescan.org on Base, sepolia.basescan.org on Base Sepolia, robinhoodchain.blockscout.com on
Robinhood Chain and explorer.testnet.chain.robinhood.com on its testnet. The explorer is looked up by the
exact CAIP-2 id, so a chain the bot does not know gets no link at all, never one on another network.

**Amounts** read as dollars only when the intent's token is the chain's dollar listed in
`packages/shared/src/addresses.ts`, labelled with its symbol: USDC, or USDG on Robinhood Chain
(CR-007). Any other token is shown in base units with its address, marked "not the USDC of this chain"
(or USDG), because a token with 6 decimals, or one named USDC or USDG at another address, could
otherwise pass for dollars. A chain with no dollar listed (Base mainnet today) says "this chain has no
verified dollar".

**Approve** / **Reject** call `POST /v1/bot/decision` with the presser's Telegram id. Then every
owner's copy is edited to the outcome, with the full recipient, and the buttons are gone. guard-core's
409 (`already_decided` or `expired`) and 404 are shown as such. If guard-core does not answer, the
buttons stay and the owner is told to try again. Unanswered requests are edited to **Expired** by a
sweep every 15 seconds.

Only ids in `OWNER_TELEGRAM_IDS` reach any handler. Everyone else gets no reply at all.

## Commands

| Command                                       | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`                                     | Whether guard-core is reachable, the approvals waiting (as many as fit in one message, then "…and N more"), the pending task budgets, and each chain guard-core runs with its onchain spend against the cap (needs `GET /v1/admin/chains`, CR-006; until then "not reported")                                                                                                                                                                                                                                                                                        |
| `/budget <agentId>`                           | Spent today, daily and per-payment max, hot wallet per chain, paused. Needs `GET /v1/admin/budget/:agentId` (CR-004)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/pause <agentId>`                            | `POST /v1/admin/pause`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/resume <agentId>`                           | `POST /v1/admin/resume`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/kill`                                       | Asks to confirm, naming the chains when guard-core reports them (CR-006), then `POST /v1/admin/kill`: says how many agents were paused and sends one message per chain with the owner transaction to sign. If there are none, says the allowances are still live                                                                                                                                                                                                                                                                                                     |
| `/report`                                     | The last 7 days from `GET /v1/admin/report` (CR-010): per agent, spend and payment count, refusals by code, and the top 5 domains by spend. Paged to fit Telegram's 4096 characters; an agent is never split across two messages                                                                                                                                                                                                                                                                                                                                     |
| `/agent new <id>`                             | Creates the agent (`POST /v1/admin/agents`, CR-011) in shadow mode with a deny-all policy. The token comes in its own message, which the bot deletes after about a minute, with the setup line `npx @agentguard/mcp-server setup claude-code`                                                                                                                                                                                                                                                                                                                        |
| `/agent list`                                 | Every agent with its mode and whether it is paused                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/agent revoke <id>`                          | Asks to confirm, then revokes: the agent's token stops working at its next request                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/policy <id>`                                | The policy in dollars, with **Careful** ($1 per payment, $5 a day, approval at $0.50) and **Standard** ($5, $20, $1) presets and an edit button per limit, answered by reply in dollars. Any raise of a limit asks to confirm first                                                                                                                                                                                                                                                                                                                                  |
| `/allow <id> <domain>`, `/deny <id> <domain>` | Adds or removes an x402 domain. The domain must be a plain hostname such as `api.example.com`; it is lowercased                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `/mode <id> live\|shadow`                     | Shadow at once. Live asks to confirm and shows what shadow mode would have spent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/doctor`                                     | `GET /v1/admin/doctor`: one line per check with ✅ ⚠️ ❌, and the fix under each warning or failure                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `/passkey enrol`                              | A one-time link to guard-core's enrol page, `<GUARD_PUBLIC_URL>/owner/enrol#code=…` (in the fragment, so no request line or log holds it) from `POST /v1/admin/passkeys/code`. A code adds only the first passkey: guard-core asks for an enrolled passkey before it adds another, so a stolen Telegram account cannot add its own key, and the message says so. The message deletes itself after 10 minutes, or when the code expires if sooner; neither the code nor the link is logged. Without `GUARD_PUBLIC_URL` it says enrolment cannot be done from Telegram |

## Onchain kill in Phantom

The owner's keys are in Phantom (ADR 003), so the bot cannot remove the onchain limits itself: only
the owner can sign `removeSpendingLimit` on the Squads multisig (Solana) or remove the hot wallet's
allowance on the Safe (Robinhood Chain). When `SIGN_PAGE_URL` is set, the result of a `/kill` →
**Kill everything** carries one Phantom button per configured chain, for example **Open Solana devnet
kill in Phantom** and **Open Robinhood Chain testnet kill in Phantom**, labelled differently when
guard-core did not confirm (below). Each opens the signing page from `packages/onchain/web` inside
Phantom:

```
https://phantom.app/ul/browse/<encodeURIComponent(link)>?ref=<encodeURIComponent(origin)>
Solana:    link = <SIGN_PAGE_URL>/?action=kill&cluster=<devnet|mainnet-beta>&multisig=<SQUADS_MULTISIG>&hot=<SOLANA_HOT_WALLET_PUBKEY>&issued=<unix seconds>
Robinhood: link = <SIGN_PAGE_URL>/?action=kill&cluster=<robinhood-testnet|robinhood>&safe=<ROBINHOOD_SAFE_ADDRESS>&issued=<unix seconds>
```

The Robinhood link names no hot wallet: the page uses the one it was built with.

Each chain's row also has **Open in browser (desktop)**, which opens `link` itself. On a desktop
browser with the Phantom extension, the universal link only shows phantom.com's "open this in the
Phantom app" page with a QR code; the plain page connects to the extension directly. Both buttons of a
row carry the same `issued` and expire and retire together.

- **The onchain half is never offered as if it were the kill.** No button appears before **Kill
  everything**. On a kill guard-core confirmed, they read **Open … kill in Phantom**. If guard-core
  did not confirm, the message says "guard-core did **NOT** confirm a pause", and each button reads
  **Remove … limit anyway (Phantom)**. With guard-core down, the onchain limits are the only brake
  left, so the buttons stay. The message lists, per chain, what each one removes (the Squads spending
  limit, or the hot wallet's allowance on the Safe), and says that this stops refills only:
  guard-core can still spend what the hot wallets hold.
- **Only the newest buttons are live.** When a newer kill result is posted, in any owner's chat,
  every older one is edited: its buttons are removed and it says "This Phantom button has expired.
  Use /kill for a fresh one." Buttons nobody pressed expire the same way after 15 minutes, on the
  bot's 15-second sweep. Each link also carries `issued` (unix seconds, set when the result is
  posted), and the signing page refuses a link older than 15 minutes. So a button the bot forgot
  about on a restart still stops working on time, even though its message is not edited.
- **No button for a limit that is already gone.** Before posting the result, the bot reads
  `GET /v1/admin/chains`. A chain reported as `status: 'none'` gets the line "<chain>: no onchain
  limit (already removed)" and no button, on a confirmed kill and on a failed one. A chain whose
  allowance could not be read (`null`) keeps its button, as does every chain when guard-core does not
  report them.
- **Kill everything** itself is unchanged: guard-core pauses every agent and signs nothing more.
- Every value in the link is public, and all of them come from the bot's config. The cluster is
  derived from `SOLANA_CHAIN` or `ROBINHOOD_CHAIN`, never from anything a user sends.
- `SIGN_PAGE_URL` must be https with no query or fragment. With it set, the bot refuses to start
  unless at least one chain is complete: `SQUADS_MULTISIG` with `SOLANA_HOT_WALLET_PUBKEY`, or
  `ROBINHOOD_SAFE_ADDRESS`, or both. Half a Solana pair is refused. Without `SIGN_PAGE_URL`, there are
  no buttons.

## Owner commands

The owner runs the deployment from Telegram (CR-011): every command above talks to guard-core's admin
API with `GUARD_ADMIN_TOKEN`, and only owners get an answer, as for every other command.

- **Tokens.** An agent's token is shown once, in a message of its own that the bot deletes after about
  a minute. It is never logged; if that message cannot be sent, the log says so without the error,
  which would carry the text, and the owner is told to revoke the agent and create it again.
- **Buttons.** A confirm button carries only a random id; what it does stays in the bot and works
  once, within 10 minutes. After a restart old buttons answer "expired".
- **Amounts.** Owners type dollars (`2.50`, `$2.50`); the bot converts them to atomic units in bigint and
  refuses anything else, a negative or more than 6 decimals included.
- **Graduation.** guard-core's budget reports `shadow: { since, total, count }` from an agent's first
  shadowed payment. Three days after `since`, every owner gets one offer: "Your agent would have
  spent $X in N payments. Go live?", which opens the `/mode` confirm. The bot asks guard-core at most
  every 5 minutes, for agents in shadow mode only, and keeps only "already offered" in memory: a bot
  restart repeats an offer at most once.

## Weekly report

With `REPORT_WEEKDAY` (0 is Sunday) and `REPORT_HOUR_UTC` both set, every owner gets the same report as
`/report` in the first minute of that hour, checked on the bot's 15-second sweep. Setting only one of them is refused
at startup. If guard-core does not answer, the owners are told once to run `/report` later; the bot does
not retry every tick. The sent marker is in memory, but a bot restarted after that first minute does
not send it again.

## Notifications

From `POST /hooks/intent-event`:

- an executed payment at or above `NOTIFY_ABOVE_AMOUNT` (dollar atomic units, USDC or USDG)
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
cd ~/AgentGuard && grep -E '^(TELEGRAM_BOT_TOKEN|OWNER_TELEGRAM_IDS|GUARD_BOT_TOKEN|GUARD_ADMIN_TOKEN|BOT_WEBHOOK_SECRET|NOTIFY_ABOVE_AMOUNT|SOLANA_CHAIN|SIGN_PAGE_URL|SQUADS_MULTISIG|SOLANA_HOT_WALLET_PUBKEY|ROBINHOOD_CHAIN|ROBINHOOD_SAFE_ADDRESS|REPORT_WEEKDAY|REPORT_HOUR_UTC|GUARD_PUBLIC_URL)=.' packages/telegram-bot/.env | fly secrets import --app agentguard-bot --stage

# 4. Deploy one machine. The test refuses to run unless the root .dockerignore applies and excludes
#    .env files. A Dockerfile.dockerignore next to the Dockerfile would replace it, not add to it.
cd ~/AgentGuard && if grep -qx '\*\*/.env' .dockerignore && [ ! -e packages/telegram-bot/Dockerfile.dockerignore ]; then fly deploy . --config packages/telegram-bot/fly.toml --dockerfile packages/telegram-bot/Dockerfile --ha=false; else echo 'STOP: the build context must use the root .dockerignore, and it must exclude **/.env'; fi

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
