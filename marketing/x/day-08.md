# Day 08 · Monday 2026-11-16 · Run your own

Theme: self-hosting, and what you need before you start.
Link: `https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md`

---

## 13:30 UTC · 10:30 BRT · Video · P3

```text
[VIDEO DAY 08]

AgentGuard has no hosted service. You run your own guard, your own Telegram bot and your own signing page, and your vault belongs to your own Phantom wallet. Here is what that takes.
```

Caption for the video session: "Self-hosting AgentGuard: the pieces and the order."

---

## 16:00 UTC · 13:00 BRT · Technical: what you need · P3

Image: `assets/day-08/01-self-host.png`

```text
Before you self-host AgentGuard you need:

• Node 20+ and pnpm 10
• Fly.io, with a card on the account
• Vercel or any static host, for your signing page
• Telegram and a bot token
• a new Phantom wallet with its own phrase, used for nothing else
```

Alt text: Card titled "Run your own. Nothing in the path belongs to us." Rows: Runtime, Node 20+ and
pnpm 10, WSL2 on Windows. guard plus bot, a Fly.io account with a card on it. Signing page, Vercel or
any static host with custom headers. Owner, a new Phantom wallet used for nothing else. Approvals,
Telegram and a bot token from BotFather.

Reply to self:

```text
Two things the guide learned the hard way: Fly trial machines stop after 5 minutes without a card, and on Windows you want WSL2 with the repo under ~, not /mnt/c.

https://github.com/agent443-dot/AgentGuard/blob/main/docs/self-host.md
```

---

## 20:00 UTC · 17:00 BRT · Engagement · P5

```text
Honest question for people who run agents:

What stops you from self-hosting infrastructure like this? Time, cost, trust in your own ops, something else?

We chose self-hosted on purpose: nothing in the money path belongs to us. We know it has a cost.
```

---

## Reply bank for Day 8

**"Will there be a hosted version?"**

```text
There is no hosted service, and we are not announcing one. Self-hosting is the point today: your keys, your vault and your guard never pass through us.
```

**"Does it have to be Fly and Vercel?"**

```text
No. The guide uses them because they are tested end to end. guard-core and the bot are Docker images, and the signing page is static: any host with custom headers works, but vercel.json is ready.
```

**"How much does it cost to run?"**

```text
We have not published a cost figure, and it depends on your plan with each host. The pieces are small: one guard-core machine with a volume, one bot machine, one static page.
```

**"Can I try it without real money?"**

```text
Yes. GUARD_STUB_CHAINS=true runs an offline chain that signs nothing, and Solana devnet and Base Sepolia both work end to end. Never reuse a devnet key on mainnet.
```
