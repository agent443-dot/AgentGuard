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
   `OWNER_TELEGRAM_IDS`. Several owners: comma-separated. Each owner must send `/start` to the bot
   once, or Telegram will not let it message them.
3. `BOT_WEBHOOK_SECRET` must equal guard-core's. `GUARD_BOT_TOKEN` and `GUARD_ADMIN_TOKEN` are
   guard-core's `BOT_TOKEN` and `ADMIN_TOKEN`.

## Hooks guard-core calls

Both are signed: `X-Guard-Signature` is the hex HMAC-SHA256 of the exact request bytes with
`BOT_WEBHOOK_SECRET`. The body is verified as raw bytes, in constant time, before anything parses it.

| Route                          | Body                                    | Answers                                                                                       |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `POST /hooks/approval-request` | `{ intent, simulation, approveBefore }` | 200 posted, 401 bad signature, 400 bad body, 409 duplicate, 410 stale, 502 no owner reachable |
| `POST /hooks/intent-event`     | `{ intent, sentAt }` (CR-004)           | same                                                                                          |

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

**Approve** / **Reject** call `POST /v1/bot/decision` with the presser's Telegram id. Then every
owner's copy is edited to the outcome, with the full recipient, and the buttons are gone. guard-core's
409 (`already_decided` or `expired`) and 404 are shown as such. If guard-core does not answer, the
buttons stay and the owner is told to try again. Unanswered requests are edited to **Expired** by a
sweep every 15 seconds.

Only ids in `OWNER_TELEGRAM_IDS` reach any handler. Everyone else gets no reply at all.

## Commands

| Command             | Does                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`           | Whether guard-core is reachable, and the approvals waiting                                                                                                                                              |
| `/budget <agentId>` | Spent today, daily and per-payment max, hot wallet per chain, paused. Needs `GET /v1/admin/budget/:agentId` (CR-004)                                                                                    |
| `/pause <agentId>`  | `POST /v1/admin/pause`                                                                                                                                                                                  |
| `/resume <agentId>` | `POST /v1/admin/resume`                                                                                                                                                                                 |
| `/kill`             | Asks to confirm, then `POST /v1/admin/kill`: says how many agents were paused and sends one message per chain with the owner transaction to sign. If there are none, says the allowances are still live |

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
