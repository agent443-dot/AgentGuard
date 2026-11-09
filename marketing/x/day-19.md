# Day 19 · Friday 2026-11-27 · The bot only listens to you

Theme: how the Telegram bot is locked down, and a bug live runs found.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/security-review.md`

---

## 13:30 UTC · 10:30 BRT · Video · P4

```text
[VIDEO DAY 19]

The Telegram bot holds the approve button and the kill switch. So it listens only to the owners you list, and to guard-core messages it can verify.
```

Caption for the video session: "How the bot decides whom to believe."

---

## 16:00 UTC · 13:00 BRT · Technical · P4

Image: `assets/day-19/01-bot.png`

```text
How AgentGuard's Telegram bot is locked down:

• ignores anyone not in OWNER_TELEGRAM_IDS
• every hook from guard-core is HMAC-signed, checked before parsing
• stale and duplicate events refused
• no public IP: long polling, hooks over Fly's private network
```

Alt text: Card titled "The bot only listens to you." Rows: Owners, updates ignored unless the sender is
in OWNER_TELEGRAM_IDS. Hooks, HMAC-SHA256 over the raw bytes, checked before parsing. Replays, stale
(5 minutes or more) and duplicate events refused. Network, no public IP, long polling, hooks over the
private network. Kill buttons, expire, offered only for a limit that still exists.

---

## 20:00 UTC · 17:00 BRT · Build in public: a stale button · P2

```text
A bug the mainnet pilot found: after /kill, the bot offered a Solana kill button for a limit already removed the day before.

Nothing broke, the page is idempotent, but it sent the owner to a dead button. Now it offers buttons only for limits that still exist (#116).
```

---

## Reply bank for Day 19

**"What if my Telegram account is taken over?"**

```text
Then the attacker can approve payments within the policy, up to the daily cap. They cannot move the vault: that needs your Phantom wallet. Use Telegram's two-step verification.
```

**"Why HMAC and not mTLS?"**

```text
The hooks run over Fly's private network, and HMAC over the raw body lets the bot refuse a forged request before reading it. Stale and duplicate requests are refused too.
```

**"Are attack alerts noisy?"**

```text
They are throttled per agent and per code. Large-payment alerts are not throttled.
```
