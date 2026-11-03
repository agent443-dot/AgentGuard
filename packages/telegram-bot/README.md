# @agentguard/telegram-bot

The owner's control surface: approve or reject payments above the threshold, and stop everything.

- **Owner:** Session 4 (bot). This session edits only this package.
- **Tasks:** BOT-1 .. BOT-7 in [`/coordination/BOARD.md`](../../coordination/BOARD.md).
- **Source of truth:** [`/SPEC.md`](../../SPEC.md) — webhook contract and `/v1/bot/decision`.

## Approval flow

`POST /hooks/approval-request` verifies `X-Guard-Signature` (HMAC-SHA256 of the body, constant-time
compare) and rejects old or duplicate requests. The owner gets one message with: agent, amount in USD,
recipient, domain, the agent's reason clearly labelled **"agent says:"**, the simulation summary and the
expiry time, plus inline `[Approve]` `[Reject]` buttons.

A button press calls `POST /v1/bot/decision` on guard-core. Only Telegram user ids in
`OWNER_TELEGRAM_IDS` can act; everyone else is ignored silently. After a decision the message is edited
to show the result and the buttons are removed. Expired intents are handled explicitly.

## Commands (owners only)

`/status`, `/budget <agentId>`, `/pause <agentId>`, `/resume <agentId>`, `/kill`.

`/kill` asks for confirmation, then calls `POST /v1/admin/kill` and shows the Safe transaction the owner
must sign to remove the onchain allowance.

## Notifications

- executed payments at or above `NOTIFY_ABOVE_AMOUNT`
- every rejection of type `APPROVAL_DETECTED`, `PERMIT_DETECTED` or `DELEGATION_DETECTED` — these are
  possible attacks

## Setup

1. Create the bot with [@BotFather](https://t.me/BotFather) and copy the token.
2. Get your Telegram user id (e.g. by messaging [@userinfobot](https://t.me/userinfobot)).
3. `cp .env.example .env` and fill both in, plus `BOT_WEBHOOK_SECRET` matching guard-core.

```bash
pnpm --filter @agentguard/telegram-bot test
```

All bot messages are in English (product language). See [`/CLAUDE.md`](../../CLAUDE.md).
